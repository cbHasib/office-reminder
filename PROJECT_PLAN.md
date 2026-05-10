# Office Reminder — Project Plan

A multi-tenant cross-platform desktop reminder system. Anyone can sign up, create a team, share a join code, and the team's admins can push time-based reminders that appear as a countdown overlay on every member's computer.

## Product summary

**Problem.** Offices use WhatsApp groups for time-sensitive reminders (prayer times, daily standups, one-off meetings). People working at their PC miss these because they're not on their phone.

**Solution.** A small desktop app that sits in the system tray on Mac / Windows / Linux. When a reminder is due, an always-on-top countdown overlay slides in showing the title, description, and time remaining. The overlay's color shifts from neutral → amber → red as the deadline approaches. After the deadline it freezes and either auto-closes or waits for dismissal, depending on the user's setting.

**Multi-tenant from day one.** Any office can use it. Sign up → create a team → share a 6-character join code. Other team members install the desktop app, log in, enter the code, and start receiving the team's reminders.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Database + auth + realtime | **Supabase** (managed Postgres) | Free tier comfortably covers an office; built-in auth, row-level security, and realtime subscriptions remove a huge amount of backend work. |
| Web admin dashboard | **Next.js 14** (App Router) + TypeScript + Tailwind, deployed on **Vercel** | Industry-standard React framework, free hosting, handles SSR + auth cleanly. |
| Desktop client | **Tauri 2** (Rust shell + React/TypeScript frontend) | ~10 MB installers vs. Electron's 150 MB+. Native system-tray and always-on-top window APIs. Same React skills as the web side. |
| Local cache (desktop) | **SQLite** via `tauri-plugin-sql` | So reminders fire even if the user is briefly offline. |
| Shared types | A small `packages/shared` workspace | One source of truth for `Reminder`, `UserSettings`, etc. across web + desktop. |
| Package manager | **pnpm workspaces** | Cleanest monorepo story. |

A single language (TypeScript) covers everything UI-side; Rust only shows up in the Tauri shell where you barely have to touch it.

## Architecture

```
┌────────────────────────┐         ┌──────────────────────────┐
│  Web admin dashboard   │         │   Desktop client (tray)  │
│  Next.js on Vercel     │         │   Tauri + React          │
│                        │         │                          │
│  • signup / login      │         │  • login                 │
│  • create / join team  │         │  • subscribe to team     │
│  • CRUD reminders      │         │  • local SQLite cache    │
│  • manage members      │         │  • scheduler             │
│  • personal settings   │         │  • countdown overlay     │
└──────────┬─────────────┘         └────────────┬─────────────┘
           │                                    │
           │            Supabase                │
           │  ┌──────────────────────────────┐  │
           └─▶│  Auth (email + password)     │◀─┘
              │  Postgres (RLS-secured)      │
              │  Realtime (websocket push)   │
              └──────────────────────────────┘
```

**Sync model.** The desktop client opens a Supabase realtime subscription on the team's `reminders` table. Any insert/update/delete is pushed instantly. On startup it also fetches the next 24 hours of reminders into local SQLite, so brief network blips don't cause missed alerts.

**Scheduling.** A 30-second tick in the desktop client looks at the local cache, finds reminders whose `(scheduled_at - advance_minutes)` is now or in the past but whose `scheduled_at` is still in the future, and shows the overlay if it isn't already on screen.

## Data model

```
users                   ← managed by Supabase Auth
  id (uuid, pk)
  email
  display_name
  created_at

teams
  id (uuid, pk)
  name
  join_code (text, unique, 6 chars)
  created_by (uuid → users)
  created_at

team_members
  team_id (uuid → teams)
  user_id (uuid → users)
  role (enum: 'admin' | 'member')
  joined_at
  PRIMARY KEY (team_id, user_id)

reminders
  id (uuid, pk)
  team_id (uuid → teams)
  title (text)
  description (text)
  scheduled_at (timestamptz)         -- the moment the event happens
  rrule (text, nullable)             -- RFC 5545 recurrence rule for prayer times etc.
  advance_minutes (int)              -- how early the overlay should appear
  audience (enum: 'all' | 'specific')
  target_user_ids (uuid[])           -- when audience = 'specific'
  created_by (uuid → users)
  created_at
  updated_at

user_settings
  user_id (uuid, pk → users)
  sound_enabled (bool, default false)
  dismissible (bool, default false)
  advance_minutes_override (int, nullable)   -- if set, overrides reminder.advance_minutes
  muted_reminder_ids (uuid[], default '{}')

reminder_dismissals               -- audit trail; useful for "who saw what"
  reminder_id (uuid → reminders)
  user_id (uuid → users)
  fired_at (timestamptz)
  dismissed_at (timestamptz, nullable)
  PRIMARY KEY (reminder_id, user_id, fired_at)
```

**Recurrence.** The `rrule` column stores a standard RFC 5545 string (e.g. `FREQ=DAILY;BYHOUR=13;BYMINUTE=15` for the daily Dhuhr prayer). The desktop client expands the rrule to find the next occurrence. The `rrule` library on npm handles this; it works the same way in the web app for previewing upcoming fires.

## Row-level security

Every table is locked down so users only see rows for teams they belong to.

