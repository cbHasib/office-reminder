"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface TeamLite {
  id: string;
  name: string;
  join_code: string;
  require_approval: boolean;
  created_by: string;
}

export default function TeamHeader({
  team, isAdmin, pendingCount,
}: { team: TeamLite; isAdmin: boolean; pendingCount: number }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(team.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function leaveTeam() {
    if (!confirm(`Leave team "${team.name}"? You'll stop receiving its reminders.`)) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", team.id)
      .eq("user_id", user!.id);
    setBusy(false);
    if (error) { alert(error.message); return; }
    router.push("/dashboard/teams");
    router.refresh();
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight truncate">{team.name}</h1>
        <div className="text-sm text-subtle mt-1 flex items-center gap-2 flex-wrap">
          <span>Join code</span>
          <button onClick={copyCode}
                  className="font-mono kbd hover:bg-surface transition"
                  title="Copy join code">
            {team.join_code} {copied ? "✓" : ""}
          </button>
          {team.require_approval && (
            <span className="kbd text-warning">Approval required</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link href={`/dashboard/teams/${team.id}/members`} className="btn-secondary">
          Members
          {pendingCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-warning text-white text-[10px] font-semibold">
              {pendingCount}
            </span>
          )}
        </Link>
        {isAdmin && (
          <Link href={`/dashboard/teams/${team.id}/settings`} className="btn-secondary">
            Settings
          </Link>
        )}
        {!isAdmin && (
          <button onClick={leaveTeam} className="btn-secondary" disabled={busy}>
            {busy ? "Leaving…" : "Leave team"}
          </button>
        )}
      </div>
    </header>
  );
}
