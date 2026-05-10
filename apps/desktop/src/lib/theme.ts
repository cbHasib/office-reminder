import type { Theme } from "@office-reminder/shared";

const STORAGE_KEY = "or.theme";

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark", "system", "dark-system");
  root.classList.add(theme);
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark-system", prefersDark);
  }
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
}

export function loadStoredTheme(): Theme {
  try { return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "system"; }
  catch { return "system"; }
}

export function watchSystemTheme(): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const t = loadStoredTheme();
    if (t === "system") applyTheme("system");
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
