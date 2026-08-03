import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import NewReminderForm from "@/components/NewReminderForm";

export default async function NewReminderPage({ params }: { params: Promise<{
    teamId: string;
  }> }) {
  const { teamId } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  // Only team admins can create reminders (RLS enforces this on insert);
  // gate the page so non-admins aren't dead-ended by a raw error later.
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", user!.id)
    .single();
  if (membership?.role !== "admin") redirect(`/dashboard/teams/${teamId}`);

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-6">New reminder</h1>
      <NewReminderForm teamId={teamId} />
    </div>
  );
}