- `teams`: SELECT allowed if the caller is in `team_members` for that team. INSERT allowed for any authenticated user (creating a team).
- `team_members`: SELECT allowed for any team the caller is a member of. INSERT for the team owner / admins.
- `reminders`: SELECT for any team member; INSERT/UPDATE/DELETE only for `role = 'admin'`.
- `user_settings`: SELECT/UPDATE only the caller's own row.
- `reminder_dismissals`: INSERT only the caller's own row; SELECT only the caller's own rows.

Policies are written in the SQL migration so they're tracked in git.

## Permissions and roles

- **Team creator** is automatically `admin` of that team.
- **Admins** can: edit team name, generate a new join code, add/remove members, change member roles, create/edit/delete reminders.
- **Members** can: see reminders, edit their own user settings, leave the team.

A user can belong to multiple teams (e.g. main office team + a smaller project sub-team). The desktop app shows reminders from all of them.

## User-side settings (per the spec)

| Setting | Default | Notes |
|---|---|---|
| Notification sound | **Off** | When on, plays a short chime when the overlay appears and again at T-0. |
| Overlay dismissible | **Non-dismissible** | When non-dismissible, the close button is hidden until `scheduled_at + 5 min` has passed (configurable). |
| Advance-warning override | none | Optional per-user override of the reminder's `advance_minutes`. |
| Mute specific reminders | empty | A user can opt out of any specific reminder, e.g. someone non-Muslim opting out of prayer reminders. |

## Overlay behavior in detail

1. At `scheduled_at - advance_minutes` the desktop app spawns a small frameless always-on-top window in the bottom-right of the active monitor (~360×140 px).
2. The window contents: title (bold), description (one line), big countdown ("4:32 remaining"). Background gradient transitions from `#1f2937` (slate) at the start, through amber, to `#dc2626` (red) at T-0. The transition is smooth — interpolated each second.
3. If the user's setting is `sound_enabled = true`, a soft chime plays once when the overlay appears.
4. At T-0 the countdown freezes at "Now" and the background holds at red. A second chime plays if sound is on.
5. After T-0 the dismiss button appears (always, regardless of `dismissible` setting — the non-dismissible rule only blocks closing *during* the countdown, not after the event).
   - If `dismissible = true`, the close button is also visible during the countdown.
6. Auto-close 5 minutes after T-0 if the user hasn't dismissed it.
7. Each lifecycle event writes to `reminder_dismissals` for the audit trail.

## Repo layout

```
office-reminder/
├── PROJECT_PLAN.md            ← this file
├── README.md                  ← root readme + setup instructions
├── SETUP.md                   ← Supabase project setup, deploy, etc.
├── pnpm-workspace.yaml
├── package.json
├── apps/
│   ├── web/                   ← Next.js admin dashboard
│   │   ├── app/
│   │   │   ├── (marketing)/page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── (dashboard)/
│   │   │       ├── layout.tsx
│   │   │       ├── teams/page.tsx
│   │   │       ├── teams/[teamId]/page.tsx
│   │   │       ├── teams/[teamId]/reminders/new/page.tsx
│   │   │       ├── teams/[teamId]/members/page.tsx
│   │   │       └── settings/page.tsx
│   │   ├── lib/supabase.ts
│   │   ├── lib/rrule.ts
│   │   ├── components/
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── desktop/               ← Tauri app
│       ├── src/               ← React UI (login, settings, overlay)
│       │   ├── App.tsx
│       │   ├── windows/Overlay.tsx
│       │   ├── windows/Settings.tsx
│       │   ├── lib/supabase.ts
│       │   ├── lib/scheduler.ts
│       │   └── lib/cache.ts
│       ├── src-tauri/
│       │   ├── src/main.rs
│       │   ├── tauri.conf.json
│       │   └── Cargo.toml
│       └── package.json
├── packages/
│   └── shared/                ← Shared types and helpers
│       ├── src/types.ts
│       └── package.json
└── supabase/
    ├── migrations/
    │   └── 0001_initial_schema.sql
    └── seed.sql
```

## Build phases

1. **Foundation** — monorepo, shared types, Supabase schema and RLS, env-var conventions.
2. **Web MVP** — auth, team create/join, reminder list + create form (one-time only), settings page.
3. **Desktop MVP** — login, fetch reminders, scheduler, countdown overlay window, honoring sound + dismissibility.
4. **Recurrence** — `rrule` support in both the web form (with a friendly UI) and the desktop scheduler.
5. **Polish** — system tray menu, auto-launch on login, code signing for Mac/Windows installers, OS-native notifications as backup.
6. **Optional later** — per-team branding, audit dashboard, mobile companion (React Native sharing the same Supabase backend).

## Security and privacy notes

- Auth tokens stored in the OS keychain via `tauri-plugin-stronghold` (or the simpler `tauri-plugin-store` for v1).
- All Supabase access goes through the user's JWT; the desktop app never sees the service-role key.
- RLS is the only thing standing between teams; we test it explicitly with anonymous and cross-team users in the SQL migration tests.
- Join codes are 6-character base32 (no ambiguous chars); regenerable by an admin if leaked.
- No PII collected beyond email and display name.

## Costs (rough)

- Supabase free tier: 500 MB database, 2 GB bandwidth, 50k monthly active users — comfortably covers an office and many trial customers.
- Vercel free tier: enough for the admin dashboard.
- Code signing certificates if distributing publicly: Apple Developer ID ($99/yr), Windows Authenticode (~$200/yr). For internal office use, you can ship unsigned and tell users to allow it in security settings.

Total to run this for one office: **$0/month**.
