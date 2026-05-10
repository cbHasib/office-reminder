-- Optional seed data for local dev. Run after creating a test user via Auth.
-- Replace the UUIDs with your test user's id (find it in Auth > Users).

-- INSERT INTO public.teams (id, name, join_code, created_by)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Office', 'DEMO01', '<your-user-uuid>');

-- Daily Dhuhr prayer at 13:15 local time, 5 min advance warning
-- INSERT INTO public.reminders (team_id, title, description, scheduled_at, rrule, advance_minutes, created_by)
-- VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   'Dhuhr prayer',
--   'Time for Dhuhr',
--   (now()::date + interval '13 hours 15 minutes')::timestamptz,
--   'FREQ=DAILY;BYHOUR=13;BYMINUTE=15',
--   5,
--   '<your-user-uuid>'
-- );
