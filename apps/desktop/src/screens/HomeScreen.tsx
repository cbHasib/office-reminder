import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Reminder, UserSettings } from "@office-reminder/shared";
import { loadReminders, loadSettings, saveReminders, saveSettings } from "@/lib/cache";
import { useReminderScheduler } from "@/lib/useReminderScheduler";
import { nextOccurrence } from "@/lib/scheduler";

export default function HomeScreen({ session }: { session: Session }) {
  const userId = session.user.id;
  const [reminders, setReminders] = useState<Reminder[]>(() => loadReminders());
  const [settings, setSettings]   = useState<UserSettings | null>(() => loadSettings());
  const [teamCount, setTeamCount] = useState(0);

  // Initial fetch + realtime subscription
  useEffect(() => {
    let mounted = true;

    (async () => {
      // Fetch all reminders for the teams I'm in (RLS handles filtering)
      const { data: rs } = await supabase
        .from("reminders").select("*").order("scheduled_at", { ascending: true });
      if (mounted && rs) { setReminders(rs); saveReminders(rs); }

      const { data: ss } = await supabase
        .from("user_settings").select("*").eq("user_id", userId).single();
      if (mounted && ss) { setSettings(ss); saveSettings(ss); }

      const { count } = await supabase
        .from("team_members").select("*", { count: "exact", head: true }).eq("user_id", userId);
      if (mounted) setTeamCount(count ?? 0);
    })();

    // Realtime: any change to reminders → refetch (cheap and reliable)
    const chan = supabase.channel("rt-reminders")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "reminders" },
          async () => {
            const { data: rs } = await supabase
              .from("reminders").select("*").order("scheduled_at", { ascending: true });
            if (rs) { setReminders(rs); saveReminders(rs); }
          })
      .on("postgres_changes",
          { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${userId}` },
          async () => {
            const { data: ss } = await supabase
              .from("user_settings").select("*").eq("user_id", userId).single();
            if (ss) { setSettings(ss); saveSettings(ss); }
          })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(chan); };
  }, [userId]);

  // Scheduler tick — opens the overlay when something is due
  useReminderScheduler({ reminders, settings, userId });

  const upcoming = useMemo(() => {
    const now = new Date();
    console.log(reminders);
    return reminders
      .map((r) => ({ r, when: nextOccurrence(r, now) }))
      .filter((x) => x.when)
      .sort((a, b) => (a.when!.getTime() - b.when!.getTime()))
      .slice(0, 5);
  }, [reminders]);

  return (
    <div className="container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Office Reminder</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Signed in as {session.user.email} · {teamCount} team{teamCount === 1 ? "" : "s"}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </header>

      <section className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Upcoming reminders</h2>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled. Add reminders in the web dashboard.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {upcoming.map(({ r, when }) => (
              <li key={r.id} style={{
                padding: "10px 0", borderTop: "1px solid #e2e8f0",
                display: "flex", justifyContent: "space-between", alignItems: "center"
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{r.title}</div>
                  {r.description && <div className="muted" style={{ fontSize: 12 }}>{r.description}</div>}
                </div>
                <div className="muted" style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                  {when!.toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          Notification settings: sound {settings?.sound_enabled ? "on" : "off"} ·
          {" "}overlay {settings?.dismissible ? "dismissible" : "non-dismissible"}
          {" — "}<a href="#" onClick={(e) => { e.preventDefault(); /* TODO: settings window */ }}>
            change in web
          </a>
        </p>
      </section>
    </div>
  );
}
