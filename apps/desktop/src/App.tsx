import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { applyTheme, loadStoredTheme, watchSystemTheme } from "@/lib/theme";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import LoginScreen from "@/screens/LoginScreen";
import Layout from "@/screens/Layout";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Intercept quit shortcuts and hide the window instead to prevent exiting
  useEffect(() => {
    const handleQuitKeys = (e: KeyboardEvent) => {
      const isMac = navigator.userAgent.includes("Mac");
      const isQuit = (isMac && e.metaKey && e.key.toLowerCase() === "q") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "q");
      const isAltF4 = !isMac && e.altKey && e.key === "F4";

      if (isQuit || isAltF4) {
        e.preventDefault();
        e.stopPropagation();
        getCurrentWebviewWindow().hide().catch((err) => {
          console.error("Failed to hide webview window:", err);
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
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
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
