import { rrulestr } from "rrule";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES } from "@office-reminder/shared";

/**
 * Given a reminder, find the next occurrence (>= now) of its scheduled time.
 * For one-off reminders, that's just `scheduled_at`.
 * For recurring reminders, expand the RRULE.
 */
export function nextOccurrence(r: Reminder, now = new Date()): Date | null {
  if (!r.rrule) {
    const t = new Date(r.scheduled_at);
    return t >= now ? t : null;
  }
  try {
    // Anchor the rrule's start to the original scheduled_at
    const rule = rrulestr(`DTSTART:${formatICS(new Date(r.scheduled_at))}\nRRULE:${r.rrule}`);
    const next = rule.after(toFakeUTC(now), true);
    return next ? fromFakeUTC(next) : null;
  } catch (e) {
    console.error("Failed to parse RRULE for reminder:", r.id, e);
    return null;
  }
}

/**
 * rrule.js evaluates rules in UTC. To make BYDAY and time-of-day follow the
 * user's local wall clock (a "Mon 9:00" rule should mean local Monday 9:00,
 * stable across DST), we expand rules in "fake UTC" space: local wall-clock
 * fields are copied into UTC fields before expansion and copied back after.
 */
function toFakeUTC(d: Date): Date {
  return new Date(Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(),
    d.getHours(), d.getMinutes(), d.getSeconds(),
  ));
}
function fromFakeUTC(d: Date): Date {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(),
  );
}

function formatICS(d: Date): string {
  // RRULE wants UTC basic format like 20260510T120000Z; feed it the local
  // wall-clock fields (fake UTC) so expansion happens in local time.
  return toFakeUTC(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Effective lead time for a given reminder + user settings. */
export function effectiveAdvanceMinutes(r: Reminder, settings: UserSettings | null): number {
  if (settings?.advance_minutes_override != null) return settings.advance_minutes_override;
  return r.advance_minutes;
}

/** A "due now" window: the reminder should be on screen if its window contains `now`. */
export function isWithinFireWindow(r: Reminder, settings: UserSettings | null, now = new Date()): {
  fire: boolean; fireAt: Date | null; eventAt: Date | null;
} {
  const next = nextOccurrence(r, new Date(now.getTime() - OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000));
  if (!next) return { fire: false, fireAt: null, eventAt: null };
  const lead = effectiveAdvanceMinutes(r, settings);
  const fireAt = new Date(next.getTime() - lead * 60_000);
  const closeAt = new Date(next.getTime() + OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000);
  return { fire: now >= fireAt && now <= closeAt, fireAt, eventAt: next };
}

/** Should we skip this reminder for this user? (muted, or audience excludes them) */
export function isSilencedForUser(r: Reminder, settings: UserSettings | null, userId: string): boolean {
  if (settings?.muted_reminder_ids?.includes(r.id)) return true;
  if (r.audience === "specific" && !r.target_user_ids.includes(userId)) return true;
  return false;
}

/** Get all occurrences for a reminder between start and end dates. */
export function getUpcomingOccurrences(r: Reminder, start: Date, end: Date): Date[] {
  if (!r.rrule) {
    const t = new Date(r.scheduled_at);
    return t >= start && t <= end ? [t] : [];
  }
  try {
    const rule = rrulestr(`DTSTART:${formatICS(new Date(r.scheduled_at))}\nRRULE:${r.rrule}`);
    return rule.between(toFakeUTC(start), toFakeUTC(end), true).map(fromFakeUTC);
  } catch (e) {
    console.error("Failed to parse RRULE for reminder:", r.id, e);
    return [];
  }
}

