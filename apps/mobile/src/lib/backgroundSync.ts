import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { syncMobileScheduler } from "./notificationScheduler";
import { supabase } from "./supabase";

const BACKGROUND_REMINDER_SYNC_TASK = "BACKGROUND_REMINDER_SYNC";

// Define the background task handler
TaskManager.defineTask(BACKGROUND_REMINDER_SYNC_TASK, async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      const scheduledCount = await syncMobileScheduler(userId);
      // eslint-disable-next-line no-console
      console.log(`[Background Worker] Synced reminders in background. Scheduled ${scheduledCount} alerts.`);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Background Worker Error] Failed to synchronize background events:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Registers the background task to run automatically periodically */
export async function registerBackgroundSync() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REMINDER_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_REMINDER_SYNC_TASK, {
        minimumInterval: 15 * 60, // sync every 15 minutes minimum or OS default
        stopOnTerminate: false,
        startOnBoot: true,
      });
      // eslint-disable-next-line no-console
      console.log("[Background Sync] Registered mobile sync worker successfully.");
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Background Sync Error] Failed to register background tasks:", err);
  }
}
