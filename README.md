# Office Reminder

Multi-tenant cross-platform desktop reminder system. Sign up, create a team, share a join code, and push time-based reminders that pop up as a countdown overlay on every member's PC.

Designed to replace the "send a WhatsApp reminder and hope they see it" pattern that most offices fall back on for prayer times, recurring meetings, and one-off events.

## What you get

- **Web admin dashboard** (Next.js) — sign up, create or join a team, write reminders.
- **Desktop client** (Tauri, Mac/Windows/Linux) — sits in the system tray, slides a countdown overlay onto the screen N minutes before each reminder, and gradually turns red as the deadline approaches.
- **Per-user settings** — sound (off by default), dismissibility (off by default), advance-warning override, mute specific reminders.
- **Multi-tenant** — anyone can run a team. Join codes invite new members.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for the full design. See [SETUP.md](./SETUP.md) for the step-by-step setup guide.

## Quick start (for developers)

```bash
# 1. Install pnpm if you don't have it
npm install -g pnpm

# 2. Install all workspace dependencies
pnpm install

# 3. Set up Supabase (one time) — see SETUP.md for details
#    Create a project at https://supabase.com
#    Run supabase/migrations/0001_initial_schema.sql in the SQL editor
#    Copy your project URL and anon key into .env.local files

# 4. Run the web admin
pnpm web:dev          # opens http://localhost:3000

# 5. Run the desktop client (in another terminal)
pnpm desktop:dev      # spawns the Tauri dev window
```

## Project layout

```
apps/web/           Next.js admin dashboard
apps/desktop/       Tauri desktop client
packages/shared/    Shared TypeScript types
supabase/           Database schema and seed data
```

## Tech

Supabase (managed Postgres + auth + realtime) backs both apps. Both UIs are TypeScript + React. The desktop app is wrapped in Tauri for tiny installers and native always-on-top windows.

## Status

This is the v0 scaffold — the design is locked, the schema is final, the foundational code is in place. Next steps are wired in [PROJECT_PLAN.md § Build phases](./PROJECT_PLAN.md#build-phases).
