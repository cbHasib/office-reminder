import { useEffect, useRef } from "react";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { effectiveAdvanceMinutes, isSilencedForUser, nextOccurrence } from "./scheduler";
import { openOverlay, isOverlayOpen } from "./overlayController";

interface Params {
  reminders: Reminder[];
  settings: UserSettings | null;
  userId: string;
}

export function useReminderScheduler({ reminders, settings, userId }: Params) {
  // Persistent across renders. Cleared once a key is older than 24h
  // so the cache doesn't grow unbounded.
  const firedKeys = useRef<Map<string, number>>(new Map());
  // Guards against parallel tick processing.
  const ticking = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled || ticking.current || !settings) return;
      ticking.current = true;

      try {
        // GC old keys
        const cutoff = Date.now() - 24 * 60 * 60_000;
        for (const [k, t] of firedKeys.current) {
          if (t < cutoff) firedKeys.current.delete(k);
        }

        const now = new Date();
        // Look at each reminder; only one overlay can show at a time.
        for (const r of reminders) {
          if (isSilencedForUser(r, settings, userId)) continue;
          const next = nextOccurrence(r, now);
          if (!next) continue;

          const lead = effectiveAdvanceMinutes(r, settings);
          const fireAt = new Date(next.getTime() - lead * 60_000);
          if (now < fireAt || now > next) continue;

          const key = `${r.id}@${next.toISOString()}`;
          if (firedKeys.current.has(key)) continue;

          // Real check, not just a local boolean — survives HMR / strict mode.
          if (await isOverlayOpen()) continue;

          firedKeys.current.set(key, Date.now());
          try {
            await openOverlay(
              {
                reminderId: r.id,
                title: r.title,
                description: r.description,
                eventAtISO: next.toISOString(),
                leadMinutes: lead,
                dismissibleDuringCountdown: settings.dismissible,
                soundEnabled: settings.sound_enabled,
                soundName: settings.sound_name,
                theme: settings.theme,
              },
              settings.overlay_position,
            );
          } catch (err) {
            console.error("Failed to open overlay:", err);
            // Don't unset the firedKey — if openOverlay failed, we'd just
            // re-attempt next tick and likely fail again.
          }

          // Only one overlay per tick.
          break;
        }
      } finally {
        ticking.current = false;
      }
    }

    tick();
    const id = window.setInterval(tick, 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [reminders, settings, userId]);
}
