import {
  isPermissionGranted, requestPermission, sendNotification,
} from "@tauri-apps/plugin-notification";

let permissionCache: boolean | null = null;

async function ensurePermission(): Promise<boolean> {
  if (permissionCache !== null) return permissionCache;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const res = await requestPermission();
      granted = res === "granted";
    }
    permissionCache = granted;
    return granted;
  } catch (e) {
    console.error("notification permission check failed:", e);
    return false;
  }
}

/** Fire-and-forget native notification. Silent on failure / no permission. */
export async function notify(title: string, body: string): Promise<void> {
  const ok = await ensurePermission();
  if (!ok) return;
  try {
    sendNotification({ title, body });
  } catch (e) {
    console.error("sendNotification failed:", e);
  }
}
