-- 0005 — Secure the team-join flow.
--
-- Fixes verified vulnerabilities:
--   1. "teams: read by join_code" let every authenticated user SELECT every
--      team row, leaking all team names and join codes.
--   2. "team_members: self join" let any authenticated user INSERT themselves
--      into any team without a code and regardless of require_approval.
--   3. "jr: requester cancels" let a requester UPDATE their own join_request
--      to status='approved'; the SECURITY DEFINER trigger then added them to
--      team_members with RLS bypassed.
--   4. "jr: requester inserts" let anyone with a team UUID create a request
--      (and with it, read access to the team row) without knowing any code.
--   5. Join codes were generated client-side with Math.random(), so they were
--      predictable and a malicious client could pick its own.
-- Plus hardening: join-RPC rate limiting, join_request identity locking,
-- users.email pinning (anti-impersonation in the approval panel), and
-- join codes that survive stale full-row client PATCHes.
--
-- After this migration, clients must:
--   - join teams via      select join_team_with_code(p_code := ..., p_message := ...)
--   - regenerate codes via select regenerate_join_code(p_team_id := ...)
--   - create teams WITHOUT sending join_code (the DB assigns one).
-- These RPCs run in user context (auth.uid()); service-role callers should
-- write the tables directly instead — the trigger below still assigns codes.

-- ============================================================
-- 1. Server-side join-code generation
-- ============================================================
-- Entropy comes from gen_random_uuid() (pg_strong_random-backed in PG 13+),
-- so no extra extension is required. Bytes 0-5 of a v4 UUID are fully random,
-- and 32 divides 256 exactly so the modulo introduces no bias.
create or replace function public.gen_join_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw bytea := uuid_send(gen_random_uuid());
  code text := '';
  i int;
begin
  for i in 0..5 loop
    code := code || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Not part of the client API (authenticated keeps EXECUTE because the
-- invoker-rights trigger below calls it during client team INSERTs).
revoke execute on function public.gen_join_code() from public, anon;
grant execute on function public.gen_join_code() to authenticated;

-- Never trust a client-supplied join_code:
--   INSERT  -> always assign a fresh server-generated code.
--   UPDATE  -> the code can never change EXCEPT inside regenerate_join_code()
--              (marked by a transaction-local flag). A client PATCHing a
--              stale full team row therefore cannot silently rotate the code.
--
-- NOTE: the schema depends on this trigger — clients insert teams WITHOUT a
-- join_code and the column is NOT NULL. Logical restores (pg_dump | psql)
-- should run with `set session_replication_role = replica` so the trigger
-- doesn't regenerate every code during COPY.
create or replace function public.enforce_server_join_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  attempts int := 0;
begin
  if tg_op = 'UPDATE' then
    if coalesce(current_setting('app.allow_join_code_regen', true), '') <> '1' then
      new.join_code := old.join_code;
      return new;
    end if;
    if new.join_code is not distinct from old.join_code then
      return new;
    end if;
  end if;
  -- 30 bits of entropy make collisions with the UNIQUE constraint vanishingly
  -- rare; the retry loop is cheap insurance (esp. for the mass rotation below).
  loop
    new.join_code := public.gen_join_code();
    exit when attempts >= 5 or not exists (
      select 1 from public.teams t
      where t.join_code = new.join_code and t.id is distinct from new.id
    );
    attempts := attempts + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists teams_enforce_join_code on public.teams;
create trigger teams_enforce_join_code
  before insert or update on public.teams
  for each row execute function public.enforce_server_join_code();

-- ============================================================
-- 2. Tighten teams SELECT: drop the blanket policy
-- ============================================================
drop policy if exists "teams: read by join_code" on public.teams;

-- Creators may read the row they just created — required only for
-- INSERT ... RETURNING (PostgREST .insert().select()): at RETURNING time the
-- creator isn't a member yet (the admin row is added by an AFTER trigger).
-- Time-scoped so an ex-member creator doesn't keep reading the current
-- join code forever; after this window, membership governs visibility.
drop policy if exists "teams: read own created" on public.teams;
create policy "teams: read own created" on public.teams for select
  using (created_by = auth.uid() and created_at > now() - interval '1 minute');

-- Users with a pending join request may read the team row so their
-- "pending requests" UI can show the team name. With "jr: requester inserts"
-- dropped (below), the ONLY way to hold a pending request is the RPC, which
-- demands a currently-valid code — so this grants nothing to code-less users,
-- and it lapses as soon as the request is resolved.
drop policy if exists "teams: read if pending requester" on public.teams;
create policy "teams: read if pending requester" on public.teams for select
  using (
    exists (
      select 1 from public.join_requests jr
      where jr.team_id = public.teams.id
        and jr.user_id = auth.uid()
        and jr.status = 'pending'
    )
  );

-- ============================================================
-- 3. Remove the unconstrained self-join path
-- ============================================================
drop policy if exists "team_members: self join" on public.team_members;

-- ============================================================
-- 4. Join requests are created ONLY via the RPC below
-- ============================================================
-- The 0003 policy let any authenticated user INSERT a join_request for any
-- team knowing only its UUID (also with arbitrary status/resolved_* values,
-- forging the approval audit trail). All clients now request via
-- join_team_with_code(), which is SECURITY DEFINER and needs no INSERT policy.
drop policy if exists "jr: requester inserts" on public.join_requests;

