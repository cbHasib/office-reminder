import { useEffect } from "react";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES } from "@office-reminder/shared";
import { effectiveAdvanceMinutes, isSilencedForUser, getUpcomingOccurrences } from "./scheduler";
import { invoke } from "@tauri-apps/api/core";

interface Params {
  reminders: Reminder[];
  settings: UserSettings | null;
  userId: string;
}

interface ActiveEvent {
  id: string;
  reminderId: string;
  title: string;
  description: string;
  eventAtMs: number;
  fireAtMs: number;
  closeAtMs: number;
  eventAtISO: string;
  leadMinutes: number;
  dismissibleDuringCountdown: boolean;
  soundEnabled: boolean;
  soundName: string;
  theme: string;
  overlayPosition: string;
}

export function useReminderScheduler({ reminders, settings, userId }: Params) {
  useEffect(() => {
    if (!settings) return;

    async function syncScheduler() {
      if (!settings) return;
      const s = settings;
      try {
        const now = new Date();
        const start = new Date(now.getTime() - OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000);
        const end = new Date(now.getTime() + 7 * 24 * 60 * 60_000); // 7 days rolling window

        const events: ActiveEvent[] = [];

        for (const r of reminders) {
          if (isSilencedForUser(r, s, userId)) continue;

          const occurrences = getUpcomingOccurrences(r, start, end);
          const lead = effectiveAdvanceMinutes(r, s);

          for (const occ of occurrences) {
            const eventAtMs = occ.getTime();
            const fireAtMs = eventAtMs - lead * 60_000;
            const closeAtMs = eventAtMs + OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000;

            events.push({
              id: `${r.id}@${occ.toISOString()}`,
              reminderId: r.id,
              title: r.title,
              description: r.description || "",
              eventAtMs,
              fireAtMs,
              closeAtMs,
              eventAtISO: occ.toISOString(),
              leadMinutes: lead,
              dismissibleDuringCountdown: s.dismissible,
              soundEnabled: s.sound_enabled,
              soundName: s.sound_name,
              theme: s.theme,
              overlayPosition: s.overlay_position,
            });
          }
        }

        // Sort events chronologically so the scheduler processes the nearest ones first
        events.sort((a, b) => a.fireAtMs - b.fireAtMs);

        await invoke("save_active_events", { events });
      } catch (err) {
        console.error("Failed to sync background scheduler with Rust:", err);
      }
    }

    syncScheduler();
    
    // Refresh the active occurrences list every hour
    const intervalId = window.setInterval(syncScheduler, 60 * 60_000);
    return () => window.clearInterval(intervalId);
  }, [reminders, settings, userId]);
}
