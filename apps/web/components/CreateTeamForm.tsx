"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function CreateTeamForm() {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // A ref-based latch so a second click can't slip through while React is
  // still applying setLoading(true). State updates are async; refs aren't.
  const submitting = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not authenticated"); return; }

      // The join code is assigned server-side (DB trigger) — never sent by
      // the client.
      const { data: inserted, error } = await supabase
        .from("teams")
        .insert({ name: name.trim(), created_by: user.id })
        .select()
        .single();
      if (error || !inserted) { setError(error?.message ?? "Could not create team"); return; }
      router.push(`/dashboard/teams/${inserted.id}`);
      router.refresh();
    } finally {
      setLoading(false);
      submitting.current = false;
    }
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
