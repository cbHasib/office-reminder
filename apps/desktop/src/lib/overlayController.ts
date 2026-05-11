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

/** Async lock to serialize open/close. */
let inflight: Promise<unknown> | null = null;

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  while (inflight) { try { await inflight; } catch {} }
  const p = (async () => fn())();
  inflight = p.finally(() => { if (inflight === p) inflight = null; });
  return p;
}

/** Real check: does Tauri have an overlay window right now? */
export async function isOverlayOpen(): Promise<boolean> {
  try {
    const w = await WebviewWindow.getByLabel(OVERLAY_LABEL).catch(() => null);
    if (!w) return false;
    // Some Tauri versions return a stale handle for a closed window.
    // Verify it's actually visible.
    const visible = await w.isVisible().catch(() => false);
    return visible;
  } catch {
    return false;
  }
}

/** Open the overlay window (idempotent — closes any existing one first). */
export async function openOverlay(
  payload: OverlayPayload,
  position: OverlayPosition,
): Promise<void> {
  return withLock(async () => {
    // Close any previous overlay first so we never leak a stale one.
    const existing = await WebviewWindow.getByLabel(OVERLAY_LABEL).catch(() => null);
    if (existing) {
      try { await existing.close(); } catch {}
      // Give Tauri a tick to fully tear down before re-creating with the same label.
      await new Promise((r) => setTimeout(r, 60));
    }

    const hash = encodeURIComponent(JSON.stringify(payload));
    const { x, y } = await computePosition(position);

    new WebviewWindow(OVERLAY_LABEL, {
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

export async function closeMyself(): Promise<void> {
  await getCurrentWebviewWindow().close();
}
