"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@office-reminder/shared";

export default function SettingsForm({ initial }: { initial: UserSettings | null }) {
  const supabase = createClient();
  const [s, setS] = useState({
    sound_enabled: initial?.sound_enabled ?? DEFAULT_USER_SETTINGS.sound_enabled,
    dismissible: initial?.dismissible ?? DEFAULT_USER_SETTINGS.dismissible,
    advance_minutes_override: initial?.advance_minutes_override ?? null,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user!.id, ...s });
    setSaving(false);
    if (error) setError(error.message); else { setSaved(true); setTimeout(() => setSaved(false), 1800); }
  }

  return (
    <div className="card space-y-5">
      <Toggle label="Notification sound"
              hint="Plays a soft chime when the overlay appears and again at zero. Default: off."
              checked={s.sound_enabled}
              onChange={(v) => setS({ ...s, sound_enabled: v })} />
      <Toggle label="Allow dismissing the overlay during the countdown"
              hint="When off, the close button is hidden until the event time has passed. Default: off."
              checked={s.dismissible}
              onChange={(v) => setS({ ...s, dismissible: v })} />
      <div>
        <label className="label">Override advance-warning minutes</label>
        <input className="input" type="number" min={0} max={120}
               value={s.advance_minutes_override ?? ""}
               placeholder="Use the reminder's own setting"
               onChange={(e) => {
                 const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                 setS({ ...s, advance_minutes_override: v });
               }} />
        <p className="text-xs text-ink-500 mt-1">
          Leave blank to respect each reminder's setting. Set a number to override every reminder.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand"
             checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div className="text-sm font-medium text-ink-900">{label}</div>
        {hint && <div className="text-xs text-ink-500 mt-0.5">{hint}</div>}
      </div>
    </label>
  );
}
