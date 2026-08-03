import { useEffect, useState } from "react";
import { closeMyself, type OverlayPayload } from "@/lib/overlayController";
import { OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES } from "@office-reminder/shared";
import { playSound } from "@/lib/sounds";
import { invoke } from "@tauri-apps/api/core";

export default function OverlayWindow() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Try URL hash first (backwards compatibility and quick JS development)
    try {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const raw = decodeURIComponent(hash);
        const parsed = JSON.parse(raw) as OverlayPayload;
        setPayload(parsed);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn("Failed to parse hash payload, falling back to IPC:", e);
    }

    // 2. Fall back to IPC command
    invoke<OverlayPayload>("get_overlay_payload")
      .then((p) => {
        setPayload(p);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load overlay payload:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="overlay-root" style={{ background: "rgba(15, 23, 42, 0.95)" }}>
        <p className="overlay-title">Loading…</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="overlay-root" style={{ background: "rgba(15, 23, 42, 0.95)" }}>
        <p className="overlay-title">Missing payload</p>
      </div>
    );
  }

  return <OverlayContent payload={payload} />;
}

function mixTuple(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const tt = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * tt),
    Math.round(a[1] + (b[1] - a[1]) * tt),
    Math.round(a[2] + (b[2] - a[2]) * tt),
  ];
}
function darken(c: [number, number, number], amount: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, amount));
  return [
    Math.round(c[0] * (1 - t)),
    Math.round(c[1] * (1 - t)),
    Math.round(c[2] * (1 - t)),
  ];
}
const SLATE: [number, number, number] = [148, 163, 184];
const AMBER: [number, number, number] = [251, 191,  36];
const RED:   [number, number, number] = [248, 113, 113];

const RADIUS = 32;
const CIRC = 2 * Math.PI * RADIUS;

function OverlayContent({ payload }: { payload: OverlayPayload }) {
  const [now, setNow] = useState(() => new Date());
  // If we mount at/after the event time, the "sound on open" effect already
  // covers this commit — start with the zero-sound marked played so both
  // effects can't fire the sound twice simultaneously.
  const [zeroSoundPlayed, setZeroSoundPlayed] = useState(
    () => new Date(payload.eventAtISO).getTime() <= Date.now(),
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Sound on open
  useEffect(() => {
    if (payload.soundEnabled) playSound(payload.soundName);
  }, [payload.soundEnabled, payload.soundName]);

  const eventAt = new Date(payload.eventAtISO).getTime();
  const leadMs = payload.leadMinutes * 60_000;
  const startedAt = eventAt - leadMs;
  const elapsed = now.getTime() - startedAt;
  const remaining = eventAt - now.getTime();
  const past = remaining <= 0;
  const progress = Math.max(0, Math.min(1, elapsed / leadMs));

  // Sound at zero (once)
  useEffect(() => {
    if (past && payload.soundEnabled && !zeroSoundPlayed) {
      playSound(payload.soundName);
      setZeroSoundPlayed(true);
    }
  }, [past, payload.soundEnabled, payload.soundName, zeroSoundPlayed]);

  // Auto-close N minutes after the event
  useEffect(() => {
    if (!past) return;
    const closeAt = eventAt + OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000;
    const closeIn = closeAt - Date.now();
    if (closeIn <= 0) { closeMyself(); return; }
    const id = window.setTimeout(() => closeMyself(), closeIn);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past]);

  // Same color stops drive both the ring and the overlay background.
  // The background uses darker, more saturated variants of the same hue.
  let accent: [number, number, number];
  if (past) accent = RED;
  else if (progress < 0.5) accent = mixTuple(SLATE, AMBER, progress / 0.5);
  else                     accent = mixTuple(AMBER, RED, (progress - 0.5) / 0.5);

  const ringColor = `rgb(${accent.join(" ")})`;
  // Build the bg as a darkened gradient of the accent so text stays readable.
  const dark = darken(accent, 0.55);
  const darker = darken(accent, 0.72);
  const bgStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, rgb(${dark.join(" ")} / 0.94), rgb(${darker.join(" ")} / 0.92))`,
    // Expose accent so ::after border + glow can animate with it.
    ["--accent" as any]: ringColor,
  };

  const showDismiss = past || payload.dismissibleDuringCountdown;

  return (
    <div className="overlay-root" style={bgStyle}>
      <div className="overlay-text">
        <p className="overlay-title">{payload.title}</p>
        {payload.description && <p className="overlay-desc">{payload.description}</p>}
        <p className="overlay-meta">
          <span className="dot" />
          {past ? "Now" : `${eventLocalTime(eventAt)} · ${humanTime(remaining)}`}
        </p>
      </div>

      <div className="overlay-ring">
        <svg viewBox="0 0 80 80">
          <circle className="track" cx="40" cy="40" r={RADIUS}
                  fill="none" strokeWidth="6" />
          <circle className="progress" cx="40" cy="40" r={RADIUS}
                  fill="none" strokeWidth="6"
                  stroke={ringColor}
                  strokeDasharray={CIRC}
                  strokeDashoffset={past ? 0 : CIRC * (1 - progress)} />
        </svg>
        <div className="ring-label">{past ? "Now" : ringText(remaining)}</div>
      </div>

      {showDismiss && (
        <button className="overlay-dismiss" onClick={dismissOverlay} title="Dismiss">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** User dismissal: persist it in Rust so the reminder can't resurrect after
 *  an app restart within its fire window, then close the window. */
async function dismissOverlay(): Promise<void> {
  try { await invoke("dismiss_current_overlay"); } catch {}
  await closeMyself();
}

function ringText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 10) return `${m}m`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function humanTime(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m === 0) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${s}s left`;
  }
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  return `${h}h left`;
}
function eventLocalTime(eventAt: number): string {
  return new Date(eventAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
