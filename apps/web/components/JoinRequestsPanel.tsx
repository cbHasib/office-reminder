"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface RequestRow {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
  // user can be null if RLS hides it; we render a fallback in that case.
  user: { id: string; display_name: string | null; email: string } | null;
}

export default function JoinRequestsPanel({
  teamId, initial, requireApproval,
}: { teamId: string; initial: RequestRow[]; requireApproval: boolean }) {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function resolve(id: string, status: "approved" | "rejected") {
    setBusy(id);
    const { error } = await supabase
      .from("join_requests")
      .update({ status })
      .eq("id", id);
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    router.refresh();
  }

  // Keep showing any outstanding requests even when approval was turned off
  // afterwards — otherwise they linger unresolvable behind the header badge.
  if (!requireApproval && rows.length === 0) {
    return (
      <div className="card card-pad text-sm text-subtle">
        Approval isn't required — new members join with the code instantly.{" "}
        Turn on <span className="kbd">Require admin approval</span> in team settings to gate joins.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card card-pad text-sm text-subtle">No pending requests.</div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-border">
        {rows.map((r) => {
          const name = r.user?.display_name ?? r.user?.email ?? "Pending user";
          const email = r.user?.email ?? "(profile hidden)";
          return (
          <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{name}</p>
              <p className="text-xs text-subtle truncate">
                {email} · requested {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              {r.message && (
                <p className="text-xs text-subtle mt-1 italic">"{r.message}"</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-secondary text-xs"
                disabled={busy === r.id}
                onClick={() => resolve(r.id, "rejected")}
              >
                Reject
              </button>
              <button
                className="btn-primary text-xs"
                disabled={busy === r.id}
                onClick={() => resolve(r.id, "approved")}
              >
                {busy === r.id ? "…" : "Approve"}
              </button>
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
