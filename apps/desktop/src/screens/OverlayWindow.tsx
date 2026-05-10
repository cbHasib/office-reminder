import { useEffect, useMemo, useState } from "react";
import { closeMyself, type OverlayPayload } from "@/lib/overlayController";
import { OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES } from "@office-reminder/shared";

function readPayload(): OverlayPayload | null {
  try {
    const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    return JSON.parse(raw) as OverlayPayload;
  } catch { return null; }
}

/** Linear interpolation between two hex colors, t in [0,1]. */
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((ch, i) => Math.round(ch + (b[i] - ch) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const SLATE  : [number, number, number] = [31, 41, 55];   // #1f2937
const AMBER  : [number, number, number] = [217, 119, 6];  // #d97706
const RED    : [number, number, number] = [220, 38, 38];  // #dc2626

export default function OverlayWindow() {
  const payload = useMemo(readPayload, []);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Optional chime
  useEffect(() => {
    if (!payload?.soundEnabled) return;
    playChime();
  }, [payload]);

  if (!payload) {
    return <div className="overlay-root" style={{ background: mix(SLATE, SLATE, 0) }}>
      <p className="overlay-title">Missing reminder payload</p>
    </div>;
  }

  const eventAt = new Date(payload.eventAtISO);
  const diffMs = eventAt.getTime() - now.getTime();
  const past = diffMs <= 0;

  // Color progress: from "lead time" → 0, interpolate slate→amber→red
  // We don't know the original lead from inside the overlay, but the
  // overlay was opened exactly when (eventAt - lead) hit; so progress
  // since open is (timeOpen / leadOriginal). We approximate using a
  // simple rule: the LAST 60 seconds are full red; before that we ramp.
  let bg: string;
  if (past) {
    // Hold red, then start fading toward neutral as auto-close approaches.
    const sincePastMs = -diffMs;
    const fadeWindow = OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000;
    const t = Math.min(1, sincePastMs / fadeWindow);
    bg = mix(RED, SLATE, t * 0.4); // gentle fade
  } else if (diffMs <= 60_000) {
    bg = `rgb(${RED[0]}, ${RED[1]}, ${RED[2]})`;
  } else if (diffMs <= 5 * 60_000) {
    // 5min → 1min: amber → red
    const t = 1 - ((diffMs - 60_000) / (4 * 60_000));
    bg = mix(AMBER, RED, t);
  } else {
    // before 5min: slate → amber, capped
    const t = Math.min(1, (15 * 60_000 - diffMs) / (10 * 60_000));
    bg = mix(SLATE, AMBER, Math.max(0, t));
  }

  // Dismissibility: hidden during countdown if user setting says so
  const showDismiss = past || payload.dismissibleDuringCountdown;

  // Auto close after N minutes past event. Only depend on `past` so the
  // timeout is set up once when the event fires, not re-created every tick.
  useEffect(() => {
    if (!past) return;
    const eventMs = eventAt.getTime();
    const closeAt = eventMs + OVERLAY_AUTO_CLOSE_AFTER_FIRE_MINUTES * 60_000;
    const closeIn = closeAt - Date.now();
    if (closeIn <= 0) { closeMyself(); return; }
    const id = window.setTimeout(() => closeMyself(), closeIn);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past]);

  return (
    <div className="overlay-root" style={{ background: bg }}>
      <div>
        <p className="overlay-title">{payload.title}</p>
        {payload.description && <p className="overlay-desc">{payload.description}</p>}
      </div>
      <div className="overlay-bottom">
        <div className="overlay-time">{past ? "Now" : formatRemaining(diffMs)}</div>
        {showDismiss && (
          <button className="overlay-dismiss" onClick={closeMyself}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function playChime() {
  // A short tone via the Web Audio API — no asset file required
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.start();
    o.stop(ctx.currentTime + 0.7);
  } catch {}
}
