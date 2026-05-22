import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { rrulestr } from "rrule";
import type { Reminder, SoundName, UserSettings } from "./shared";
import { supabase } from "./supabase";
import { syncReminderLiveActivity, type ReminderLiveActivityPayload } from "./reminderLiveActivity";

const NOTIFICATION_COLOR = "#0F0F12";
const SILENT_CHANNEL_ID = "office-reminder-silent";
const DEFAULT_SOUND_CHANNEL_ID = "office-reminder-default-sound";
const SOUND_CHANNEL_PREFIX = "office-reminder-sound";
const SOUND_NAMES: SoundName[] = ["chime", "bell", "ding", "soft", "alert"];
type NotificationSound = `${SoundName}.wav` | "default" | false;

// Setup standard expo notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/** Formats dates to standard ICS timestamp used by rrule */
function formatICS(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Resolves standard lead warnings */
export function effectiveAdvanceMinutes(r: Reminder, settings: UserSettings | null): number {
  if (settings?.advance_minutes_override != null) return settings.advance_minutes_override;
  return r.advance_minutes;
}

/** Determines if a reminder is silenced or muted for the user */
export function isSilencedForUser(r: Reminder, settings: UserSettings | null, userId: string): boolean {
  if (settings?.muted_reminder_ids?.includes(r.id)) return true;
  if (r.audience === "specific" && !r.target_user_ids.includes(userId)) return true;
  return false;
}

function notificationSoundName(settings: UserSettings | null): NotificationSound {
  if (!settings?.sound_enabled) return false;
  if (Constants.appOwnership === "expo") return "default";
  const soundName = SOUND_NAMES.includes(settings.sound_name) ? settings.sound_name : "chime";
  return `${soundName}.wav`;
}

async function ensureNotificationChannel(soundFile: NotificationSound): Promise<string | undefined> {
  if (Platform.OS !== "android") return undefined;

  const channelId = soundFile
    ? soundFile === "default"
      ? DEFAULT_SOUND_CHANNEL_ID
      : `${SOUND_CHANNEL_PREFIX}-${soundFile.replace(".wav", "")}`
    : SILENT_CHANNEL_ID;

  await Notifications.setNotificationChannelAsync(channelId, {
    name: soundFile && soundFile !== "default"
      ? `Office Reminder (${soundFile.replace(".wav", "")})`
      : "Office Reminder",
    importance: Notifications.AndroidImportance.HIGH,
    sound: soundFile || null,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#818CF8",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  return channelId;
}

/** Expands recurring reminders or resolves a standard one-off date */
export function getUpcomingOccurrences(r: Reminder, start: Date, end: Date): Date[] {
  if (!r.rrule) {
    const t = new Date(r.scheduled_at);
    return t >= start && t <= end ? [t] : [];
  }
  try {
    const rule = rrulestr(`DTSTART:${formatICS(new Date(r.scheduled_at))}\nRRULE:${r.rrule}`);
    return rule.between(start, end, true);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse RRULE for reminder:", r.id, e);
    return [];
  }
}

/** Schedules notifications for all valid upcoming occurrences over the next 7 days */
export async function syncMobileScheduler(userId: string): Promise<number> {
  try {
    // 1. Request notification permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== "granted") {
        // eslint-disable-next-line no-console
        console.warn("Notification permissions not granted");
        return 0;
      }
    }

    // 2. Fetch User Settings
    const { data: settingsData } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    const settings = settingsData as UserSettings | null;

    // 3. Fetch user's active teams
    const { data: memberData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);

    if (!memberData || memberData.length === 0) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await syncReminderLiveActivity(null);
      return 0;
    }

    const teamIds = memberData.map((m) => m.team_id);

    // 4. Fetch all active reminders for those teams
    const { data: remindersData } = await supabase
      .from("reminders")
      .select("*")
      .in("team_id", teamIds);

    if (!remindersData || remindersData.length === 0) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await syncReminderLiveActivity(null);
      return 0;
    }

    const reminders = remindersData as Reminder[];

    // 5. Clear old scheduled local notifications to prevent duplicate warnings
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const start = new Date(now.getTime() - 5 * 60_000); // 5 minutes buffer
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60_000); // 7-day window

    let scheduledCount = 0;
    let nearestActivity: ReminderLiveActivityPayload | null = null;

    for (const r of reminders) {
      if (isSilencedForUser(r, settings, userId)) continue;

      const occurrences = getUpcomingOccurrences(r, start, end);
      const lead = effectiveAdvanceMinutes(r, settings);

      for (const occ of occurrences) {
        const eventAtMs = occ.getTime();
        const fireAtMs = eventAtMs - lead * 60_000;

        if (eventAtMs > now.getTime()) {
          const liveActivityPayload = {
            reminderId: r.id,
            title: r.title,
            description: r.description || "",
            startsAtISO: occ.toISOString(),
            warningAtISO: new Date(Math.max(now.getTime(), fireAtMs)).toISOString(),
            leadMinutes: lead,
          };
          if (
            !nearestActivity ||
            eventAtMs < new Date(nearestActivity.startsAtISO).getTime()
          ) {
            nearestActivity = liveActivityPayload;
          }
        }

        // Skip occurrences where warning lead time has already passed
        if (fireAtMs <= now.getTime()) continue;

        const fireAtDate = new Date(fireAtMs);
        const sound = notificationSoundName(settings);
        const channelId = await ensureNotificationChannel(sound);

        // Schedule local push notification at calculated offset
        await Notifications.scheduleNotificationAsync({
          content: {
            title: r.title,
            subtitle: `${lead} minute countdown`,
            body: r.description || `Office event starts in ${lead} minutes.`,
            sound,
            ...(Platform.OS === "android"
              ? {
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  color: NOTIFICATION_COLOR,
                  sticky: true,
                  autoDismiss: false,
                }
              : {}),
            data: {
              reminderId: r.id,
              eventAtISO: occ.toISOString(),
              warningAtISO: fireAtDate.toISOString(),
              leadMinutes: lead,
            },
          },
          trigger: {
            date: fireAtDate,
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            ...(channelId ? { channelId } : {}),
          },
        });

        scheduledCount++;
      }
    }

    await syncReminderLiveActivity(nearestActivity);

    // eslint-disable-next-line no-console
    console.log(`[Notification Scheduler] Successfully scheduled ${scheduledCount} alerts for the next 7 days.`);
    return scheduledCount;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Scheduler Error] Failed to synchronise mobile alerts:", error);
    return 0;
  }
}
