import { getVersion } from "@tauri-apps/api/app";

const LATEST_URL = "https://api.github.com/repos/cbHasib/office-reminder/releases/latest";
const LS_DISMISSED_VERSION = "or.update.dismissed-version";
const LS_LAST_CHECK = "or.update.last-check";

export interface UpdateInfo {
  current: string;
  latest: string;
  releaseUrl: string;
  releasedAt: string;
}

/** Compare semver-ish strings (a.b.c). Returns -1, 0, or 1. */
function cmp(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(/[.\-+]/);
  const pb = b.replace(/^v/, "").split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = parseInt(pa[i] ?? "0", 10);
    const nb = parseInt(pb[i] ?? "0", 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      // Fallback to lexicographic if a part isn't numeric.
      if ((pa[i] ?? "") < (pb[i] ?? "")) return -1;
      if ((pa[i] ?? "") > (pb[i] ?? "")) return 1;
      continue;
    }
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}

/**
 * Look up the latest GitHub release and return {current,latest,...} when an
 * update is available. Returns null otherwise (incl. when the user has already
 * dismissed this exact version).
 */
export async function checkForUpdate(opts: { ignoreDismissed?: boolean } = {}): Promise<UpdateInfo | null> {
  try {
    const current = await getVersion();
    const res = await fetch(LATEST_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const latest = (data.tag_name as string).replace(/^v/, "");
    if (!latest) return null;
    if (cmp(latest, current) <= 0) return null;
    if (!opts.ignoreDismissed) {
      try {
        const dismissed = localStorage.getItem(LS_DISMISSED_VERSION);
        if (dismissed === latest) return null;
      } catch {}
    }
    return {
      current,
      latest,
      releaseUrl: data.html_url as string,
      releasedAt: data.published_at as string,
    };
  } catch (e) {
    console.error("update check failed:", e);
    return null;
  } finally {
    try { localStorage.setItem(LS_LAST_CHECK, new Date().toISOString()); } catch {}
  }
}

export function dismissUpdate(version: string): void {
  try { localStorage.setItem(LS_DISMISSED_VERSION, version); } catch {}
}

export function lastCheckTime(): string | null {
  try { return localStorage.getItem(LS_LAST_CHECK); } catch { return null; }
}
