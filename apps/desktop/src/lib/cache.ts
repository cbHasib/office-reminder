/**
 * Local cache for reminders + settings.
 *
 * Keeps things working when the network is briefly offline. We use
 * localStorage for v1; a future iteration can swap in tauri-plugin-sql
 * for richer queries and real persistence across all platforms.
 */
import type { Reminder, UserSettings } from "@office-reminder/shared";

const KEY_REMINDERS = "or.reminders";
const KEY_SETTINGS  = "or.settings";

export function saveReminders(rs: Reminder[]): void {
  try { localStorage.setItem(KEY_REMINDERS, JSON.stringify(rs)); } catch {}
}
export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(KEY_REMINDERS);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch { return []; }
}

export function saveSettings(s: UserSettings | null): void {
  try {
    if (s) localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));
    else localStorage.removeItem(KEY_SETTINGS);
  } catch {}
}
export function loadSettings(): UserSettings | null {
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    return raw ? (JSON.parse(raw) as UserSettings) : null;
  } catch { return null; }
}
