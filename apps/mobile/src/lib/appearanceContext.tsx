import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type ThemeMode = "system" | "light" | "dark";

export interface ColorPalette {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  muted: string;
  fg: string;
  subtle: string;
  brand: string;
  brandFg: string;
  danger: string;
  success: string;
  warning: string;
  overlayBg: string;
}

export const darkColors: ColorPalette = {
  bg: "#0A0E16",
  surface: "#121823",
  elevated: "#181F2C",
  border: "#252F40",
  muted: "#1B2332",
  fg: "#ECF0F7",
  subtle: "#94A3B8",
  brand: "#818CFA",
  brandFg: "#0A0E16",
  danger: "#F87171",
  success: "#34D399",
  warning: "#FBBF24",
  overlayBg: "rgba(10, 14, 22, 0.85)",
};

export const lightColors: ColorPalette = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  elevated: "#F1F5F9",
  border: "#E2E8F0",
  muted: "#E2E8F0",
  fg: "#0F172A",
  subtle: "#64748B",
  brand: "#6366F1",
  brandFg: "#FFFFFF",
  danger: "#EF4444",
  success: "#10B981",
  warning: "#F59E0B",
  overlayBg: "rgba(255, 255, 255, 0.85)",
};

interface AppearanceContextType {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  colors: ColorPalette;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const AppearanceContext = createContext<AppearanceContextType>({
  themeMode: "system",
  resolvedTheme: "dark",
  colors: darkColors,
  setThemeMode: async () => {},
});

const THEME_STORAGE_KEY = "@office_reminder_theme";

export const useAppTheme = () => useContext(AppearanceContext);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Initial load from local AsyncStorage for quick startup paint
  useEffect(() => {
    async function loadStoredTheme() {
      try {
        const storedValue = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedValue) {
          setThemeModeState(storedValue as ThemeMode);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to load local theme preference:", err);
      }
    }
    loadStoredTheme();

    // Track active user session to support syncing settings
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch theme from Supabase whenever user logs in
  useEffect(() => {
    if (!userId) return;
    async function syncSupabaseTheme() {
      try {
        const { data, error } = await supabase
          .from("user_settings")
          .select("theme")
          .eq("user_id", userId)
          .single();

        if (data && !error) {
          const remoteTheme = data.theme as ThemeMode;
          setThemeModeState(remoteTheme);
          await AsyncStorage.setItem(THEME_STORAGE_KEY, remoteTheme);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to sync remote theme preference:", err);
      }
    }
    syncSupabaseTheme();
  }, [userId]);

  // Determine actual resolved theme (light/dark)
  const resolvedTheme: "light" | "dark" =
    themeMode === "system"
      ? (systemColorScheme === "light" ? "light" : "dark")
      : themeMode;

  const colors = resolvedTheme === "light" ? lightColors : darkColors;

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      if (userId) {
        await supabase
          .from("user_settings")
          .upsert({
            user_id: userId,
            theme: mode,
          });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to save theme preference:", err);
    }
  };

  return (
    <AppearanceContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        colors,
        setThemeMode,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}
