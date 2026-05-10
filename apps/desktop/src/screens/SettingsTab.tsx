import { useEffect, useState } from "react";
import {
  type UserSettings, type Theme, type OverlayPosition, type SoundName,
  OVERLAY_POSITION_LABELS, SOUND_LABELS,
} from "@office-reminder/shared";
import { playSound } from "@/lib/sounds";
import { applyTheme } from "@/lib/theme";
import { getAutostartEnabled, setAutostartEnabled } from "@/lib/autostart";

export default function SettingsTab({
  settings, onUpdate,
}: {
  settings: UserSettings | null;
  onUpdate: (patch: Partial<UserSettings>) => Promise<void>;
}) {
  const [autostart, setAutostart] = useState<boolean | null>(null);
  useEffect(() => { getAutostartEnabled().then(setAutostart); }, []);

  if (!settings) {
    return <p className="muted">Loading settings…</p>;
  }

  function setTheme(t: Theme) {
    applyTheme(t);
    onUpdate({ theme: t });
  }

  async function toggleAutostart(on: boolean) {
    setAutostart(on);
    await setAutostartEnabled(on);
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="h1">Settings</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Changes save instantly and sync across all your devices.
        </p>
      </header>

      <p className="section-title">Appearance</p>
      <div className="card">
        <Field label="Theme">
          <ThemeSegmented value={settings.theme} onChange={setTheme} />
        </Field>
      </div>

      <p className="section-title">Overlay</p>
      <div className="card">
        <Field label="Position on screen"
               hint="Where the countdown card appears.">
          <select className="select"
                  value={settings.overlay_position}
                  onChange={(e) => onUpdate({ overlay_position: e.target.value as OverlayPosition })}>
            {Object.entries(OVERLAY_POSITION_LABELS).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </Field>
        <ToggleRow
          label="Allow dismissing during countdown"
          hint="When off, the close button is hidden until the event time has passed. Default: off."
          checked={settings.dismissible}
          onChange={(v) => onUpdate({ dismissible: v })}
        />
      </div>

      <p className="section-title">Sound</p>
      <div className="card">
        <ToggleRow
          label="Play sound"
          hint="A short chime when the overlay opens, and again at zero. Default: off."
          checked={settings.sound_enabled}
          onChange={(v) => onUpdate({ sound_enabled: v })}
        />
        <Field label="Sound choice">
          <div style={{ display: "flex", gap: 8 }}>
            <select className="select"
                    disabled={!settings.sound_enabled}
                    value={settings.sound_name}
                    onChange={(e) => onUpdate({ sound_name: e.target.value as SoundName })}>
              {Object.entries(SOUND_LABELS).map(([v, l]) =>
                <option key={v} value={v}>{l}</option>
              )}
            </select>
            <button className="btn btn-secondary"
                    disabled={!settings.sound_enabled}
                    onClick={() => playSound(settings.sound_name)}>
              Preview
            </button>
          </div>
        </Field>
      </div>

      <p className="section-title">Timing</p>
      <div className="card">
        <Field label="Override advance-warning minutes"
               hint="Leave blank to follow each reminder's setting. Set a number to override every reminder.">
          <input className="input" type="number" min={0} max={120}
                 value={settings.advance_minutes_override ?? ""}
                 placeholder="(use the reminder's setting)"
                 onChange={(e) => {
                   const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                   onUpdate({ advance_minutes_override: v });
                 }} />
        </Field>
      </div>

      <p className="section-title">Startup</p>
      <div className="card">
        <ToggleRow
          label="Launch automatically when I log in"
          hint="Office Reminder will start in the background so you never miss a reminder."
          checked={!!autostart}
          onChange={toggleAutostart}
        />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label, hint, checked, onChange,
}: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)}
         style={{ paddingTop: 8, paddingBottom: 4 }}>
      <span className={`switch ${checked ? "on" : ""}`} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{label}</span>
        {hint && <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{hint}</span>}
      </span>
    </div>
  );
}

function ThemeSegmented({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  const opts: { v: Theme; label: string }[] = [
    { v: "system", label: "Auto" },
    { v: "light",  label: "Light" },
    { v: "dark",   label: "Dark" },
  ];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      gap: 4, padding: 4, borderRadius: 10,
      border: "1px solid rgb(var(--border))",
      background: "rgb(var(--bg))",
    }}>
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button key={o.v}
                  onClick={() => onChange(o.v)}
                  style={{
                    padding: "6px 10px", border: 0, borderRadius: 7,
                    fontSize: 13, fontWeight: 500, cursor: "pointer",
                    background: active ? "rgb(var(--surface))" : "transparent",
                    color: active ? "rgb(var(--fg))" : "rgb(var(--subtle))",
                    boxShadow: active ? "0 1px 2px rgb(0 0 0 / 0.06)" : "none",
                    transition: "all .15s ease",
                  }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
