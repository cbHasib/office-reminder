"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Reminder } from "@office-reminder/shared";

function formatNext(r: Reminder): string {
  return new Date(r.scheduled_at).toLocaleString();
}

export default function RemindersTable({
  reminders, canEdit,
}: { reminders: Reminder[]; canEdit: boolean; teamId: string }) {
  const supabase = createClient();
  const router = useRouter();

  if (reminders.length === 0) {
    return <div className="card card-pad text-subtle">No reminders yet.</div>;
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this reminder?")) return;
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) alert(error.message); else router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted text-subtle text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Title</th>
            <th className="text-left px-4 py-2.5 font-medium">When</th>
            <th className="text-left px-4 py-2.5 font-medium">Lead</th>
            <th className="text-left px-4 py-2.5 font-medium">Recurs</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {reminders.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-4 py-3">
                <div className="font-medium">{r.title}</div>
                {r.description && <div className="text-xs text-subtle mt-0.5">{r.description}</div>}
              </td>
              <td className="px-4 py-3">{formatNext(r)}</td>
              <td className="px-4 py-3">{r.advance_minutes}m</td>
              <td className="px-4 py-3 font-mono text-xs">{r.rrule ?? "—"}</td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-danger hover:underline"
                          onClick={() => onDelete(r.id)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
