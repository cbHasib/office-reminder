import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateTeamForm from "@/components/CreateTeamForm";
import JoinTeamForm from "@/components/JoinTeamForm";

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch teams the user belongs to (RLS handles the filtering)
  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, team:teams(id, name, join_code)")
    .eq("user_id", user!.id);

  const teams = (memberships ?? []).map((m: any) => ({ ...m.team, role: m.role }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Your teams</h1>
        {teams.length === 0 ? (
          <div className="card text-ink-500">
            You're not in any teams yet. Create one or join one below.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {teams.map((t: any) => (
              <li key={t.id} className="card flex items-center justify-between">
                <div>
                  <Link href={`/dashboard/teams/${t.id}`} className="font-medium text-ink-900 hover:underline">
                    {t.name}
                  </Link>
                  <p className="text-xs text-ink-500 mt-1">
                    Join code <span className="font-mono">{t.join_code}</span>
                    {" · "}
                    <span className="capitalize">{t.role}</span>
                  </p>
                </div>
                <Link href={`/dashboard/teams/${t.id}`} className="btn-secondary">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Create a team</h2>
          <CreateTeamForm />
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Join a team</h2>
          <JoinTeamForm />
        </div>
      </section>
    </div>
  );
}
