"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { generateJoinCode } from "@office-reminder/shared";

interface TeamLite {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
  created_by: string;
}

export default function TeamSettingsForm({ team }: { team: TeamLite }) {
  const supabase = createClient();
  const router = useRouter();
  const submitting = useRef(false);

  const [name, setName] = useState(team.name);
  const [code, setCode] = useState(team.join_code);
  const [requireApproval, setRequireApproval] = useState(team.require_approval);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          name: name.trim(),
          require_approval: requireApproval,
        })
        .eq("id", team.id);
      if (error) { setErr(error.message); return; }
      setSavedAt(Date.now());
      router.refresh();
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  async function regenCode() {
    if (!confirm("Generate a new join code? The old code will stop working immediately.")) return;
    // Try a few times to avoid collisions.
    for (let i = 0; i < 5; i++) {
      const newCode = generateJoinCode();
      const { error } = await supabase
        .from("teams").update({ join_code: newCode }).eq("id", team.id);
      if (!error) { setCode(newCode); router.refresh(); return; }
      if (error.code !== "23505") { alert(error.message); return; }
    }
    alert("Couldn't generate a unique code — try again.");
  }

  async function deleteTeam() {
    const confirmName = prompt(
      `This permanently deletes "${team.name}", its reminders, and all members.\n\nType the team name to confirm:`
    );
    if (confirmName !== team.name) {
      if (confirmName !== null) alert("Name didn't match — nothing deleted.");
      return;
    }
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) { alert(error.message); return; }
    router.push("/dashboard/teams");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold">General</h2>

        <div>
          <label className="label">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Join code</label>
          <div className="flex gap-2">
            <input className="input font-mono uppercase tracking-widest" value={code} readOnly />
            <button type="button" className="btn-secondary shrink-0" onClick={regenCode}>
              Regenerate
            </button>
          </div>
          <p className="hint">Share this with new members. Regenerating invalidates the old one.</p>
        </div>

        <Toggle
          label="Require admin approval to join"
          hint="When on, new join requests show up in the Members tab for you to approve or reject."
          checked={requireApproval}
          onChange={setRequireApproval}
        />

        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {savedAt && <span className="text-sm text-success">Saved</span>}
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      <section className="card card-pad space-y-4 border-danger/40">
        <h2 className="text-base font-semibold text-danger">Danger zone</h2>
        <p className="text-sm text-subtle">
          Deleting the team removes all its reminders and members. This cannot be undone.
        </p>
        <div className="flex justify-end">
          <button className="btn-danger" onClick={deleteTeam}>Delete team…</button>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <span className={`relative mt-0.5 inline-block h-5 w-9 shrink-0 rounded-full transition
                        ${checked ? "bg-brand" : "bg-border"}`}
            onClick={() => onChange(!checked)}>
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
