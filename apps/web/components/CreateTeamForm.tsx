"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { generateJoinCode } from "@office-reminder/shared";

export default function CreateTeamForm() {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setLoading(false); return; }

    // Try a few times in case the random join_code collides
    let attempt = 0;
    let inserted: any = null;
    let lastErr: any = null;
    while (attempt < 5 && !inserted) {
      const join_code = generateJoinCode();
      const { data, error } = await supabase
        .from("teams")
        .insert({ name, join_code, created_by: user.id })
        .select()
        .single();
      if (error && error.code === "23505") { attempt++; continue; } // unique violation
      lastErr = error;
      inserted = data;
      break;
    }
    setLoading(false);
    if (!inserted) { setError(lastErr?.message ?? "Could not create team"); return; }
    router.push(`/dashboard/teams/${inserted.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Team name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="Acme HQ" required />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}
