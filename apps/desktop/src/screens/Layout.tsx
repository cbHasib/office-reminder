import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Reminder } from "@office-reminder/shared";
import { WEB_DASHBOARD_URL } from "@office-reminder/shared";
import { supabase } from "@/lib/supabase";
import { loadReminders, saveReminders } from "@/lib/cache";
import { useUserSettings } from "@/lib/settingsStore";
import { useReminderScheduler } from "@/lib/useReminderScheduler";
import { applyTheme } from "@/lib/theme";
import { notify } from "@/lib/notifications";
import { externalLink } from "@/lib/openExternal";
import HomeTab from "./HomeTab";
import TeamsTab from "./TeamsTab";
import SettingsTab from "./SettingsTab";
import AccountTab from "./AccountTab";
import NewReminderModal from "./NewReminderModal";
import UpdateBanner from "@/components/UpdateBanner";

type Tab = "home" | "teams" | "settings" | "account";

export default function Layout({ session }: { session: Session }) {
  const userId = session.user.id;
  const [tab, setTab] = useState<Tab>("home");
  const [reminders, setReminders] = useState<Reminder[]>(() => loadReminders());
  const { settings, update } = useUserSettings(userId);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [prefillTeamId, setPrefillTeamId] = useState<string | undefined>();
  const [editReminder, setEditReminder] = useState<any | undefined>();
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
          () => refetch())
      .on("postgres_changes",
          { event: "DELETE", schema: "public", table: "reminders" },
          () => refetch())
      .on("postgres_changes",
          { event: "*", schema: "public", table: "team_members", filter: `user_id=eq.${userId}` },
          () => refetch())
      .subscribe();

    const id = window.setInterval(refetch, 5 * 60_000);
    return () => { mounted = false; supabase.removeChannel(chan); window.clearInterval(id); };
  }, [userId]);

  useReminderScheduler({ reminders, settings, userId });

  function openNewReminder(teamId?: string) {
    setEditReminder(undefined);
    setPrefillTeamId(teamId);
    setShowNewReminder(true);
  }

  function openEditReminder(reminder: any) {
    setEditReminder(reminder);
    setPrefillTeamId(undefined);
    setShowNewReminder(true);
  }

  return (
    <div className="app">
      <div className="titlebar-drag" aria-hidden />
      <aside className="sidebar">
        <div style={{ height: 32 }} />
        <div className="brand">Office Reminder</div>
        <nav className="nav">
          <NavItem active={tab === "home"}     onClick={() => setTab("home")}     icon={<HomeIcon />}     label="Today" />
          <NavItem active={tab === "teams"}    onClick={() => setTab("teams")}    icon={<UsersIcon />}    label="Teams" />
          <NavItem active={tab === "settings"} onClick={() => setTab("settings")} icon={<BellIcon />}     label="Settings" />
          <NavItem active={tab === "account"}  onClick={() => setTab("account")}  icon={<UserIcon />}     label="Account" />
        </nav>

        <button className="btn btn-primary"
                onClick={() => openNewReminder()}
                style={{ marginTop: 12, justifyContent: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span>New reminder</span>
        </button>

        <div style={{ flex: 1 }} />
        <a {...externalLink(WEB_DASHBOARD_URL)}
           className="nav-item"
           style={{ textDecoration: "none", marginBottom: 6 }}>
          <svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="4" width="14" height="11" rx="2" />
            <path d="M3 8h14" />
          </svg>
          <span>Open web</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ marginLeft: "auto" }}>
            <path d="M3 1h6v6M9 1L3 7" />
          </svg>
        </a>
        <div style={{ padding: "10px 8px", borderTop: "1px solid rgb(var(--border))" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500 }}>{session.user.email}</p>
          <p className="muted" style={{ margin: "2px 0 0", fontSize: 11 }}>Signed in</p>
        </div>
      </aside>

      <main className="content">
        <UpdateBanner />
        {tab === "home"     && <HomeTab     reminders={reminders} settings={settings} onManageTeams={() => setTab("teams")} />}
        {tab === "teams"    && <TeamsTab    session={session} onPick={openNewReminder} onEdit={openEditReminder} />}
        {tab === "settings" && <SettingsTab settings={settings} onUpdate={update} />}
        {tab === "account"  && <AccountTab  session={session} />}
      </main>

      {showNewReminder && (
        <NewReminderModal
          userId={userId}
          prefillTeamId={prefillTeamId}
          editReminder={editReminder}
          onClose={() => setShowNewReminder(false)}
        />
      )}
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

function HomeIcon()  { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10l7-6 7 6v7a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1Z"/></svg>); }
function UsersIcon() { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="7" cy="8" r="3"/><circle cx="14" cy="9" r="2.5"/><path d="M2 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"/><path d="M12 16c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5"/></svg>); }
function BellIcon()  { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 8a5 5 0 0 1 10 0v3l1.5 2.5h-13L5 11Z"/><path d="M8 16a2 2 0 0 0 4 0"/></svg>); }
function UserIcon()  { return (<svg className="nav-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="7" r="3.2"/><path d="M3.5 17c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5"/></svg>); }
