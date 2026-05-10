# Setup Guide

End-to-end instructions to get Office Reminder running on your machine — and onto your office's PCs.

## 1. Prerequisites

Install once, on the developer machine:

- **Node.js 20+** — https://nodejs.org
- **pnpm** — `npm install -g pnpm`
- **Rust toolchain** (for building the desktop app) — https://rustup.rs
- **Tauri prerequisites** for your OS — https://tauri.app/start/prerequisites/
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: Microsoft C++ Build Tools, WebView2 (preinstalled on Win 11)
  - Linux: `sudo apt install libwebkit2gtk-4.1-dev libssl-dev pkg-config build-essential`

## 2. Supabase project (one-time, ~5 minutes)

1. Sign up free at https://supabase.com and create a new project. Pick a region close to your office.
2. While it spins up, grab two values from **Project Settings → API**:
   - **Project URL** (looks like `https://abcd.supabase.co`)
   - **anon public key** (a long JWT string starting with `eyJ…`)
3. Once the database is ready, open the **SQL Editor**, paste the contents of [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql), and run it. You should see "Success. No rows returned."
4. Under **Authentication → Sign In / Providers**, leave "Email" enabled. Optionally turn off "Confirm email" while developing so signups work without an SMTP setup; turn it back on for production.

That's the entire backend. No servers to run.

## 3. Wire up the env vars

Copy [`.env.example`](./.env.example) into the right places:

```bash
# Web app
cp .env.example apps/web/.env.local

# Desktop app
cp .env.example apps/desktop/.env.local
```

Open each file and fill in the values from step 2. The web app reads `NEXT_PUBLIC_*` vars; the desktop app reads `VITE_*` vars.

> The anon key is *safe* to ship in clients — Row-Level Security in the database does the actual access control. Never commit the **service role** key.

## 4. Install dependencies

```bash
pnpm install
```

This installs all workspaces (web, desktop, shared) in one shot.

## 5. Run the web admin dashboard

```bash
pnpm web:dev
# → http://localhost:3000
```

Sign up for an account, then log in. You'll land at `/dashboard/teams`. Create a team — note the 6-character join code that's generated.

## 6. Run the desktop client (in another terminal)

```bash
pnpm desktop:dev
```

The first run takes a few minutes (Cargo compiles the Tauri shell). After that, a small window opens. Log in with the same account, and you'll see your team's reminders. Open the web app, create a reminder for a few minutes from now with a 2-minute lead — watch the overlay slide in on your desktop.

> If you don't have a tray icon yet, the app will still run; create one by adding any 32×32 transparent PNG at `apps/desktop/src-tauri/icons/icon.png`. To generate the full icon set automatically: `cd apps/desktop && pnpm tauri icon path/to/source-1024.png`.

## 7. Build production installers

```bash
# from apps/desktop/
pnpm tauri build
```

Output appears under `apps/desktop/src-tauri/target/release/bundle/`:

| OS | What you get |
|---|---|
| macOS | `Office Reminder.app` and a `.dmg` |
| Windows | `.msi` and `.exe` installers |
| Linux | `.AppImage`, `.deb`, and `.rpm` |

For internal office use you can ship unsigned and tell users to allow it in their OS security settings. For wider distribution, see "Code signing" below.

## 8. Deploy the web admin

The simplest path is **Vercel**:

1. Push the repo to GitHub.
2. Import the repo at https://vercel.com/new.
3. Set the **Root Directory** to `apps/web`.
4. Add the two env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Deploy. You'll get a `your-project.vercel.app` URL.

Now your team members can sign up at that URL and join your team using the code, then install the desktop app to start receiving reminders.

## 9. Onboarding teammates

Hand each person:

1. **The web URL** (your Vercel deploy) so they can sign up.
2. **The team join code** (6 characters from your team's page).
3. **The desktop installer** for their OS (built in step 7).

In the desktop app they log in once; from then on the tray icon stays running and they get countdown overlays for every team reminder.

## Code signing (optional, for public distribution)

- **macOS**: Apple Developer account ($99/yr) → set `APPLE_SIGNING_IDENTITY` and notarize via `tauri build --target universal-apple-darwin`.
- **Windows**: Authenticode certificate (~$200/yr from a CA) → configure `signingIdentity` in `tauri.conf.json`.
- **Linux**: usually unsigned; users trust the package by source.

For an internal office tool, skip signing and just enable installs in your OS security pane.

## Troubleshooting

- **Login works on web but not desktop**: confirm the `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` env vars are set in `apps/desktop/.env.local`. Vite reads them at build time, so restart `pnpm desktop:dev` after editing.
- **Reminders don't show up on desktop**: in the Supabase dashboard → Database → Replication, make sure the `reminders` and `team_members` tables have realtime turned on. The migration enables this automatically; if you skipped it, run the `alter publication supabase_realtime add table …` lines manually.
- **Overlay never appears**: check the desktop dev console for errors. Most likely the reminder is in the past, or your `audience` is `specific` and you're not in `target_user_ids`.
- **`pnpm tauri dev` fails to compile on Linux**: reread the prerequisites at https://tauri.app/start/prerequisites/ — the WebKit GTK package name varies by distro.

## Where to next

See [PROJECT_PLAN.md § Build phases](./PROJECT_PLAN.md#build-phases) for the road ahead — recurrence-rule UI, audit dashboard, mobile companion, etc.
