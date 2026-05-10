import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function getAutostartEnabled(): Promise<boolean> {
  try { return await isEnabled(); } catch { return false; }
}

export async function setAutostartEnabled(on: boolean): Promise<void> {
  try { if (on) await enable(); else await disable(); } catch (e) {
    console.error("autostart toggle failed:", e);
  }
}
