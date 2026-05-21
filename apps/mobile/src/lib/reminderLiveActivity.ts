import type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

export type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

export async function syncReminderLiveActivity(
  _payload: ReminderLiveActivityPayload | null,
): Promise<void> {
  // iOS implementation lives in reminderLiveActivity.ios.tsx.
}
