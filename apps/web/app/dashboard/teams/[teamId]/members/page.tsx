import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function MembersPage({ params }: { params: Promise<{
    teamId: string;
  }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: team } = await supabase.from("teams")
    .select("id, name, join_code").eq("id", (await params).teamId).single();
  if (!team) notFound();

  const { data: members } = await supabase
    .from("team_members")
    .select("role, joined_at, user:users(id, display_name, email)")
    .eq("team_id", (await params).teamId);

  const me = members?.find((m: any) => m.user?.id === user!.id);
  const isAdmin = me?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{team.name} — Members</h1>
        <p className="text-sm text-ink-500 mt-1">
          Share the join code <span className="font-mono">{team.join_code}</span> with anyone you want to add.
        </p>
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-100 text-ink-700">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m: any) => (
              <tr key={m.user.id} className="border-t border-ink-300/60">
                <td className="px-4 py-2 text-ink-900">{m.user.display_name ?? "—"}</td>
                <td className="px-4 py-2 text-ink-700">{m.user.email}</td>
                <td className="px-4 py-2 text-ink-700 capitalize">{m.role}</td>
                <td className="px-4 py-2 text-ink-500">
                  {new Date(m.joined_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isAdmin && (
        <p className="text-xs text-ink-500">
          Only admins can change member roles. Ask a team admin if you need elevated permissions.
        </p>
      )}
    </div>
  );
}
