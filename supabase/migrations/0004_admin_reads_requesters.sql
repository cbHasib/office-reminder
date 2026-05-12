-- 0004 — Allow team admins to read the user row of anyone with a pending
-- join request for their team. Without this the approval panel can't show
-- requesters' name or email (the "read teammates" policy doesn't cover them
-- because they're not members yet).

drop policy if exists "users: admin reads requesters" on public.users;

create policy "users: admin reads requesters" on public.users for select
  using (
    exists (
      select 1 from public.join_requests jr
      where jr.user_id = public.users.id
        and jr.status = 'pending'
        and public.is_team_admin(jr.team_id)
    )
  );
