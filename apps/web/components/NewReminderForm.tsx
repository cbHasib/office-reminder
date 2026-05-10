"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_ADVANCE_MINUTES } from "@office-reminder/shared";

type Recurrence = "none" | "daily" | "weekdays" | "weekly";

function buildRrule(recurrence: Recurrence, scheduled: Date): string | null {
  if (recurrence === "none") return null;
  const h = scheduled.getHours();
  const m = scheduled.getMinutes();
  switch (recurrence) {
    case "daily":    return `FREQ=DAILY;BYHOUR=${h};BYMINUTE=${m}`;
    case "weekdays": return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=${h};BYMINUTE=${m}`;
    case "weekly":   return `FREQ=WEEKLY;BYHOUR=${h};BYMINUTE=${m}`;
  }
}

export default function NewReminderForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [advance, setAdvance] = useState(DEFAULT_ADVANCE_MINUTES);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const scheduledDate = new Date(scheduledAt);
    const rrule = buildRrule(recurrence, scheduledDate);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("reminders").insert({
      team_id: teamId,
      title,
      description,
      scheduled_at: scheduledDate.toISOString(),
      rrule,
      advance_minutes: advance,
      audience: "all",
      target_user_ids: [],
      created_by: user!.id,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push(`/dashboard/teams/${teamId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label className="label">Title</label>
        <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder="Daily standup" />
      </div>
      <div>
        <label className="label">Description (optional)</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)}
               placeholder="In the conference room" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date &amp; time</label>
          <input className="input" type="datetime-local" required value={scheduledAt}
                 onChange={(e) => setScheduledAt(e.target.value)} />
        </div>
        <div>
          <label className="label">Warn (minutes before)</label>
          <input className="input" type="number" min={0} max={120} value={advance}
                 onChange={(e) => setAdvance(parseInt(e.target.value || "0", 10))} />
        </div>
      </div>
      <div>
        <label className="label">Recurrence</label>
        <select className="input" value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
          <option value="none">One-off</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays only</option>
          <option value="weekly">Weekly (same day of week)</option>
        </select>
        <p className="text-xs text-ink-500 mt-1">
          For more advanced rules, you can edit the RRULE string later.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Saving…" : "Create reminder"}
        </button>
      </div>
    </form>
  );
}
