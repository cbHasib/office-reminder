import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateTeamForm from "@/components/CreateTeamForm";
import JoinTeamForm from "@/components/JoinTeamForm";

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("team_members")
    .select("role, team:teams(id, name, join_code)")
    .eq("user_id", user!.id);

  const teams = (memberships ?? []).map((m: any) => ({ ...m.team, role: m.role }));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-subtle mt-1">Create a team or join one with a 6-character code.</p>
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-subtle mb-3">Your teams</h2>
        {teams.length === 0 ? (
          <div className="card card-pad text-subtle">
            You're not in any teams yet. Create one or join one below.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {teams.map((t: any) => (
              <li key={t.id} className="card card-pad flex items-center justify-between">
                <div className="min-w-0">
                  <Link href={`/dashboard/teams/${t.id}`} className="font-medium hover:underline truncate block">
                    {t.name}
                  </Link>
                  <p className="text-xs text-subtle mt-1">
                    Code <span className="font-mono">{t.join_code}</span> · <span className="capitalize">{t.role}</span>
                  </p>
                </div>
                <Link href={`/dashboard/teams/${t.id}`} className="btn-secondary shrink-0">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card card-pad">
          <h3 className="text-base font-semibold mb-3">Create a team</h3>
          <CreateTeamForm />
        </div>
        <div className="card card-pad">
          <h3 className="text-base font-semibold mb-3">Join a team</h3>
          <JoinTeamForm />
        </div>
      </section>
    </div>
  );
}
