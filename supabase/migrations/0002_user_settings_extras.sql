-- Adds the new per-user settings exposed in v0.2: theme, overlay position, sound choice.
-- Run this in your Supabase SQL editor after 0001.

-- Theme: system / light / dark
alter table public.user_settings
  add column if not exists theme text not null default 'system'
  check (theme in ('system', 'light', 'dark'));

-- Where the countdown overlay appears on screen.
alter table public.user_settings
  add column if not exists overlay_position text not null default 'top-right'
  check (overlay_position in (
    'top-right', 'top-left', 'bottom-right', 'bottom-left',
    'top-center', 'bottom-center'
  ));

-- Which built-in chime to use when sound_enabled is true.
alter table public.user_settings
  add column if not exists sound_name text not null default 'chime'
  check (sound_name in ('chime', 'bell', 'ding', 'soft', 'alert'));
