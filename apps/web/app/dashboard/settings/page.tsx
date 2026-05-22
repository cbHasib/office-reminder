import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";
import { DEFAULT_USER_SETTINGS } from "@office-reminder/shared";

export default async function SettingsPage() {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  // Always pass a fully-populated settings object (defaults if row missing)
  const initial = settings ?? { user_id: user!.id, ...DEFAULT_USER_SETTINGS };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notification settings</h1>
        <p className="text-sm text-subtle mt-1">
          These apply across all your devices. The desktop app picks them up in real time.
        </p>
      </header>
      <SettingsForm initial={initial} />
    </div>
  );
}
