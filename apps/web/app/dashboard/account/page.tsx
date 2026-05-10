import { createClient } from "@/lib/supabase-server";
import AccountForm from "@/components/AccountForm";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users").select("display_name, email").eq("id", user!.id).single();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-subtle mt-1">Update your profile and password.</p>
      </header>
      <AccountForm
        initialDisplayName={profile?.display_name ?? ""}
        initialEmail={profile?.email ?? user!.email ?? ""}
      />
    </div>
  );
}
