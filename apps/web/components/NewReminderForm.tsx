"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_ADVANCE_MINUTES } from "@office-reminder/shared";

type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "custom";

const DAYS = [
  { key: "MO", short: "Mon" },
  { key: "TU", short: "Tue" },
  { key: "WE", short: "Wed" },
  { key: "TH", short: "Thu" },
  { key: "FR", short: "Fri" },
  { key: "SA", short: "Sat" },
  { key: "SU", short: "Sun" },
] as const;

function buildRrule(recurrence: Recurrence, _scheduled: Date, customDays: string[]): string | null {
  // We intentionally do NOT include BYHOUR/BYMINUTE here. The reminder's
  // scheduled_at (stored as a UTC timestamp) already carries the time-of-day,
  // and rrule's expansion inherits it from DTSTART. Adding BYHOUR/BYMINUTE
  // would force a specific UTC hour, which causes timezone shifts (e.g. 3 PM
  // Bangladesh becoming 9 PM the next day).
  if (recurrence === "none") return null;
  switch (recurrence) {
    case "daily":    return `FREQ=DAILY`;
    case "weekdays": return `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`;
    case "weekly":   return `FREQ=WEEKLY`;
    case "custom":
      if (customDays.length === 0) return null;
      return `FREQ=WEEKLY;BYDAY=${customDays.join(",")}`;
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
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [advance, setAdvance] = useState(DEFAULT_ADVANCE_MINUTES);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [customDays, setCustomDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const customInvalid = recurrence === "custom" && customDays.length === 0;
  const rrulePreview = useMemo(
    () => buildRrule(recurrence, new Date(scheduledAt), customDays),
    [recurrence, scheduledAt, customDays]
  );

  function toggleDay(k: string) {
    setCustomDays((prev) =>
      prev.includes(k) ? prev.filter((d) => d !== k) : [...prev, k]
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (customInvalid) { setError("Pick at least one day for custom recurrence."); return; }
    setLoading(true); setError(null);
    const scheduledDate = new Date(scheduledAt);
    const rrule = buildRrule(recurrence, scheduledDate, customDays);
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
    <form onSubmit={onSubmit} className="card card-pad space-y-4 p-6">
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
        <select className="select" value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
          <option value="none">One-off</option>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays only (Mon–Fri)</option>
          <option value="weekly">Weekly (same day of week)</option>
          <option value="custom">Custom days…</option>
        </select>
        {recurrence === "custom" && (
          <div className="mt-3">
            <p className="hint mb-2">Pick the days this reminder repeats on:</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = customDays.includes(d.key);
                return (
                  <button type="button" key={d.key}
                          onClick={() => toggleDay(d.key)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition
                                      ${on
                                        ? "bg-brand text-brand-fg border-brand"
                                        : "bg-surface text-fg border-border hover:bg-muted"}`}>
                    {d.short}
                  </button>
                );
              })}
            </div>
            {customInvalid && (
              <p className="hint text-danger mt-2">Pick at least one day.</p>
            )}
          </div>
        )}
        {rrulePreview && (
          <p className="hint font-mono">RRULE preview: {rrulePreview}</p>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" disabled={loading || customInvalid}>
          {loading ? "Saving…" : "Create reminder"}
        </button>
      </div>
    </form>
  );
}
