import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_ADVANCE_MINUTES } from "@office-reminder/shared";

type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "custom";

const DAYS = [
  { key: "MO", short: "Mon" }, { key: "TU", short: "Tue" }, { key: "WE", short: "Wed" },
  { key: "TH", short: "Thu" }, { key: "FR", short: "Fri" }, { key: "SA", short: "Sat" },
  { key: "SU", short: "Sun" },
] as const;

function buildRrule(rec: Recurrence, customDays: string[]): string | null {
  if (rec === "none") return null;
  switch (rec) {
    case "daily":    return "FREQ=DAILY";
    case "weekdays": return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "weekly":   return "FREQ=WEEKLY";
    case "custom":
      if (customDays.length === 0) return null;
      return `FREQ=WEEKLY;BYDAY=${customDays.join(",")}`;
  }
}

interface AdminTeam { id: string; name: string; }

export default function NewReminderModal({
  userId, prefillTeamId, editReminder, onClose,
}: {
  userId: string;
  prefillTeamId?: string;
  editReminder?: { id: string; title: string; description: string; scheduled_at: string; rrule: string | null; advance_minutes: number; team_id: string };
  onClose: () => void;
}) {
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [teamId, setTeamId] = useState<string>(editReminder?.team_id ?? prefillTeamId ?? "");
  const [title, setTitle] = useState(editReminder?.title ?? "");
  const [description, setDescription] = useState(editReminder?.description ?? "");
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    if (editReminder) {
      const d = new Date(editReminder.scheduled_at);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    }
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [advance, setAdvance] = useState(editReminder?.advance_minutes ?? DEFAULT_ADVANCE_MINUTES);
  
  const [recurrence, setRecurrence] = useState<Recurrence>(() => {
    const r = editReminder?.rrule;
    if (!r) return "none";
    if (r === "FREQ=DAILY") return "daily";
    if (r === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "weekdays";
    if (r === "FREQ=WEEKLY") return "weekly";
    if (r.startsWith("FREQ=WEEKLY;BYDAY=")) return "custom";
    return "none";
  });

  const [customDays, setCustomDays] = useState<string[]>(() => {
    const r = editReminder?.rrule;
    if (!r) return [];
    if (r.startsWith("FREQ=WEEKLY;BYDAY=")) {
      const daysStr = r.substring("FREQ=WEEKLY;BYDAY=".length);
      return daysStr.split(",").filter(Boolean);
    }
    return [];
  });

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("team:teams(id, name)")
        .eq("user_id", userId)
        .eq("role", "admin");
      const adminTeams = (data ?? []).map((r: any) => r.team).filter(Boolean);
      setTeams(adminTeams);
      if (!editReminder && !prefillTeamId && adminTeams.length > 0) setTeamId(adminTeams[0].id);
    })();
  }, [userId, prefillTeamId, editReminder]);

  const rrulePreview = useMemo(
    () => buildRrule(recurrence, customDays),
    [recurrence, customDays]
  );
  const customInvalid = recurrence === "custom" && customDays.length === 0;

  function toggleDay(k: string) {
    setCustomDays((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (!teamId) { setErr("Pick a team."); return; }
    if (customInvalid) { setErr("Pick at least one day."); return; }
    submitting.current = true;
    setSaving(true); setErr(null);
    try {
      const scheduledDate = new Date(scheduledAt);
      if (editReminder) {
        const { error } = await supabase
          .from("reminders")
          .update({
            team_id: teamId,
            title: title.trim(),
            description: description.trim(),
            scheduled_at: scheduledDate.toISOString(),
            rrule: buildRrule(recurrence, customDays),
            advance_minutes: advance,
          })
          .eq("id", editReminder.id);
        if (error) { setErr(error.message); return; }
      } else {
        const { error } = await supabase.from("reminders").insert({
          team_id: teamId,
          title: title.trim(),
          description: description.trim(),
          scheduled_at: scheduledDate.toISOString(),
          rrule: buildRrule(recurrence, customDays),
          advance_minutes: advance,
          audience: "all",
          target_user_ids: [],
          created_by: userId,
        });
        if (error) { setErr(error.message); return; }
      }
      onClose();
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  if (teams.length === 0) {
    return (
      <ModalShell onClose={onClose} title={editReminder ? "Edit reminder" : "New reminder"}>
        <p className="muted">
          You aren't an admin of any team yet. Create a team first (Teams tab) — admins
          can create reminders. If you're a member, ask the team admin.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title={editReminder ? "Edit reminder" : "New reminder"}>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <div>
          <label className="label">Team</label>
          <select className="select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="Daily standup" />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)}
                 placeholder="In the conference room" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="label">Date &amp; time</label>
            <input className="input" type="datetime-local" required
                   value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div>
            <label className="label">Warn (min before)</label>
            <input className="input" type="number" min={0} max={120}
                   value={advance}
                   onChange={(e) => setAdvance(parseInt(e.target.value || "0", 10))} />
          </div>
        </div>
        <div>
          <label className="label">Recurrence</label>
          <select className="select" value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">One-off</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays only (Mon–Fri)</option>
            <option value="weekly">Weekly (same day of week)</option>
            <option value="custom">Custom days…</option>
          </select>
          {recurrence === "custom" && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DAYS.map((d) => {
                const on = customDays.includes(d.key);
                return (
                  <button type="button" key={d.key} onClick={() => toggleDay(d.key)}
                          style={{
                            padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                            border: `1px solid ${on ? "rgb(var(--brand))" : "rgb(var(--border))"}`,
                            background: on ? "rgb(var(--brand))" : "rgb(var(--surface))",
                            color: on ? "rgb(var(--brand-fg))" : "rgb(var(--fg))",
                            cursor: "pointer",
                          }}>
                    {d.short}
                  </button>
                );
              })}
            </div>
          )}
          {rrulePreview && (
            <p className="hint" style={{ fontFamily: "ui-monospace, monospace" }}>
              RRULE: {rrulePreview}
            </p>
          )}
        </div>
        {err && <p className="error">{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || customInvalid}>
            {saving ? "Saving…" : (editReminder ? "Save changes" : "Create reminder")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgb(0 0 0 / 0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: "rgb(var(--surface))",
        border: "1px solid rgb(var(--border))",
        borderRadius: 14,
        padding: 22, width: "100%", maxWidth: 460,
        boxShadow: "0 24px 48px -12px rgb(0 0 0 / 0.4)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 className="h2">{title}</h2>
          <button className="btn btn-ghost" onClick={onClose}
                  style={{ padding: 4, width: 28, height: 28 }}
                  aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
