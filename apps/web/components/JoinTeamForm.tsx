"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function JoinTeamForm() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const upper = code.trim().toUpperCase();

    const { data: team, error: lookupErr } = await supabase
      .from("teams")
      .select("id")
      .eq("join_code", upper)
      .single();
    if (lookupErr || !team) {
      setLoading(false);
      setError("No team with that code.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error: joinErr } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: user!.id, role: "member" });

    setLoading(false);
    if (joinErr) {
      if (joinErr.code === "23505") {
        setError("You're already in that team.");
      } else {
        setError(joinErr.message);
      }
      return;
    }
    router.push(`/dashboard/teams/${team.id}`);
    router.refresh();
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={loading || code.length !== 6}>
        {loading ? "Joining…" : "Join team"}
      </button>
    </form>
  );
}
