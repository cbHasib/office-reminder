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
  bg: "#090B10",
  surface: "#121720",
  elevated: "#1A202B",
  border: "#2A3240",
  muted: "#202734",
  fg: "#F5F7FB",
  subtle: "#9AA6B8",
  brand: "#7C9BFF",
  brandFg: "#07101F",
  danger: "#FF6B6B",
  success: "#34D399",
  warning: "#F5B84B",
  overlayBg: "rgba(9, 11, 16, 0.88)",
};

export const lightColors: ColorPalette = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  elevated: "#EEF2F7",
  border: "#DDE3EC",
  muted: "#E7ECF3",
  fg: "#111827",
  subtle: "#667085",
  brand: "#4568F0",
  brandFg: "#FFFFFF",
  danger: "#E5484D",
  success: "#0F9F6E",
  warning: "#C97917",
  overlayBg: "rgba(246, 247, 251, 0.9)",
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
