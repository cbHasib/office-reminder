import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const OVERLAY_LABEL = "reminder-overlay";

export interface OverlayPayload {
  reminderId: string;
  title: string;
  description: string;
  eventAtISO: string;            // when the event actually fires
  dismissibleDuringCountdown: boolean;
  soundEnabled: boolean;
}

let openTracker = false;

/** Whether an overlay window is currently being shown by this process. */
export function isOverlayOpen(): boolean {
  return openTracker;
}

/** Open (or reuse) the overlay window with the given reminder payload. */
export async function openOverlay(payload: OverlayPayload): Promise<void> {
  // Pass payload via URL hash so the overlay route can read it without IPC plumbing
  const hash = encodeURIComponent(JSON.stringify(payload));
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL).catch(() => null);
  if (existing) {
    await existing.close().catch(() => {});
  }

  const win = new WebviewWindow(OVERLAY_LABEL, {
    url: `overlay.html#${hash}`,
    title: "Reminder",
    width: 360,
    height: 140,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focus: false,
    shadow: true,
  });

  openTracker = true;
  win.once("tauri://destroyed", () => { openTracker = false; });
  win.once("tauri://error", (e) => {
    console.error("overlay window error:", e);
    openTracker = false;
  });
}

/** Used by the overlay window to close itself */
export async function closeMyself(): Promise<void> {
  const win = getCurrentWebviewWindow();
  await win.close();
}
