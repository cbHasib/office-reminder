"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Reminder } from "@office-reminder/shared";

function formatNext(r: Reminder): string {
  const d = new Date(r.scheduled_at);
  return d.toLocaleString();
}

export default function RemindersTable({
  reminders, canEdit, teamId,
}: { reminders: Reminder[]; canEdit: boolean; teamId: string }) {
  const supabase = createClient();
  const router = useRouter();

  if (reminders.length === 0) {
    return <div className="card text-ink-500">No reminders yet.</div>;
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this reminder?")) return;
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) alert(error.message); else router.refresh();
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-ink-100 text-ink-700">
          <tr>
            <th className="text-left px-4 py-2">Title</th>
            <th className="text-left px-4 py-2">When</th>
            <th className="text-left px-4 py-2">Lead</th>
            <th className="text-left px-4 py-2">Recurs</th>
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {reminders.map((r) => (
            <tr key={r.id} className="border-t border-ink-300/60">
              <td className="px-4 py-2">
                <div className="font-medium text-ink-900">{r.title}</div>
                {r.description && <div className="text-xs text-ink-500 mt-0.5">{r.description}</div>}
              </td>
              <td className="px-4 py-2 text-ink-700">{formatNext(r)}</td>
              <td className="px-4 py-2 text-ink-700">{r.advance_minutes}m</td>
              <td className="px-4 py-2 text-ink-700 font-mono text-xs">{r.rrule ?? "—"}</td>
              {canEdit && (
                <td className="px-4 py-2 text-right">
                  <button className="text-xs text-red-600 hover:underline"
                          onClick={() => onDelete(r.id)}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
