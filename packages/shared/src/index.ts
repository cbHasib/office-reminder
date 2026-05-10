// Shared types used by both apps/web and apps/desktop.
// Mirrors the Supabase schema in supabase/migrations/0001_initial_schema.sql.

export type UUID = string;
export type Timestamp = string; // ISO-8601

export type TeamRole = "admin" | "member";
export type ReminderAudience = "all" | "specific";

export interface User {
  id: UUID;
  email: string;
  display_name: string | null;
  created_at: Timestamp;
}

export interface Team {
  id: UUID;
  name: string;
  join_code: string; // 6-char base32
  created_by: UUID;
  created_at: Timestamp;
}

export interface TeamMember {
  team_id: UUID;
  user_id: UUID;
  role: TeamRole;
  joined_at: Timestamp;
}

export interface Reminder {
  id: UUID;
  team_id: UUID;
  title: string;
  description: string;
  scheduled_at: Timestamp;          // first/next occurrence
  rrule: string | null;             // RFC 5545 recurrence string, null = one-off
  advance_minutes: number;          // default warning lead time
  audience: ReminderAudience;
  target_user_ids: UUID[];          // populated when audience = 'specific'
  created_by: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserSettings {
  user_id: UUID;
  sound_enabled: boolean;          // default false
  dismissible: boolean;            // default false (overlay can't be closed during countdown)
  advance_minutes_override: number | null;
  muted_reminder_ids: UUID[];
}

export interface ReminderDismissal {
  reminder_id: UUID;
  user_id: UUID;
  fired_at: Timestamp;
  dismissed_at: Timestamp | null;
}

// Sensible defaults — match the database defaults so we never disagree.
export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "user_id"> = {
  sound_enabled: false,
  dismissible: false,
  advance_minutes_override: null,
  muted_reminder_ids: [],
};

export const DEFAULT_ADVANCE_MINUTES = 5;
export const OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES = 5;

/** Generate a join code: 6 chars, Crockford base32 (no I/L/O/U). */
export function generateJoinCode(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
