-- 0003 — Join requests, approval flag, member-management helpers.
-- Run this after 0002.

-- ============================================================
-- 1. teams.require_approval
-- ============================================================
alter table public.teams
  add column if not exists require_approval boolean not null default false;

-- ============================================================
-- 2. Enum + table for join requests
-- ============================================================
do $$ begin
  create type join_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.join_requests (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  status      join_request_status not null default 'pending',
  message     text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null
);

-- Only ONE pending request per (team, user). Partial unique index.
create unique index if not exists join_requests_one_pending
  on public.join_requests (team_id, user_id)
  where status = 'pending';

create index if not exists join_requests_team_idx on public.join_requests (team_id);
create index if not exists join_requests_user_idx on public.join_requests (user_id);

-- ============================================================
-- 3. RLS
-- ============================================================
alter table public.join_requests enable row level security;

drop policy if exists "jr: requester reads own"  on public.join_requests;
drop policy if exists "jr: admin reads team"     on public.join_requests;
drop policy if exists "jr: requester inserts"    on public.join_requests;
drop policy if exists "jr: admin updates"        on public.join_requests;
drop policy if exists "jr: requester cancels"    on public.join_requests;

create policy "jr: requester reads own" on public.join_requests
  for select using (user_id = auth.uid());

create policy "jr: admin reads team" on public.join_requests
  for select using (public.is_team_admin(team_id));

create policy "jr: requester inserts" on public.join_requests
  for insert with check (
    user_id = auth.uid()
    -- Can't request to a team you're already in
    and not exists (
      select 1 from public.team_members
      where team_id = join_requests.team_id and user_id = auth.uid()
    )
  );

-- Admins can approve / reject (update status, resolved_at, resolved_by).
create policy "jr: admin updates" on public.join_requests
  for update using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

-- Requester can cancel their own pending request.
create policy "jr: requester cancels" on public.join_requests
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- 4. Trigger: when a join_request is approved, add the user to team_members.
-- ============================================================
create or replace function public.handle_join_request_approved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'approved' and (OLD.status is distinct from 'approved') then
    insert into public.team_members (team_id, user_id, role)
    values (NEW.team_id, NEW.user_id, 'member')
    on conflict do nothing;
    NEW.resolved_at := now();
    NEW.resolved_by := auth.uid();
  elsif NEW.status in ('rejected', 'cancelled')
        and OLD.status is distinct from NEW.status then
    NEW.resolved_at := now();
    NEW.resolved_by := coalesce(NEW.resolved_by, auth.uid());
  end if;
  return NEW;
end;
$$;

drop trigger if exists join_requests_resolve on public.join_requests;
create trigger join_requests_resolve
  before update on public.join_requests
  for each row execute function public.handle_join_request_approved();

-- ============================================================
-- 5. Realtime for the new table
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.join_requests;
exception when duplicate_object then null; end $$;
