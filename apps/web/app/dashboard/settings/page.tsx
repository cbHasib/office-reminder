import { createClient } from "@/lib/supabase-server";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">Your notification settings</h1>
      <p className="text-sm text-ink-500 mb-6">
        These settings apply to your desktop client. Defaults follow our policy:
        <span className="font-medium"> sound off, overlay non-dismissible.</span>
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
