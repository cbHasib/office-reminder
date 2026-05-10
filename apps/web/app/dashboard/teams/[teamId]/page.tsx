import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import RemindersTable from "@/components/RemindersTable";

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const supabase =  await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, join_code")
    .eq("id", params.teamId)
    .single();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", params.teamId)
    .eq("user_id", user!.id)
    .single();
  const isAdmin = membership?.role === "admin";

  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("team_id", params.teamId)
    .order("scheduled_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="text-sm text-ink-500 mt-1">
            Join code <span className="font-mono">{team.join_code}</span> · Share this with new members.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/teams/${team.id}/members`} className="btn-secondary">Members</Link>
          {isAdmin && (
            <Link href={`/dashboard/teams/${team.id}/reminders/new`} className="btn-primary">
              + New reminder
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Reminders</h2>
        <RemindersTable reminders={reminders ?? []} canEdit={isAdmin} teamId={team.id} />
      </section>
    </div>
  );
}
