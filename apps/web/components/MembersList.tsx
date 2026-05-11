"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface MemberRow {
  role: "admin" | "member";
  joined_at: string;
  user: { id: string; display_name: string | null; email: string };
}

export default function MembersList({
  teamId, createdBy, currentUserId, isAdmin, initial,
}: {
  teamId: string;
  createdBy: string;
  currentUserId: string;
  isAdmin: boolean;
  initial: MemberRow[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(userId: string, displayName: string) {
    if (userId === createdBy) {
      alert("The team creator can't be removed. Transfer ownership or delete the team instead.");
      return;
    }
    if (!confirm(`Remove ${displayName} from the team?`)) return;
    setBusy(userId);
    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", userId);
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((r) => r.filter((x) => x.user.id !== userId));
    router.refresh();
  }

  async function setRole(userId: string, role: "admin" | "member") {
    setBusy(userId);
    const { error } = await supabase
      .from("team_members")
      .update({ role })
      .eq("team_id", teamId)
      .eq("user_id", userId);
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((r) => r.map((x) => x.user.id === userId ? { ...x, role } : x));
    router.refresh();
  }

  if (rows.length === 0) {
    return <div className="card card-pad text-subtle">No members yet.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted text-subtle text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 font-medium">Email</th>
            <th className="text-left px-4 py-2.5 font-medium">Role</th>
            <th className="text-left px-4 py-2.5 font-medium">Joined</th>
            {isAdmin && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const isCreator = m.user.id === createdBy;
            const isSelf = m.user.id === currentUserId;
            return (
              <tr key={m.user.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {m.user.display_name ?? "—"}
                  {isCreator && <span className="ml-2 kbd text-[10px]">Owner</span>}
                </td>
                <td className="px-4 py-3 text-subtle">{m.user.email}</td>
                <td className="px-4 py-3 capitalize">{m.role}</td>
                <td className="px-4 py-3 text-subtle">
                  {new Date(m.joined_at).toLocaleDateString()}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!isCreator && !isSelf && m.role === "member" && (
                      <button
                        className="text-xs text-brand hover:underline mr-3"
                        onClick={() => setRole(m.user.id, "admin")}
                        disabled={busy === m.user.id}
                      >
                        Promote
                      </button>
                    )}
                    {!isCreator && !isSelf && m.role === "admin" && (
                      <button
                        className="text-xs text-subtle hover:underline mr-3"
                        onClick={() => setRole(m.user.id, "member")}
                        disabled={busy === m.user.id}
                      >
                        Demote
                      </button>
                    )}
                    {!isCreator && !isSelf && (
                      <button
                        className="text-xs text-danger hover:underline"
                        onClick={() => remove(m.user.id, m.user.display_name ?? m.user.email)}
                        disabled={busy === m.user.id}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
