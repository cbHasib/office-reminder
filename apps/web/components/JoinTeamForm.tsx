"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function JoinTeamForm() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setError(null); setInfo(null);
    const upper = code.trim().toUpperCase();

    try {
      const { data: team, error: lookupErr } = await supabase
        .from("teams")
        .select("id, name, require_approval")
        .eq("join_code", upper)
        .single();
      if (lookupErr || !team) {
        setError("No team with that code.");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();

      // Already a member?
      const { data: existing } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("team_id", team.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (existing) {
        router.push(`/dashboard/teams/${team.id}`);
        router.refresh();
        return;
      }

      if (team.require_approval) {
        const { error: reqErr } = await supabase
          .from("join_requests")
          .insert({ team_id: team.id, user_id: user!.id, message: message.trim() || null });
        if (reqErr) {
          if (reqErr.code === "23505") setInfo(`Request already pending for "${team.name}".`);
          else setError(reqErr.message);
          return;
        }
        setInfo(`Request sent to ${team.name}. An admin will review it.`);
        router.refresh();
      } else {
        const { error: joinErr } = await supabase
          .from("team_members")
          .insert({ team_id: team.id, user_id: user!.id, role: "member" });
        if (joinErr) {
          if (joinErr.code === "23505") setError("You're already in that team.");
          else setError(joinErr.message);
          return;
        }
        router.push(`/dashboard/teams/${team.id}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Join code</label>
        <input className="input font-mono uppercase tracking-widest"
               maxLength={6} value={code}
               onChange={(e) => setCode(e.target.value.toUpperCase())}
               placeholder="ABC123" required />
      </div>
      <div>
        <label className="label">Optional message to the admin</label>
        <input className="input" value={message}
               onChange={(e) => setMessage(e.target.value)}
               placeholder="(only used when approval is required)" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {info && <p className="text-sm text-success">{info}</p>}
      <button className="btn-primary w-full" disabled={loading || code.length !== 6}>
        {loading ? "Working…" : "Join team"}
      </button>
    </form>
  );
}
