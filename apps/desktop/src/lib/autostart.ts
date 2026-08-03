import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { getVersion } from "@tauri-apps/api/app";

const LS_PREF = "or.autostart.pref"; // "on" | "off" (absent = never configured)
const LS_APPLIED_VERSION = "or.autostart.applied-version";

export async function getAutostartEnabled(): Promise<boolean> {
  try { return await isEnabled(); } catch { return false; }
}

export async function setAutostartEnabled(on: boolean): Promise<void> {
  try {
    if (on) await enable(); else await disable();
    localStorage.setItem(LS_PREF, on ? "on" : "off");
  } catch (e) {
    console.error("autostart toggle failed:", e);
  }
}

/**
 * Autostart is ON by default: enable it on first run, and re-apply once per
 * app version while the preference is "on" (keeps the login item's launch
 * args, e.g. --autostart, current across updates). Never overrides an
 * explicit "off" chosen by the user.
 */
export async function ensureAutostartDefault(): Promise<void> {
  try {
    const pref = localStorage.getItem(LS_PREF);
    if (pref === "off") return;
    const version = await getVersion().catch(() => "unknown");
    if (pref === "on" && localStorage.getItem(LS_APPLIED_VERSION) === version) return;
    await enable();
    localStorage.setItem(LS_PREF, "on");
    localStorage.setItem(LS_APPLIED_VERSION, version);
  } catch (e) {
    console.error("autostart default setup failed:", e);
  }
}
