import { WebviewWindow, getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { currentMonitor } from "@tauri-apps/api/window";
import type { OverlayPosition, SoundName, Theme } from "@office-reminder/shared";

const OVERLAY_LABEL = "reminder-overlay";
const OVERLAY_W = 380;
const OVERLAY_H = 110;
const SCREEN_MARGIN = 18;
const BOTTOM_DOCK_PADDING = 60;

export interface OverlayPayload {
  reminderId: string;
  title: string;
  description: string;
  eventAtISO: string;
  leadMinutes: number;
  dismissibleDuringCountdown: boolean;
  soundEnabled: boolean;
  soundName: SoundName;
  theme: Theme;
}

let openTracker = false;
export function isOverlayOpen(): boolean { return openTracker; }

export async function openOverlay(
  payload: OverlayPayload,
  position: OverlayPosition,
): Promise<void> {
  const hash = encodeURIComponent(JSON.stringify(payload));

  // Close any prior overlay
  const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL).catch(() => null);
  if (existing) await existing.close().catch(() => {});

  const { x, y } = await computePosition(position);

  const win = new WebviewWindow(OVERLAY_LABEL, {
    url: `overlay.html#${hash}`,
    title: "Reminder",
    width: OVERLAY_W,
    height: OVERLAY_H,
    x, y,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focus: false,
    shadow: false,
  });

  openTracker = true;
  win.once("tauri://destroyed", () => { openTracker = false; });
  win.once("tauri://error", (e) => {
    console.error("overlay window error:", e);
    openTracker = false;
  });
}

async function computePosition(pos: OverlayPosition): Promise<{ x: number; y: number }> {
  try {
    const m = await currentMonitor();
    if (!m) return { x: 100, y: 100 };
    const sf = m.scaleFactor || 1;
    const screenW = m.size.width / sf;
    const screenH = m.size.height / sf;
    const right  = screenW - OVERLAY_W - SCREEN_MARGIN;
    const center = (screenW - OVERLAY_W) / 2;
    const top    = SCREEN_MARGIN;
    const bottom = screenH - OVERLAY_H - SCREEN_MARGIN - BOTTOM_DOCK_PADDING;

    switch (pos) {
      case "top-right":     return { x: right,  y: top };
      case "top-left":      return { x: SCREEN_MARGIN, y: top };
      case "top-center":    return { x: center, y: top };
      case "bottom-right":  return { x: right,  y: bottom };
      case "bottom-left":   return { x: SCREEN_MARGIN, y: bottom };
      case "bottom-center": return { x: center, y: bottom };
    }
  } catch (e) {
    console.error("computePosition failed:", e);
    return { x: 100, y: 100 };
  }
}

/** Used by the overlay window itself to close. */
export async function closeMyself(): Promise<void> {
  await getCurrentWebviewWindow().close();
}
