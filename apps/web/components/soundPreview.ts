/* Web Audio synthesis of the five built-in sounds. Same code lives in the
   desktop app — we keep them in sync by hand for now (small, stable).        */
import type { SoundName } from "@office-reminder/shared";

export function previewSound(name: SoundName): void {
  try { playSound(name); } catch {}
}

function playSound(name: SoundName) {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new Ctx();
  const recipe = RECIPES[name];
  recipe(ctx);
}

const RECIPES: Record<SoundName, (ctx: AudioContext) => void> = {
  chime: (ctx) => {
    tone(ctx, 660, 0.0, 0.18, 0.35, "sine");
    tone(ctx, 880, 0.18, 0.18, 0.45, "sine");
  },
  bell: (ctx) => {
    tone(ctx, 880, 0.0, 0.25, 0.9, "triangle");
  },
  ding: (ctx) => {
    tone(ctx, 1320, 0.0, 0.10, 0.25, "sine");
  },
  soft: (ctx) => {
    tone(ctx, 392, 0.0, 0.30, 0.8, "sine");
    tone(ctx, 523, 0.10, 0.30, 0.8, "sine");
  },
  alert: (ctx) => {
    tone(ctx, 988, 0.00, 0.10, 0.25, "square");
    tone(ctx, 988, 0.18, 0.10, 0.25, "square");
    tone(ctx, 988, 0.36, 0.10, 0.25, "square");
  },
};

function tone(
  ctx: AudioContext,
  freq: number, startOffset: number, attack: number, total: number,
  type: OscillatorType,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.18, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + total);
  o.start(t0);
  o.stop(t0 + total + 0.05);
}
