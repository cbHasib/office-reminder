import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Reminder } from "@office-reminder/shared";
import { supabase } from "@/lib/supabase";
import { loadReminders, saveReminders } from "@/lib/cache";
import { useUserSettings } from "@/lib/settingsStore";
import { useReminderScheduler } from "@/lib/useReminderScheduler";
import { applyTheme } from "@/lib/theme";
import { notify } from "@/lib/notifications";
import HomeTab from "./HomeTab";
import SettingsTab from "./SettingsTab";
import AccountTab from "./AccountTab";

type Tab = "home" | "settings" | "account";

export default function Layout({ session }: { session: Session }) {
  const userId = session.user.id;
  const [tab, setTab] = useState<Tab>("home");
  const [reminders, setReminders] = useState<Reminder[]>(() => loadReminders());
  const { settings, update } = useUserSettings(userId);
  // Track first sync so we don't fire notifications for the initial bulk load
  const firstSyncDone = useRef(false);

  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    let mounted = true;

    async function refetch() {
      const { data } = await supabase
        .from("reminders").select("*").order("scheduled_at", { ascending: true });
      if (mounted && data) { setReminders(data); saveReminders(data); }
      firstSyncDone.current = true;
    }

    refetch();

    const chan = supabase.channel("rt-reminders")
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "reminders" },
          async (payload) => {
            const r = payload.new as Reminder;
            // Don't notify the admin who just created it
            if (firstSyncDone.current && r.created_by !== userId) {
              const when = new Date(r.scheduled_at);
              const whenStr = when.toLocaleString(undefined, {
                weekday: "short", hour: "numeric", minute: "2-digit",
              });
              notify(
                "New reminder added",
                r.rrule ? `${r.title} • repeats from ${whenStr}` : `${r.title} • ${whenStr}`,
              );
            }
            refetch();
          })
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "reminders" },
          () => { refetch(); })
      .on("postgres_changes",
          { event: "DELETE", schema: "public", table: "reminders" },
          () => { refetch(); })
      .on("postgres_changes",
          { event: "*", schema: "public", table: "team_members", filter: `user_id=eq.${userId}` },
          () => { refetch(); })
      .subscribe();

    // Safety net every 5 min in case realtime drops
    const id = window.setInterval(refetch, 5 * 60_000);

    return () => { mounted = false; supabase.removeChannel(chan); window.clearInterval(id); };
  }, [userId]);

  useReminderScheduler({ reminders, settings, userId });

  return (
    <div className="app">
      {/* Full-width draggable strip across the top of the entire window. */}
      <div className="titlebar-drag" />
      <aside className="sidebar">
        <div style={{ height: 28 }} />
        <div className="brand">Office Reminder</div>
        <nav className="nav">
          <NavItem active={tab === "home"} onClick={() => setTab("home")} icon={<HomeIcon />} label="Today" />
          <NavItem active={tab === "settings"} onClick={() => setTab("settings")} icon={<BellIcon />} label="Settings" />
          <NavItem active={tab === "account"} onClick={() => setTab("account")} icon={<UserIcon />} label="Account" />
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 8px", borderTop: "1px solid rgb(var(--border))" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>{session.user.email}</p>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>Signed in</p>
        </div>
      </aside>
      <main className="content">
        {tab === "home" && <HomeTab reminders={reminders} settings={settings} />}
        {tab === "settings" && <SettingsTab settings={settings} onUpdate={update} />}
        {tab === "account" && <AccountTab session={session} />}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      {icon}<span>{label}</span>
    </button>
  );
}

function HomeIcon() { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10l7-6 7 6v7a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1Z"/></svg>); }
function BellIcon() { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 8a5 5 0 0 1 10 0v3l1.5 2.5h-13L5 11Z"/><path d="M8 16a2 2 0 0 0 4 0"/></svg>); }
function UserIcon() { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/></svg>); }
