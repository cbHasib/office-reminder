import { useEffect, useState } from "react";
import { WEB_DOWNLOAD_URL } from "@office-reminder/shared";
import { checkForUpdate, dismissUpdate, type UpdateInfo } from "@/lib/updateCheck";
import { openExternal } from "@/lib/openExternal";

/**
 * A beautiful, fully automated in-app update banner.
 * Auto-checks every hour and on mount. If a new update is found,
 * it performs an in-app download, background installation, and
 * automatic app restart, falling back gracefully to manual download
 * if signatures are unconfigured.
 */
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState("");

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

  async function handleAutoUpdate() {
    setUpdating(true);
    setStatus("Initiating update...");
    try {
      // Dynamically load Tauri plugins to prevent imports from breaking in non-Tauri contexts
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      setStatus("Verifying signatures...");
      const update = await check();

      if (update && update.available) {
        setStatus("Downloading and installing in background...");
        await update.downloadAndInstall();
        setStatus("Applying update and restarting...");
        await relaunch();
      } else {
        // Fall back to opening browser if the release channel hasn't populated Tauri manifests yet
        setStatus("Redirecting to download page...");
        await openExternal(WEB_DOWNLOAD_URL);
        setUpdating(false);
      }
    } catch (err) {
      console.warn("Native updater unconfigured or failed, falling back to manual download:", err);
      setStatus("Opening download page...");
      try {
        await openExternal(WEB_DOWNLOAD_URL);
      } catch (openErr) {
        console.error("Manual browser download redirect failed:", openErr);
      }
      // Keep updating as true to show fallback redirect completed, but allow dismissal
      setTimeout(() => {
        setUpdating(false);
        setInfo(null);
      }, 2000);
    }
  }

  if (!info) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px", marginBottom: 18,
      borderRadius: 10,
      background: "linear-gradient(135deg, rgb(var(--brand) / 0.10), rgb(var(--success) / 0.10))",
      border: "1px solid rgb(var(--brand) / 0.35)",
      color: "rgb(var(--fg))",
      transition: "all 0.3s ease",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "rgb(var(--brand))",
        color: "rgb(var(--brand-fg))",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        animation: updating ? "pulse 2s infinite" : "none",
      }}>
        {updating ? (
          <svg style={{ animation: "spin 1.5s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.72" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 1v9M3 7l4 4 4-4M2 13h10" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {updating ? (
          <>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              Updating to v{info.latest}
            </p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              {status}
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              Update available — v{info.latest}
            </p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              You're on v{info.current}. New version released{" "}
              {new Date(info.releasedAt).toLocaleDateString()}.
            </p>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {!updating && (
          <>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: "5px 10px" }}
              onClick={() => { dismissUpdate(info.latest); setInfo(null); }}
            >
              Later
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={handleAutoUpdate}
            >
              Update Now
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
