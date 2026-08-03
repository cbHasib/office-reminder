import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { applyTheme, loadStoredTheme, watchSystemTheme } from "@/lib/theme";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { ensureAutostartDefault } from "@/lib/autostart";
import { saveReminders, saveSettings } from "@/lib/cache";
import { resetSchedulerSyncCache } from "@/lib/useReminderScheduler";
import LoginScreen from "@/screens/LoginScreen";
import Layout from "@/screens/Layout";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Launch-on-login is on by default (unless the user turned it off).
  useEffect(() => { ensureAutostartDefault(); }, []);

  // Intercept quit shortcuts and hide the window instead to prevent exiting
  useEffect(() => {
    const handleQuitKeys = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes("Mac");
      const isQuit = (isMac && e.metaKey && e.key.toLowerCase() === "q") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "q");
      const isAltF4 = !isMac && e.altKey && e.key === "F4";

      if (isQuit || isAltF4) {
        e.preventDefault();
        e.stopPropagation();
        // Route through Rust so the macOS dock icon is also restored to tray-only mode.
        invoke("hide_main_window_cmd").catch(() => {
          getCurrentWebviewWindow().hide().catch((err) => {
            console.error("Failed to hide webview window:", err);
          });
        });
      }
    };

    window.addEventListener("keydown", handleQuitKeys, { capture: true });
    return () => window.removeEventListener("keydown", handleQuitKeys, { capture: true });
  }, []);

  // Theme — apply early so even login screen is themed
  useEffect(() => {
    applyTheme(loadStoredTheme());
    return watchSystemTheme();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      if (evt === "SIGNED_OUT") {
        // Wipe per-user local state so overlays stop firing after logout and
        // the next account doesn't inherit this user's cache.
        saveReminders([]);
        saveSettings(null);
        resetSchedulerSyncCache();
        invoke("save_active_events", { events: [] }).catch(() => {});
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="login-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <Layout session={session} />;
}
