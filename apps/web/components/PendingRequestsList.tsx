"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface Row {
  id: string;
  status: string;
  created_at: string;
  team: { id: string; name: string; join_code: string };
}

export default function PendingRequestsList({ initial }: { initial: Row[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(id: string, teamName: string) {
    if (!confirm(`Cancel your request to join "${teamName}"?`)) return;
    setBusy(id);
    const { error } = await supabase
      .from("join_requests")
      .update({ status: "cancelled" })
      .eq("id", id);
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium truncate">{r.team.name}</p>
              <p className="text-xs text-subtle">
                <span className="kbd text-warning">Pending</span>
                {" "}· sent {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "medium" })}
              </p>
            </div>
            <button className="btn-secondary text-xs" disabled={busy === r.id}
                    onClick={() => cancel(r.id, r.team.name)}>
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
