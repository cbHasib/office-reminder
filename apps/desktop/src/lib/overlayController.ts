import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { SoundName, Theme } from "@office-reminder/shared";

// The overlay window itself is spawned by the native Rust scheduler
// (src-tauri/src/main.rs); this module only holds the payload shape and
// the self-close helper used inside the overlay webview.

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

export async function closeMyself(): Promise<void> {
  await getCurrentWebviewWindow().close();
}
