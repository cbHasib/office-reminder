import React, { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../src/lib/supabase";
import { theme } from "../src/lib/theme";
import type { User, UserSettings } from "@office-reminder/shared";
import { registerBackgroundSync } from "../src/lib/backgroundSync";

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
    if (user) {
      refreshSettings();
      // Register background scheduler synchronization on bootstrap
      registerBackgroundSync();
    }
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      <SettingsContext.Provider value={{ settings, refreshSettings }}>
        <StatusBar style="light" />
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
