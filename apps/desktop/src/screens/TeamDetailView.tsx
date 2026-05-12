import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { generateJoinCode } from "@office-reminder/shared";

interface TeamFull {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
  created_by: string;
}

interface MemberRow {
  role: "admin" | "member";
  joined_at: string;
  user: { id: string; display_name: string | null; email: string };
}

interface RequestRow {
  id: string;
  message: string | null;
  created_at: string;
  // user can be null if RLS hides the user row — we render a fallback below.
  user: { id: string; display_name: string | null; email: string } | null;
}

interface ReminderRow {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  rrule: string | null;
  advance_minutes: number;
}

export default function TeamDetailView({
  teamId, session, onBack, onNewReminder,
}: {
  teamId: string;
  session: Session;
  onBack: () => void;
  onNewReminder: (teamId: string) => void;
}) {
  const [team, setTeam] = useState<TeamFull | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const myMembership = members.find((m) => m.user.id === session.user.id);
  const isAdmin = myMembership?.role === "admin";

  async function refresh() {
    const [{ data: t }, { data: ms }, { data: rawReqs }, { data: rms }] = await Promise.all([
      supabase
        .from("teams")
        .select("id, name, join_code, require_approval, created_by")
        .eq("id", teamId)
        .single(),
      supabase
        .from("team_members")
        .select("role, joined_at, user:users(id, display_name, email)")
        .eq("team_id", teamId),
      // Two-step fetch for requests so we don't depend on PostgREST embed
      // RLS behavior. Step 1: raw rows.
      supabase
        .from("join_requests")
        .select("id, user_id, message, created_at")
        .eq("team_id", teamId)
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("reminders")
        .select("id, title, description, scheduled_at, rrule, advance_minutes")
        .eq("team_id", teamId)
        .order("scheduled_at", { ascending: true }),
    ]);

    // Step 2: fetch requester user rows separately (no inner join trap).
    let requestsWithUsers: any[] = [];
    const reqList = rawReqs ?? [];
    if (reqList.length > 0) {
      const ids = Array.from(new Set(reqList.map((r: any) => r.user_id)));
      const { data: users } = await supabase
        .from("users")
        .select("id, display_name, email")
        .in("id", ids);
      const map = new Map<string, any>();
      (users ?? []).forEach((u: any) => map.set(u.id, u));
      requestsWithUsers = reqList.map((r: any) => ({
        id: r.id,
        message: r.message,
        created_at: r.created_at,
        user: map.get(r.user_id) ?? null,
      }));
    }

    setTeam(t as any);
    setMembers((ms ?? []) as any);
    setRequests(requestsWithUsers);
    setReminders((rms ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const chan = supabase.channel(`rt-team-${teamId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members", filter: `team_id=eq.${teamId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests", filter: `team_id=eq.${teamId}` }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders",    filter: `team_id=eq.${teamId}` }, () => refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teams" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loading || !team) {
    return (
      <div>
        <BackBar onBack={onBack} />
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <BackBar onBack={onBack} />
      <Header team={team} isAdmin={isAdmin} />

      {isAdmin && team.require_approval && (
        <>
          <p className="section-title">
            Pending requests {requests.length > 0 && <span style={{ color: "rgb(var(--fg))" }}>({requests.length})</span>}
          </p>
          <RequestsPanel teamId={team.id} requests={requests} onChange={refresh} />
        </>
      )}

      <p className="section-title">Members</p>
      <MembersPanel
        team={team}
        members={members}
        currentUserId={session.user.id}
        isAdmin={isAdmin}
        onChange={refresh}
      />

      <p className="section-title">
        Reminders {isAdmin && (
          <button
            className="btn btn-primary"
            onClick={() => onNewReminder(team.id)}
            style={{ float: "right", fontSize: 12, padding: "4px 10px", marginTop: -2 }}
          >
            + New
          </button>
        )}
      </p>
      <RemindersPanel reminders={reminders} canEdit={isAdmin} onChange={refresh} />

      {isAdmin ? (
        <>
          <p className="section-title">Team settings</p>
          <SettingsPanel team={team} onChange={refresh} onDeleted={onBack} />
        </>
      ) : (
        <>
          <p className="section-title">Membership</p>
          <LeavePanel team={team} userId={session.user.id} onLeft={onBack} />
        </>
      )}
    </div>
  );
}

/* ────────────────────────────── sub-components ────────────────────────────── */

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button className="btn btn-ghost" onClick={onBack}
            style={{ marginBottom: 12, paddingLeft: 4, paddingRight: 8, fontSize: 13 }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 2L4 7l5 5" />
      </svg>
      <span>Back to Teams</span>
    </button>
  );
}

function Header({ team, isAdmin }: { team: TeamFull; isAdmin: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(team.join_code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  return (
    <header style={{ marginBottom: 6 }}>
      <h1 className="h1">{team.name}</h1>
      <div className="muted" style={{ marginTop: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>Code</span>
        <button onClick={copy}
                title="Copy join code"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  padding: "2px 8px", borderRadius: 6, fontSize: 12,
                  background: "rgb(var(--muted))", color: "rgb(var(--fg))",
                  border: "1px solid rgb(var(--border))", cursor: "pointer",
                }}>
          {team.join_code} {copied ? "✓" : ""}
        </button>
        {team.require_approval && (
          <span style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 11,
            background: "rgb(var(--warning) / 0.15)", color: "rgb(var(--warning))",
            border: "1px solid rgb(var(--warning) / 0.3)",
          }}>Approval required</span>
        )}
        <span>· You are <strong style={{ color: "rgb(var(--fg))" }}>{isAdmin ? "an admin" : "a member"}</strong></span>
      </div>
    </header>
  );
}

function RequestsPanel({ teamId, requests, onChange }: {
  teamId: string; requests: RequestRow[]; onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const { error } = await supabase.from("join_requests").update({ status }).eq("id", id);
    setBusy(null);
    if (error) { alert(error.message); return; }
    onChange();
  }

  if (requests.length === 0) {
    return <div className="card" style={{ padding: 14 }}><p className="muted" style={{ margin: 0 }}>No pending requests.</p></div>;
  }

  return (
    <div className="card" style={{ padding: "4px 18px" }}>
      {requests.map((r) => {
        const name  = r.user?.display_name ?? r.user?.email ?? "Pending user";
        const email = r.user?.email ?? "(profile hidden)";
        return (
        <div key={r.id} className="upcoming-item">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{name}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              {email} · {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
            {r.message && <p className="muted" style={{ margin: "4px 0 0", fontSize: 12, fontStyle: "italic" }}>"{r.message}"</p>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-secondary" disabled={busy === r.id}
                    onClick={() => resolve(r.id, "rejected")}
                    style={{ fontSize: 12 }}>Reject</button>
            <button className="btn btn-primary" disabled={busy === r.id}
                    onClick={() => resolve(r.id, "approved")}
                    style={{ fontSize: 12 }}>
              {busy === r.id ? "…" : "Approve"}
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}

function MembersPanel({
  team, members, currentUserId, isAdmin, onChange,
}: {
  team: TeamFull; members: MemberRow[]; currentUserId: string;
  isAdmin: boolean; onChange: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function setRole(userId: string, role: "admin" | "member") {
    setBusy(userId);
    const { error } = await supabase.from("team_members")
      .update({ role }).eq("team_id", team.id).eq("user_id", userId);
    setBusy(null);
    if (error) { alert(error.message); return; }
    onChange();
  }
  async function remove(userId: string, name: string) {
    if (userId === team.created_by) { alert("The team owner can't be removed."); return; }
    if (!confirm(`Remove ${name} from the team?`)) return;
    setBusy(userId);
    const { error } = await supabase.from("team_members")
      .delete().eq("team_id", team.id).eq("user_id", userId);
    setBusy(null);
    if (error) { alert(error.message); return; }
    onChange();
  }

  return (
    <div className="card" style={{ padding: "4px 18px" }}>
      {members.map((m) => {
        const isOwner = m.user.id === team.created_by;
        const isSelf  = m.user.id === currentUserId;
        const name    = m.user.display_name ?? m.user.email;
        return (
          <div key={m.user.id} className="upcoming-item">
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>
                {name}
                {isOwner && <span style={{ marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgb(var(--muted))" }}>Owner</span>}
                {isSelf && !isOwner && <span style={{ marginLeft: 8, fontSize: 10, color: "rgb(var(--subtle))" }}>(you)</span>}
              </p>
              <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
                {m.user.email} · {m.role}
              </p>
            </div>
            {isAdmin && !isOwner && !isSelf && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {m.role === "member" ? (
                  <button className="btn btn-secondary" disabled={busy === m.user.id}
                          onClick={() => setRole(m.user.id, "admin")}
                          style={{ fontSize: 12 }}>Promote</button>
                ) : (
                  <button className="btn btn-secondary" disabled={busy === m.user.id}
                          onClick={() => setRole(m.user.id, "member")}
                          style={{ fontSize: 12 }}>Demote</button>
                )}
                <button className="btn btn-secondary" disabled={busy === m.user.id}
                        onClick={() => remove(m.user.id, name)}
                        style={{ fontSize: 12, color: "rgb(var(--danger))" }}>Remove</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RemindersPanel({
  reminders, canEdit, onChange,
}: { reminders: ReminderRow[]; canEdit: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function del(id: string) {
    if (!confirm("Delete this reminder?")) return;
    setBusy(id);
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    setBusy(null);
    if (error) { alert(error.message); return; }
    onChange();
  }

  if (reminders.length === 0) {
    return <div className="card" style={{ padding: 14 }}><p className="muted" style={{ margin: 0 }}>No reminders yet.</p></div>;
  }

  return (
    <div className="card" style={{ padding: "4px 18px" }}>
      {reminders.map((r) => (
        <div key={r.id} className="upcoming-item">
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{r.title}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              {new Date(r.scheduled_at).toLocaleString()}
              {" · "}{r.advance_minutes}m lead
              {r.rrule && " · repeats"}
            </p>
            {r.description && <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>{r.description}</p>}
          </div>
          {canEdit && (
            <button className="btn btn-secondary" disabled={busy === r.id}
                    onClick={() => del(r.id)}
                    style={{ fontSize: 12, color: "rgb(var(--danger))" }}>Delete</button>
          )}
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({
  team, onChange, onDeleted,
}: { team: TeamFull; onChange: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(team.name);
  const [requireApproval, setRequireApproval] = useState(team.require_approval);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submitting = useRef(false);

  async function save() {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true); setErr(null);
    try {
      const { error } = await supabase.from("teams")
        .update({ name: name.trim(), require_approval: requireApproval })
        .eq("id", team.id);
      if (error) { setErr(error.message); return; }
      setSavedAt(Date.now());
      onChange();
    } finally { setSaving(false); submitting.current = false; }
  }

  async function regen() {
    if (!confirm("Generate a new join code? The old one will stop working immediately.")) return;
    for (let i = 0; i < 5; i++) {
      const code = generateJoinCode();
      const { error } = await supabase.from("teams").update({ join_code: code }).eq("id", team.id);
      if (!error) { onChange(); return; }
      if (error.code !== "23505") { alert(error.message); return; }
    }
    alert("Couldn't generate a unique code.");
  }

  async function del() {
    const c = prompt(`Type "${team.name}" to permanently delete this team and all its reminders.`);
    if (c !== team.name) {
      if (c !== null) alert("Name didn't match — nothing deleted.");
      return;
    }
    const { error } = await supabase.from("teams").delete().eq("id", team.id);
    if (error) { alert(error.message); return; }
    onDeleted();
  }

  return (
    <>
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <label className="label">Team name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Join code</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input"
                   style={{ fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.15em" }}
                   value={team.join_code} readOnly />
            <button type="button" className="btn btn-secondary" onClick={regen}>Regenerate</button>
          </div>
        </div>
        <Toggle
          label="Require admin approval to join"
          hint="When on, new join requests appear at the top for you to approve or reject."
          checked={requireApproval}
          onChange={setRequireApproval}
        />
        {err && <p className="error" style={{ marginTop: 12 }}>{err}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", marginTop: 14 }}>
          {savedAt && <span className="success" style={{ fontSize: 12 }}>Saved</span>}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="card" style={{ borderColor: "rgb(var(--danger) / 0.4)" }}>
        <p style={{ margin: 0, fontWeight: 600, color: "rgb(var(--danger))", fontSize: 13 }}>
          Danger zone
        </p>
        <p className="muted" style={{ margin: "4px 0 12px", fontSize: 12 }}>
          Deleting removes all reminders and members. This cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" onClick={del}
                  style={{ background: "rgb(var(--danger))", color: "white", fontSize: 12 }}>
            Delete team…
          </button>
        </div>
      </div>
    </>
  );
}

function LeavePanel({ team, userId, onLeft }: { team: TeamFull; userId: string; onLeft: () => void }) {
  const [busy, setBusy] = useState(false);
  async function leave() {
    if (!confirm(`Leave "${team.name}"? You'll stop receiving its reminders.`)) return;
    setBusy(true);
    const { error } = await supabase.from("team_members")
      .delete().eq("team_id", team.id).eq("user_id", userId);
    setBusy(false);
    if (error) { alert(error.message); return; }
    onLeft();
  }
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 500 }}>Leave this team</p>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            You can rejoin later if you still have the join code.
          </p>
        </div>
        <button className="btn btn-secondary" disabled={busy} onClick={leave}>
          {busy ? "Leaving…" : "Leave team"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)} style={{ paddingTop: 4 }}>
      <span className={`switch ${checked ? "on" : ""}`} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{label}</span>
        {hint && <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>{hint}</span>}
      </span>
    </div>
  );
}
