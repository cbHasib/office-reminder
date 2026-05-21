import * as Notifications from "expo-notifications";
import { rrulestr } from "rrule";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { supabase } from "./supabase";

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
      return 0;
    }

    const reminders = remindersData as Reminder[];

    // 5. Clear old scheduled local notifications to prevent duplicate warnings
    await Notifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const start = new Date(now.getTime() - 5 * 60_000); // 5 minutes buffer
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60_000); // 7-day window

    let scheduledCount = 0;

    for (const r of reminders) {
      if (isSilencedForUser(r, settings, userId)) continue;

      const occurrences = getUpcomingOccurrences(r, start, end);
      const lead = effectiveAdvanceMinutes(r, settings);

      for (const occ of occurrences) {
        const eventAtMs = occ.getTime();
        const fireAtMs = eventAtMs - lead * 60_000;
        
        // Skip occurrences where warning lead time has already passed
        if (fireAtMs <= now.getTime()) continue;

        const fireAtDate = new Date(fireAtMs);
        const soundEnabled = settings ? settings.sound_enabled : false;
        const soundName = settings ? settings.sound_name : "chime";

        // Schedule local push notification at calculated offset
        await Notifications.scheduleNotificationAsync({
          content: {
            title: r.title,
            body: r.description || `Office Event starts in ${lead} minutes!`,
            // Fallback natively to default system alert sounds during local development
            // sound: soundEnabled ? `${soundName}.wav` : undefined,
            data: {
              reminderId: r.id,
              eventAtISO: occ.toISOString(),
            },
          },
          trigger: {
            date: fireAtDate,
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: 'default',
          },
        });

        scheduledCount++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[Notification Scheduler] Successfully scheduled ${scheduledCount} alerts for the next 7 days.`);
    return scheduledCount;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Scheduler Error] Failed to synchronise mobile alerts:", error);
    return 0;
  }
}
