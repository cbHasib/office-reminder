/**
 * Loads, caches, and updates the current user's settings.
 * Single source of truth used by HomeTab, SettingsTab, scheduler.
 */
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { saveSettings as cacheSettings, loadSettings as loadCached } from "./cache";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@office-reminder/shared";

/** Fill in any missing fields from the defaults, so stale caches don't crash render. */
function withDefaults(s: UserSettings | null): UserSettings | null {
  if (!s) return null;
  return { ...DEFAULT_USER_SETTINGS, ...s };
}

export function useUserSettings(userId: string | null) {
  const [settings, setSettings] = useState<UserSettings | null>(() => withDefaults(loadCached()));

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("user_settings").select("*").eq("user_id", userId).single();
      if (mounted && data) {
        setSettings(data);
        cacheSettings(data);
      } else if (mounted && !data) {
        // No row yet — use defaults until we save
        const defaults = { user_id: userId, ...DEFAULT_USER_SETTINGS };
        setSettings(defaults);
      }
    })();

    const chan = supabase.channel(`rt-settings-${userId}`)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "user_settings", filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as UserSettings | undefined;
            if (row) { setSettings(row); cacheSettings(row); }
          })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(chan); };
  }, [userId]);

  async function update(patch: Partial<UserSettings>) {
    if (!userId || !settings) return;
    const next = { ...settings, ...patch, user_id: userId };
    setSettings(next);
    cacheSettings(next);
    const { error } = await supabase.from("user_settings").upsert(next);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("settings save failed:", error);
    }
  }

  return { settings, update };
}
