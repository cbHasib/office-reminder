import React, { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet, AppState } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
// Removed unused @expo/ui imports
import { supabase } from "../src/lib/supabase";
import { theme } from "../src/lib/theme";
import type { User, UserSettings } from "../src/lib/shared";
import { registerBackgroundSync } from "../src/lib/backgroundSync";
import { syncMobileScheduler } from "../src/lib/notificationScheduler";
import { AppearanceProvider, useAppTheme } from "../src/lib/appearanceContext";

interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

interface SettingsContextType {
  settings: UserSettings | null;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  refreshSettings: async () => {},
});

export const useAuth = () => useContext(AuthContext);
export const useSettings = () => useContext(SettingsContext);

export default function RootLayout() {
  return (
    <AppearanceProvider>
      <View style={{ flex: 1 }}>
        <RootLayoutContent />
      </View>
    </AppearanceProvider>
  );
}

function RootLayoutContent() {
  const { colors, resolvedTheme } = useAppTheme();
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Load Auth State
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        if (initialSession?.user) {
          // Map Supabase user metadata
          setUser({
            id: initialSession.user.id,
            email: initialSession.user.email ?? "",
            display_name: initialSession.user.user_metadata?.display_name ?? null,
            created_at: initialSession.user.created_at,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email ?? "",
          display_name: currentSession.user.user_metadata?.display_name ?? null,
          created_at: currentSession.user.created_at,
        });
      } else {
        setUser(null);
        setSettings(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch User Settings once authenticated
  const refreshSettings = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setSettings(data as UserSettings);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to load user settings:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    refreshSettings();
    // Register background scheduler synchronization on bootstrap
    registerBackgroundSync();

    // Perform foreground sync immediately
    syncMobileScheduler(user.id);

    // Subscribe to realtime database updates for reminders
    const channel = supabase
      .channel("root-reminders-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders" }, () => {
        syncMobileScheduler(user.id);
      })
      .subscribe();

    // AppState listener for foreground syncing
    const appStateSub = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshSettings();
        syncMobileScheduler(user.id);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      appStateSub.remove();
    };
  }, [user]);

  // Routing synchronization
  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/login");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      <SettingsContext.Provider value={{ settings, refreshSettings }}>
        <StatusBar style={resolvedTheme === "light" ? "dark" : "light"} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ animation: "fade" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade_from_bottom" }} />
          <Stack.Screen name="team/[id]" options={{ presentation: "card", animation: "slide_from_right" }} />
        </Stack>
      </SettingsContext.Provider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
