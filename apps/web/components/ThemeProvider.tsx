"use client";

import { useEffect } from "react";
import type { Theme } from "@office-reminder/shared";

const STORAGE_KEY = "or.theme";

/** Reads stored theme on mount and applies the matching class to <html>. */
export default function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme?: Theme;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? initialTheme ?? "system";
    applyTheme(stored);
  }, [initialTheme]);

  return <>{children}</>;
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "system");
  root.classList.add(t);
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
}

export function getStoredTheme(): Theme {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system";
  } catch {
    return "system";
  }
}
