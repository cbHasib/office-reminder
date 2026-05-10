import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { applyTheme, loadStoredTheme, watchSystemTheme } from "@/lib/theme";
import LoginScreen from "@/screens/LoginScreen";
import Layout from "@/screens/Layout";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
