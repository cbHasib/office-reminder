import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import MembersList from "@/components/MembersList";
import JoinRequestsPanel from "@/components/JoinRequestsPanel";

export default async function MembersPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, join_code, require_approval, created_by")
    .eq("id", teamId)
    .single();
  if (!team) notFound();

  const { data: members, error: membersErr } = await supabase
    .from("team_members")
    .select("role, joined_at, user:users(id, display_name, email)")
    .eq("team_id", teamId);
  if (membersErr) console.error("members fetch err:", membersErr);

  const me = (members ?? []).find((m: any) => m.user?.id === user!.id);
  // Non-members must not see this page (it exposes the join code).
  if (!me) notFound();
  const isAdmin = me?.role === "admin";

  // Admins see pending requests. Fetch in TWO steps so we don't rely on
  // PostgREST's embedded-resource RLS behavior (which can silently drop
  // rows). First the raw requests, then the requester user rows.
  let requests: any[] = [];
  if (isAdmin) {
    const { data: rawRequests, error: reqErr } = await supabase
      .from("join_requests")
      .select("id, user_id, status, created_at, message")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (reqErr) console.error("join_requests fetch err:", reqErr);

    const list = rawRequests ?? [];
    if (list.length > 0) {
      const userIds = Array.from(new Set(list.map((r: any) => r.user_id)));
      const { data: users, error: usersErr } = await supabase
        .from("users")
        .select("id, display_name, email")
        .in("id", userIds);
      if (usersErr) console.error("requesters users fetch err:", usersErr);
      const userById = new Map<string, any>();
      (users ?? []).forEach((u: any) => userById.set(u.id, u));
      requests = list.map((r: any) => ({
        ...r,
        user: userById.get(r.user_id) ?? null,
      }));
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{team.name} — Members</h1>
        <p className="text-sm text-subtle mt-1">
          Share the join code <span className="font-mono kbd">{team.join_code}</span> to invite people.
        </p>
      </header>

      {isAdmin && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-subtle mb-3">
            Pending requests {requests.length > 0 && <span className="ml-1 text-fg">({requests.length})</span>}
          </h2>
          <JoinRequestsPanel
            teamId={team.id}
            initial={requests}
            requireApproval={team.require_approval}
          />
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-subtle mb-3">Members</h2>
        <MembersList
          teamId={team.id}
          createdBy={team.created_by}
          currentUserId={user!.id}
          isAdmin={isAdmin}
          initial={(members as any) ?? []}
        />
      </section>
    </div>
  );
}
