-- Office Reminder — initial schema
-- Run this in your Supabase project's SQL editor (or via `supabase db push`).

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type team_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_audience as enum ('all', 'specific');
exception when duplicate_object then null; end $$;

-- ============================================================
-- users  (mirror of auth.users with profile fields)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- teams
-- ============================================================
create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  join_code text not null unique check (length(join_code) = 6),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists teams_join_code_idx on public.teams (join_code);

-- ============================================================
-- team_members
-- ============================================================
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role team_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members (user_id);

-- Helper: is the caller a member of the given team?
create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

-- Helper: is the caller an admin of the given team?
create or replace function public.is_team_admin(p_team_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- reminders
-- ============================================================
create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  description text not null default '',
  scheduled_at timestamptz not null,
  rrule text,                                          -- RFC 5545 string; null = one-off
  advance_minutes int not null default 5 check (advance_minutes between 0 and 1440),
  audience reminder_audience not null default 'all',
  target_user_ids uuid[] not null default '{}',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_team_idx on public.reminders (team_id);
create index if not exists reminders_scheduled_idx on public.reminders (scheduled_at);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reminders_touch on public.reminders;
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

-- ============================================================
-- user_settings
-- ============================================================
create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  sound_enabled boolean not null default false,
  dismissible boolean not null default false,
  advance_minutes_override int check (advance_minutes_override is null or advance_minutes_override between 0 and 1440),
  muted_reminder_ids uuid[] not null default '{}'
);

-- ============================================================
-- reminder_dismissals  (audit trail; "did Hasib see Dhuhr today?")
-- ============================================================
create table if not exists public.reminder_dismissals (
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  fired_at timestamptz not null,
  dismissed_at timestamptz,
  primary key (reminder_id, user_id, fired_at)
);

-- ============================================================
-- Realtime  (so desktop clients can subscribe)
-- ============================================================
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.team_members;

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.reminders enable row level security;
alter table public.user_settings enable row level security;
alter table public.reminder_dismissals enable row level security;

-- ----- users -----
create policy "users: read self"               on public.users for select  using (id = auth.uid());
create policy "users: read teammates"          on public.users for select  using (
  exists (
    select 1 from public.team_members tm1
    join public.team_members tm2 on tm1.team_id = tm2.team_id
    where tm1.user_id = auth.uid() and tm2.user_id = public.users.id
  )
);
create policy "users: update self"             on public.users for update  using (id = auth.uid());

-- ----- teams -----
create policy "teams: read if member"          on public.teams for select  using (public.is_team_member(id));
-- Anyone authenticated can look up by join_code (but only the row matching the code)
create policy "teams: read by join_code"       on public.teams for select  using (auth.role() = 'authenticated');
create policy "teams: insert any auth"         on public.teams for insert  with check (auth.uid() = created_by);
create policy "teams: admin update"            on public.teams for update  using (public.is_team_admin(id));
create policy "teams: admin delete"            on public.teams for delete  using (public.is_team_admin(id));

-- ----- team_members -----
create policy "team_members: read if member"   on public.team_members for select using (public.is_team_member(team_id));
-- A user can self-insert via join code
create policy "team_members: self join"        on public.team_members for insert
  with check (user_id = auth.uid() and role = 'member');
-- An admin can add or change roles
create policy "team_members: admin write"      on public.team_members for all
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));
-- A user can leave (delete their own row)
create policy "team_members: self leave"       on public.team_members for delete using (user_id = auth.uid());

-- ----- reminders -----
create policy "reminders: read if member"      on public.reminders for select using (public.is_team_member(team_id));
create policy "reminders: admin write"         on public.reminders for all
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

-- ----- user_settings -----
create policy "settings: read self"            on public.user_settings for select using (user_id = auth.uid());
create policy "settings: upsert self"          on public.user_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----- reminder_dismissals -----
create policy "dismissals: read self"          on public.reminder_dismissals for select using (user_id = auth.uid());
create policy "dismissals: write self"         on public.reminder_dismissals for insert
  with check (user_id = auth.uid());
create policy "dismissals: update self"        on public.reminder_dismissals for update
  using (user_id = auth.uid());

-- ============================================================
-- Convenience: auto-add team creator as admin
-- ============================================================
create or replace function public.add_creator_as_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.team_members (team_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists teams_add_creator on public.teams;
create trigger teams_add_creator after insert on public.teams
  for each row execute function public.add_creator_as_admin();
