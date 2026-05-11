/**
 * Open a URL in the user's default browser. In Tauri webviews, `<a target="_blank">`
 * doesn't open externally — the opener plugin is the canonical path.
 */
import { openUrl } from "@tauri-apps/plugin-opener";

export async function openExternal(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch (e) {
    console.error("openExternal failed for", url, e);
  }
}

/** Use on any anchor element so clicks open in the OS browser, not the webview. */
export function externalLink(url: string) {
  return {
    href: url,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      openExternal(url);
    },
  };
}
