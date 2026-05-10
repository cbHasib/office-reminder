// Shared types used by both apps/web and apps/desktop.
// Mirrors the Supabase schema in supabase/migrations/.

export type UUID = string;
export type Timestamp = string; // ISO-8601

export type TeamRole = "admin" | "member";
export type ReminderAudience = "all" | "specific";
export type Theme = "system" | "light" | "dark";
export type OverlayPosition =
  | "top-right" | "top-left"
  | "bottom-right" | "bottom-left"
  | "top-center" | "bottom-center";
export type SoundName = "chime" | "bell" | "ding" | "soft" | "alert";

export interface User {
  id: UUID;
  email: string;
  display_name: string | null;
  created_at: Timestamp;
}

export interface Team {
  id: UUID;
  name: string;
  join_code: string;
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
  scheduled_at: Timestamp;
  rrule: string | null;
  advance_minutes: number;
  audience: ReminderAudience;
  target_user_ids: UUID[];
  created_by: UUID;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserSettings {
  user_id: UUID;
  sound_enabled: boolean;
  dismissible: boolean;
  advance_minutes_override: number | null;
  muted_reminder_ids: UUID[];
  theme: Theme;
  overlay_position: OverlayPosition;
  sound_name: SoundName;
}

export interface ReminderDismissal {
  reminder_id: UUID;
  user_id: UUID;
  fired_at: Timestamp;
  dismissed_at: Timestamp | null;
}

export const DEFAULT_USER_SETTINGS: Omit<UserSettings, "user_id"> = {
  sound_enabled: false,
  dismissible: false,
  advance_minutes_override: null,
  muted_reminder_ids: [],
  theme: "system",
  overlay_position: "top-right",
  sound_name: "chime",
};

export const DEFAULT_ADVANCE_MINUTES = 5;
export const OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES = 5;

export const OVERLAY_POSITION_LABELS: Record<OverlayPosition, string> = {
  "top-right":     "Top right",
  "top-left":      "Top left",
  "top-center":    "Top center",
  "bottom-right":  "Bottom right",
  "bottom-left":   "Bottom left",
  "bottom-center": "Bottom center",
};

export const SOUND_LABELS: Record<SoundName, string> = {
  chime: "Chime — soft two-note",
  bell:  "Bell — clear single tone",
  ding:  "Ding — short and quick",
  soft:  "Soft — gentle pad",
  alert: "Alert — attention-grabbing",
};

/** Generate a join code: 6 chars, Crockford base32 (no I/L/O/U). */
export function generateJoinCode(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
