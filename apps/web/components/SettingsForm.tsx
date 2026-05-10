"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  type UserSettings, type OverlayPosition, type SoundName,
  OVERLAY_POSITION_LABELS, SOUND_LABELS,
} from "@office-reminder/shared";
import { previewSound } from "./soundPreview";

export default function SettingsForm({ initial }: { initial: UserSettings }) {
  const supabase = createClient();
  const [s, setS] = useState<UserSettings>(initial);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_settings")
      .upsert({ ...s, user_id: user!.id });
    setSaving(false);
    if (error) setError(error.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  }

  return (
    <div className="space-y-6">
      <Section title="Overlay" hint="What pops up on screen when a reminder fires.">
        <Field label="Position on screen"
               hint="Where the countdown card appears.">
          <select className="select"
                  value={s.overlay_position}
                  onChange={(e) => setS({ ...s, overlay_position: e.target.value as OverlayPosition })}>
            {Object.entries(OVERLAY_POSITION_LABELS).map(([v, l]) =>
              <option key={v} value={v}>{l}</option>
            )}
          </select>
        </Field>
        <Toggle label="Allow dismissing during countdown"
                hint="When off, the close button is hidden until the event time has passed. Default: off."
                checked={s.dismissible}
                onChange={(v) => setS({ ...s, dismissible: v })} />
      </Section>

      <Section title="Sound" hint="Plays when the overlay appears, and again at zero.">
        <Toggle label="Play sound"
                hint="Default: off."
                checked={s.sound_enabled}
                onChange={(v) => setS({ ...s, sound_enabled: v })} />
        <Field label="Sound choice">
          <div className="flex gap-2">
            <select className="select"
                    disabled={!s.sound_enabled}
                    value={s.sound_name}
                    onChange={(e) => setS({ ...s, sound_name: e.target.value as SoundName })}>
              {Object.entries(SOUND_LABELS).map(([v, l]) =>
                <option key={v} value={v}>{l}</option>
              )}
            </select>
            <button type="button" className="btn-secondary shrink-0"
                    disabled={!s.sound_enabled}
                    onClick={() => previewSound(s.sound_name)}>
              Preview
            </button>
          </div>
        </Field>
      </Section>

      <Section title="Timing" hint="When and how often the countdown appears.">
        <Field label="Override advance-warning minutes"
               hint="Leave blank to follow each reminder's own setting. Set a number to override every reminder.">
          <input className="input" type="number" min={0} max={120}
                 value={s.advance_minutes_override ?? ""}
                 placeholder="(use the reminder's setting)"
                 onChange={(e) => {
                   const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                   setS({ ...s, advance_minutes_override: v });
                 }} />
        </Field>
      </Section>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-success">Saved</span>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hint && <p className="text-xs text-subtle mt-0.5">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span
        className={`relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full transition
                    ${checked ? "bg-brand" : "bg-border"}`}
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition
                         ${checked ? "left-4" : "left-0.5"}`} />
      </span>
      <span>
        <span className="text-sm font-medium block">{label}</span>
        {hint && <span className="text-xs text-subtle block mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}
