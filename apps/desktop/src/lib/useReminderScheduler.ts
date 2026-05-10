import { useEffect, useRef } from "react";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { effectiveAdvanceMinutes, isSilencedForUser, nextOccurrence } from "./scheduler";
import { openOverlay, isOverlayOpen } from "./overlayController";

interface Params {
  reminders: Reminder[];
  settings: UserSettings | null;
  userId: string;
}

/**
 * Ticks every 15s. For each reminder whose fire window contains "now",
 * spawns the countdown overlay window (unless it's already open for that
 * occurrence).
 */
export function useReminderScheduler({ reminders, settings, userId }: Params) {
  const firedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const now = new Date();
      for (const r of reminders) {
        if (isSilencedForUser(r, settings, userId)) continue;
        const next = nextOccurrence(r, now);
        if (!next) continue;

        const lead = effectiveAdvanceMinutes(r, settings);
        const fireAt = new Date(next.getTime() - lead * 60_000);

        if (now >= fireAt && now <= next) {
          const key = `${r.id}@${next.toISOString()}`;
          if (firedKeys.current.has(key)) continue;
          firedKeys.current.add(key);

          if (!isOverlayOpen()) {
            openOverlay({
              reminderId: r.id,
              title: r.title,
              description: r.description,
              eventAtISO: next.toISOString(),
              dismissibleDuringCountdown: settings?.dismissible ?? false,
              soundEnabled: settings?.sound_enabled ?? false,
            }).catch((err) => console.error("Failed to open overlay:", err));
          }
        }
      }
    }

    tick();
    const id = window.setInterval(tick, 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [reminders, settings, userId]);
}
