import type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

export type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

export async function syncReminderLiveActivity(
  _payload: ReminderLiveActivityPayload | null,
  throwOnError?: boolean,
): Promise<void> {
  if (throwOnError) {
    throw new Error("[Live Activity Stub] syncReminderLiveActivity called. Metro resolved the generic .tsx stub instead of .ios.tsx!");
  }
}
