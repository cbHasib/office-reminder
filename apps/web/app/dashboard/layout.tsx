import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar
        displayName={profile?.display_name ?? null}
        email={profile?.email ?? user.email ?? ""}
      />
      <main className="flex-1 px-6 py-8 md:px-10 md:py-10 overflow-x-hidden">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
