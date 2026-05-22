import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import RemindersTable from "@/components/RemindersTable";
import TeamHeader from "@/components/TeamHeader";

export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const [teamRes, membershipRes, remindersRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, join_code, require_approval, created_by")
      .eq("id", teamId)
      .single(),
    supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("reminders")
      .select("*")
      .eq("team_id", teamId)
      .order("scheduled_at", { ascending: true }),
  ]);

  const team = teamRes.data;
  if (!team) notFound();

  const isAdmin = membershipRes.data?.role === "admin";
  const reminders = remindersRes.data ?? [];

  // For admins: count of pending requests so we can badge the link.
  let pendingCount = 0;
  if (isAdmin) {
    const { count } = await supabase
      .from("join_requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  return (
    <div className="space-y-6">
      <TeamHeader team={team} isAdmin={isAdmin} pendingCount={pendingCount} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Reminders</h2>
        {isAdmin && (
          <Link href={`/dashboard/teams/${team.id}/reminders/new`} className="btn-primary">
            + New reminder
          </Link>
        )}
      </div>
      <RemindersTable reminders={reminders ?? []} canEdit={isAdmin} teamId={team.id} />
    </div>
  );
}