-- A join_request can never be re-pointed at another team or user after
-- creation. (Permissive UPDATE policies OR together, so a requester+admin
-- combination could otherwise pass USING via one policy and WITH CHECK via
-- the other and rewrite team_id/user_id.)
create or replace function public.lock_join_request_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.team_id is distinct from old.team_id
     or new.user_id is distinct from old.user_id then
    raise exception 'join_request team/user cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists join_requests_lock_identity on public.join_requests;
create trigger join_requests_lock_identity
  before update on public.join_requests
  for each row execute function public.lock_join_request_identity();

-- ============================================================
-- 5. Requester may ONLY cancel a still-pending request
-- ============================================================
drop policy if exists "jr: requester cancels" on public.join_requests;
create policy "jr: requester cancels" on public.join_requests
  for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'cancelled');

-- ============================================================
-- 6. users.email is read-only (mirrors auth.users)
-- ============================================================
-- The admin approval panel renders requesters' public.users.email; letting
-- users rewrite their own row's email enables impersonation in front of the
-- approving admin. display_name stays editable.
create or replace function public.pin_user_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists users_pin_email on public.users;
create trigger users_pin_email
  before update on public.users
  for each row execute function public.pin_user_email();

-- ============================================================
-- 7. Rate-limit table for join attempts (RPC-internal)
-- ============================================================
create table if not exists public.join_code_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists join_code_attempts_user_time_idx
  on public.join_code_attempts (user_id, attempted_at);
-- No policies: the table is invisible to clients; only the SECURITY DEFINER
-- RPC (table owner) touches it.
alter table public.join_code_attempts enable row level security;
revoke all on public.join_code_attempts from anon, authenticated;

-- ============================================================
-- 8. RPC: join a team by code (validates everything server-side)
-- ============================================================
create or replace function public.join_team_with_code(p_code text, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Throttle brute-force code guessing: max 10 attempts per 5 minutes.
  delete from public.join_code_attempts
   where user_id = uid and attempted_at < now() - interval '5 minutes';
  if (select count(*) from public.join_code_attempts where user_id = uid) >= 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  insert into public.join_code_attempts (user_id) values (uid);

  select id, name, require_approval into t
  from public.teams
  where join_code = upper(trim(p_code));

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if exists (select 1 from public.team_members where team_id = t.id and user_id = uid) then
    return jsonb_build_object('status', 'already_member', 'team_id', t.id, 'team_name', t.name);
  end if;

  if t.require_approval then
    begin
      insert into public.join_requests (team_id, user_id, message)
      values (t.id, uid, nullif(trim(coalesce(p_message, '')), ''));
    exception when unique_violation then
      return jsonb_build_object('status', 'request_pending', 'team_id', t.id, 'team_name', t.name);
    end;
    return jsonb_build_object('status', 'request_sent', 'team_id', t.id, 'team_name', t.name);
  end if;

  -- If approval was turned off while this user's request was pending,
  -- resolve it (the 0003 trigger also inserts the membership) so admin
  -- panels don't list an existing member as pending forever.
  update public.join_requests
     set status = 'approved'
   where team_id = t.id and user_id = uid and status = 'pending';

  insert into public.team_members (team_id, user_id, role)
  values (t.id, uid, 'member')
  on conflict do nothing;
  return jsonb_build_object('status', 'joined', 'team_id', t.id, 'team_name', t.name);
end;
$$;

revoke execute on function public.join_team_with_code(text, text) from public, anon;
grant execute on function public.join_team_with_code(text, text) to authenticated;

-- ============================================================
-- 9. RPC: regenerate a team's join code (admin only)
-- ============================================================
create or replace function public.regenerate_join_code(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.is_team_admin(p_team_id) then
    raise exception 'Only team admins can regenerate the join code';
  end if;

  -- Transaction-local flag: the ONLY doorway through which a join code may
  -- change on UPDATE (see enforce_server_join_code). Cleared immediately so
  -- it can't leak to later statements in the same transaction.
  perform set_config('app.allow_join_code_regen', '1', true);

  update public.teams
     set join_code = public.gen_join_code()
   where id = p_team_id
   returning join_code into new_code;

  perform set_config('app.allow_join_code_regen', '', true);

  return new_code;
end;
$$;

revoke execute on function public.regenerate_join_code(uuid) from public, anon;
grant execute on function public.regenerate_join_code(uuid) to authenticated;

-- Keep service_role able to call the RPCs (revoking from PUBLIC removed its
-- implicit grant). Guarded so the migration also runs on plain Postgres.
-- Note the RPCs still require a user context (auth.uid()); service-role
-- flows should write the tables directly.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.join_team_with_code(text, text) to service_role;
    grant execute on function public.regenerate_join_code(uuid) to service_role;
  end if;
end $$;

-- ============================================================
-- 10. Rotate all existing join codes — ONE-TIME, DISRUPTIVE.
-- ============================================================
-- Every existing code was generated with Math.random() AND was readable by
-- every authenticated user, so all of them must be treated as leaked.
-- Admins must re-share codes after this runs.
--
-- WARNING: applying this file AGAIN rotates all codes AGAIN (the DDL above is
-- idempotent; this statement is not). Don't mix manual SQL-editor runs with
-- `supabase db push` of the same file.
select set_config('app.allow_join_code_regen', '1', false);
update public.teams set join_code = public.gen_join_code();
select set_config('app.allow_join_code_regen', '', false);
