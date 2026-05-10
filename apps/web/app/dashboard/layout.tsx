import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-300 bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard/teams" className="font-semibold text-ink-900">
            Office Reminder
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard/teams" className="text-ink-700 hover:text-ink-900">Teams</Link>
            <Link href="/dashboard/settings" className="text-ink-700 hover:text-ink-900">Settings</Link>
            <span className="text-ink-500 hidden sm:inline">{profile?.display_name ?? profile?.email}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl w-full mx-auto px-6 py-8 flex-1">{children}</main>
    </div>
  );
}
