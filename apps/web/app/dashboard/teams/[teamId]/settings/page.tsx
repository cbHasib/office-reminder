import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TeamSettingsForm from "@/components/TeamSettingsForm";

export default async function TeamSettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, join_code, require_approval, created_by")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user!.id)
    .single();
  if (membership?.role !== "admin") redirect(`/dashboard/teams/${teamId}`);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Team settings</h1>
        <p className="text-sm text-subtle mt-1">Manage {team.name}.</p>
      </header>
      <TeamSettingsForm team={team} />
    </div>
  );
}
