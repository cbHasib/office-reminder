"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase-browser";
import type { Theme } from "@office-reminder/shared";

export default function ThemePicker() {
  const supabase = createClient();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => { setTheme(getStoredTheme()); }, []);

  async function pick(t: Theme) {
    setTheme(t);
    applyTheme(t);
    // Best-effort: also persist to user_settings so the desktop app picks it up
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("user_settings").upsert({ user_id: user.id, theme: t });
    }
  }

  const opts: { v: Theme; label: string; Icon: () => React.JSX.Element }[] = [
    { v: "system", label: "Auto", Icon: Auto },
    { v: "light", label: "Light", Icon: Sun },
    { v: "dark", label: "Dark", Icon: Moon },
  ];

  return (
    <div className="px-2">
      <p className="text-xs uppercase tracking-wide text-subtle mb-1.5">Appearance</p>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg p-1">
        {opts.map((o) => {
          const active = theme === o.v;
          const Icon = o.Icon;
          return (
            <button key={o.v} onClick={() => pick(o.v)}
              className={`flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition
                ${active ? "bg-surface text-fg shadow-sm" : "text-subtle hover:text-fg"}`}>
              <Icon />
              <span className="hidden lg:inline">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Sun()  { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4 4l1.5 1.5M14.5 14.5L16 16M16 4l-1.5 1.5M5.5 14.5L4 16"/></svg>; }
function Moon() { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M16 11.5A6.5 6.5 0 0 1 8.5 4 6.5 6.5 0 1 0 16 11.5Z"/></svg>; }
function Auto() { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13M3.5 10h13"/></svg>; }
