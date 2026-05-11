import { useEffect, useState } from "react";
import { WEB_DOWNLOAD_URL } from "@office-reminder/shared";
import { externalLink } from "@/lib/openExternal";
import { checkForUpdate, dismissUpdate, type UpdateInfo } from "@/lib/updateCheck";

/**
 * Small banner that appears at the top of the main content area whenever a
 * newer release exists on GitHub. Auto-checks every hour and on mount.
 */
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const u = await checkForUpdate();
      if (!cancelled) setInfo(u);
    }
    run();
    const id = window.setInterval(run, 60 * 60_000); // hourly
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  if (!info) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", marginBottom: 18,
      borderRadius: 10,
      background: "linear-gradient(135deg, rgb(var(--brand) / 0.10), rgb(var(--success) / 0.10))",
      border: "1px solid rgb(var(--brand) / 0.35)",
      color: "rgb(var(--fg))",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "rgb(var(--brand))",
        color: "rgb(var(--brand-fg))",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 1v9M3 7l4 4 4-4M2 13h10" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
          Update available — v{info.latest}
        </p>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
          You're on v{info.current}. New version released{" "}
          {new Date(info.releasedAt).toLocaleDateString()}.
        </p>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, padding: "5px 10px" }}
          onClick={() => { dismissUpdate(info.latest); setInfo(null); }}
        >
          Later
        </button>
        <a
          {...externalLink(WEB_DOWNLOAD_URL)}
          className="btn btn-primary"
          style={{ fontSize: 12, padding: "5px 12px", textDecoration: "none" }}
        >
          Download
        </a>
      </div>
    </div>
  );
}
