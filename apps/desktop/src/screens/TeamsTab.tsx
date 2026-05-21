import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { generateJoinCode } from "@office-reminder/shared";
import TeamDetailView from "./TeamDetailView";

interface TeamLite {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
}
interface Membership { role: "admin" | "member"; team: TeamLite; }
interface MyRequest { id: string; status: string; created_at: string; team: TeamLite; }

export default function TeamsTab({
  session, onPick, onEdit,
}: {
  session: Session;
  onPick?: (teamId: string) => void;
  onEdit?: (reminder: any) => void;
}) {
  const userId = session.user.id;
  const [teams, setTeams] = useState<Membership[]>([]);
  const [myReqs, setMyReqs] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  async function refresh() {
    const [{ data: ms }, { data: rs }] = await Promise.all([
      supabase
        .from("team_members")
        .select("role, team:teams(id, name, join_code, require_approval)")
        .eq("user_id", userId),
      supabase
        .from("join_requests")
        .select("id, status, created_at, team:teams(id, name, join_code, require_approval)")
        .eq("user_id", userId)
        .eq("status", "pending"),
    ]);
    setTeams((ms ?? []) as any);
    setMyReqs((rs ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const chan = supabase.channel(`rt-teams-${userId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "team_members", filter: `user_id=eq.${userId}` },
          () => refresh())
      .on("postgres_changes",
          { event: "*", schema: "public", table: "join_requests", filter: `user_id=eq.${userId}` },
          () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [userId]);

  // Drill-in view for a single team
  if (openTeamId) {
    return (
      <TeamDetailView
        teamId={openTeamId}
        session={session}
        onBack={() => { setOpenTeamId(null); refresh(); }}
        onNewReminder={(id) => onPick?.(id)}
        onEditReminder={(r) => onEdit?.({ ...r, team_id: openTeamId })}
      />
    );
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="h1">Teams</h1>
        <p className="muted" style={{ marginTop: 4 }}>Create a team or join one with a 6-character code.</p>
      </header>

      <p className="section-title">Your teams</p>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 24 }}>
          <p className="muted" style={{ margin: 0 }}>You're not in any teams yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: "4px 18px" }}>
          {teams.map((m) => (
            <TeamRow key={m.team.id} m={m}
                     onOpen={() => setOpenTeamId(m.team.id)}
                     session={session} onPick={onPick} onChange={refresh} />
          ))}
        </div>
      )}

      {myReqs.length > 0 && (
        <>
          <p className="section-title">Pending requests</p>
          <div className="card" style={{ padding: "4px 18px" }}>
            {myReqs.map((r) => (
              <PendingRow key={r.id} r={r} onChange={refresh} />
            ))}
          </div>
        </>
      )}

      <p className="section-title">Create a team</p>
      <div className="card">
        <CreateTeamForm userId={userId} onCreated={refresh} />
      </div>

      <p className="section-title">Join a team</p>
      <div className="card">
        <JoinTeamForm userId={userId} onChanged={refresh} />
      </div>
    </div>
  );
}

function TeamRow({ m, session, onPick, onOpen, onChange }: {
  m: Membership; session: Session;
  onPick?: (teamId: string) => void;
  onOpen: () => void;
  onChange: () => void;
}) {
  // Make the whole row clickable to drill in, but keep the buttons working
  // by stopping propagation on their own clicks.
  void session;
  void onChange;

  return (
    <div className="upcoming-item"
         style={{ cursor: "pointer" }}
         onClick={onOpen}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{m.team.name}</p>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
          Code <span style={{ fontFamily: "ui-monospace, monospace" }}>{m.team.join_code}</span>
          {" · "}<span style={{ textTransform: "capitalize" }}>{m.role}</span>
          {m.team.require_approval && " · approval required"}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {onPick && m.role === "admin" && (
          <button className="btn btn-secondary"
                  onClick={(e) => { e.stopPropagation(); onPick(m.team.id); }}
                  style={{ fontSize: 12 }}>
            + Reminder
          </button>
        )}
        <button className="btn btn-secondary"
                onClick={(e) => { e.stopPropagation(); onOpen(); }}
                style={{ fontSize: 12 }}>
          Manage
        </button>
      </div>
    </div>
  );
}

function PendingRow({ r, onChange }: { r: MyRequest; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (!confirm(`Cancel your request to join "${r.team.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("join_requests")
      .update({ status: "cancelled" })
      .eq("id", r.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    onChange();
  }
  return (
    <div className="upcoming-item">
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{r.team.name}</p>
        <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
          Pending · {new Date(r.created_at).toLocaleDateString()}
        </p>
      </div>
      <button className="btn btn-secondary" disabled={busy} onClick={cancel} style={{ fontSize: 12 }}>
        Cancel
      </button>
    </div>
  );
}

function CreateTeamForm({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setErr(null);
    try {
      let inserted: any = null;
      let lastErr: any = null;
      for (let i = 0; i < 5 && !inserted; i++) {
        const join_code = generateJoinCode();
        const { data, error } = await supabase
          .from("teams")
          .insert({ name: name.trim(), join_code, created_by: userId })
          .select()
          .single();
        if (error && error.code === "23505") continue;
        lastErr = error; inserted = data; break;
      }
      if (!inserted) { setErr(lastErr?.message ?? "Could not create team"); return; }
      setName("");
      onCreated();
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <div>
        <label className="label">Team name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="Acme HQ" required />
      </div>
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary" disabled={loading || !name.trim()}>
        {loading ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}

function JoinTeamForm({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setErr(null); setInfo(null);
    try {
      const upper = code.trim().toUpperCase();
      const { data: team, error: lookErr } = await supabase
        .from("teams").select("id, name, require_approval").eq("join_code", upper).single();
      if (lookErr || !team) { setErr("No team with that code."); return; }

      const { data: existing } = await supabase
        .from("team_members").select("team_id")
        .eq("team_id", team.id).eq("user_id", userId).maybeSingle();
      if (existing) { setInfo(`You're already in ${team.name}.`); return; }

      if (team.require_approval) {
        const { error } = await supabase
          .from("join_requests")
          .insert({ team_id: team.id, user_id: userId, message: message.trim() || null });
        if (error) {
          if (error.code === "23505") setInfo(`Request already pending for ${team.name}.`);
          else setErr(error.message);
          return;
        }
        setCode(""); setMessage("");
        setInfo(`Request sent to ${team.name}.`);
      } else {
        const { error } = await supabase
          .from("team_members")
          .insert({ team_id: team.id, user_id: userId, role: "member" });
        if (error) {
          if (error.code === "23505") setInfo(`You're already in ${team.name}.`);
          else setErr(error.message);
          return;
        }
        setCode("");
        setInfo(`Joined ${team.name}.`);
      }
      onChanged();
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <div>
        <label className="label">Join code</label>
        <input className="input"
               style={{ fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: "0.15em" }}
               maxLength={6} value={code}
               onChange={(e) => setCode(e.target.value.toUpperCase())}
               placeholder="ABC123" required />
      </div>
      <div>
        <label className="label">Message to admin (optional)</label>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)}
               placeholder="Used only when approval is required" />
      </div>
      {err && <p className="error">{err}</p>}
      {info && <p className="success">{info}</p>}
      <button className="btn btn-primary" disabled={loading || code.length !== 6}>
        {loading ? "Working…" : "Join team"}
      </button>
    </form>
  );
}
