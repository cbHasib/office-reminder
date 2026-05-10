# Walkthrough — zero to working app

Written for: macOS, Node.js already installed, comfortable in Terminal.
Estimated time end-to-end: **~45 minutes** (most of that is Cargo's first compile, which runs in the background while you do other steps).

> **Heads up about the folder name.** Your project lives at `/Users/hasib/Desktop/Office Reminder` — the space in "Office Reminder" matters. Whenever you `cd` into it, wrap the path in quotes:
> ```bash
> cd "/Users/hasib/Desktop/Office Reminder"
> ```

---

## Step 1 — Install the missing tools (one-time, ~10 min)

You have Node. You're missing **pnpm** (the package manager I used) and **Rust** (the desktop app's runtime). You also need Xcode Command Line Tools so Rust can build Mac apps.

```bash
# pnpm — fast Node package manager
npm install -g pnpm

# Xcode Command Line Tools (might already be installed; this no-ops if so)
xcode-select --install

# Rust (one-line installer, accept the default options)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Reload your shell so cargo / rustc are on PATH
source "$HOME/.cargo/env"
```

**Verify everything is there:**

```bash
node --version    # should print v20.x or v22.x
pnpm --version    # should print 9.x
rustc --version   # should print rustc 1.80+
```

If any of those fail, fix that one before moving on. Most common gotcha: you need to open a new Terminal window after installing Rust so the PATH refreshes.

---

## Step 2 — Create your Supabase project (one-time, ~5 min)

Supabase is going to host your database and handle login/signup for free. You don't run any servers yourself.

1. Go to **https://supabase.com** and sign up (use the same email you'll use as the app's first admin if you want — it doesn't actually matter).
2. Click **New project**.
3. Pick any organization (it auto-creates one called your name).
4. Fill in:
   - **Name**: `office-reminder` (or whatever)
   - **Database Password**: generate a strong one — copy it somewhere safe, but you won't actually need it for this walkthrough.
   - **Region**: pick the closest to your office.
5. Click **Create new project** and wait ~2 minutes for it to provision.

While it's spinning up, leave the tab open and move to Step 3.

---

## Step 3 — Run the database recipe (~2 min)

Once Supabase says your project is ready:

1. In the left sidebar, click the **SQL Editor** icon (looks like `>_`).
2. Click **+ New query** at the top.
3. Open the file **`supabase/migrations/0001_initial_schema.sql`** from your project folder in any text editor (TextEdit, VS Code, whatever). Select all (`Cmd+A`), copy (`Cmd+C`).
4. Paste into the Supabase SQL editor and click the green **Run** button at the bottom right.

You should see a success message at the bottom — something like *"Success. No rows returned"*. If you see an error, it's almost certainly that you ran it twice or skipped a line — clear the editor and paste fresh.

**Check it worked:** click the **Table Editor** (database icon) in the sidebar. You should see tables: `users`, `teams`, `team_members`, `reminders`, `user_settings`, `reminder_dismissals`. If they're there, the database is done.

### Step 3a — Turn off email confirmation (for development)

So you can sign up without setting up an email server:

1. In the sidebar, click **Authentication → Sign In / Providers**.
2. Click **Email**.
3. Scroll down, **un-check "Confirm email"**, click **Save**.

(Turn this back on later when you're done testing, or set up an email provider in Supabase's settings.)

---

## Step 4 — Get your API keys

1. In the Supabase sidebar, click the gear icon (**Project Settings**) at the bottom.
2. Click **API** in the settings menu.
3. Copy two values somewhere — Notes app, sticky note, whatever:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key under "Project API keys" — a long string starting with `eyJ…` (NOT the service_role key — leave that one alone)

---

## Step 5 — Create the env files (~2 min)

Open Terminal and run:

```bash
cd "/Users/hasib/Desktop/Office Reminder"

# Create env files for both apps
cp .env.example apps/web/.env.local
cp .env.example apps/desktop/.env.local
```

Now edit both files. The fastest way:

```bash
# Open both in your default editor (or use `code` if you have VS Code)
open -e apps/web/.env.local
open -e apps/desktop/.env.local
```

In each file, replace the placeholder values with your real Supabase URL and anon key. The same URL and same key go in **both** files.

After editing, `apps/web/.env.local` should look like this (with your real values):

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your real anon key
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your real anon key
SUPABASE_SERVICE_ROLE_KEY=  ← leave blank or delete this line, we don't use it
```

(The web app reads the `NEXT_PUBLIC_*` lines and ignores the `VITE_*` ones; the desktop app does the opposite. Putting both in keeps the files identical and easier to copy-paste.)

---

## Step 6 — Install all dependencies (~3 min)

From the project root:

```bash
cd "/Users/hasib/Desktop/Office Reminder"
pnpm install
```

This installs the Node packages for the web app, the desktop app, and the shared types — all in one go. Expect ~3 minutes the first time. You'll see a bunch of progress bars.

Ignore any "peer dependency" warnings — they're cosmetic.

---

## Step 7 — Run the web admin and create your account (~5 min)

```bash
pnpm web:dev
```

You should see something like:

```
▲ Next.js 14.2.5
- Local:        http://localhost:3000
✓ Ready in 1.8s
```

Open **http://localhost:3000** in your browser. You should see the landing page with "Office Reminder" and Create account / Log in buttons.

1. Click **Create an account**, fill in display name + email + password (8+ chars).
2. After submitting, you'll be redirected to the login page. Log in with the same credentials.
3. You'll land on `/dashboard/teams` with "You're not in any teams yet."
4. Under **Create a team**, type a name like "My Office" and click Create.
5. You'll go to the team's page — note the 6-character **join code** at the top. That's what you'll share with teammates later.
6. Click **+ New reminder** at the top right. Set:
   - **Title**: "Test reminder"
   - **Description**: "Make sure this works"
   - **Date & time**: 3 minutes from now (use the date/time picker)
   - **Warn**: 2 minutes
   - **Recurrence**: One-off
7. Click **Create reminder**. It appears in the list.

Leave the web app running. Open a **new Terminal tab** for the next step.

---

## Step 8 — Run the desktop app (~10 min, mostly Cargo compiling)

In a new Terminal tab:

```bash
cd "/Users/hasib/Desktop/Office Reminder"
pnpm desktop:dev
```

**The first time this runs it takes 5–10 minutes** because Cargo compiles the entire Tauri framework. You'll see lots of `Compiling foo v0.1.0` lines. This only happens once — subsequent runs are seconds.

Eventually a small native window opens titled "Office Reminder" with a login form.

1. Log in with the same email + password you used in Step 7.
2. The window now shows "Upcoming reminders" with your test reminder listed.
3. Wait until the reminder is 2 minutes away from firing — a small dark countdown overlay should slide in from the bottom-right of your screen.
4. Watch the background go from slate → amber → red as the timer counts down.
5. At zero it freezes on "Now" and a **Dismiss** button appears.

If all that happens — you have a working app. 🎉

> Don't have an icon yet? The desktop app warns about missing tray icons but still runs. To add a placeholder: drop any 32×32 PNG into `apps/desktop/src-tauri/icons/icon.png` and restart `pnpm desktop:dev`. To generate the full icon set from a single 1024×1024 PNG, run `cd apps/desktop && pnpm tauri icon path/to/source.png` once.

---

## Step 9 — (Optional) Build a real installer for your office

When you're happy with how it works:

```bash
cd "/Users/hasib/Desktop/Office Reminder/apps/desktop"
pnpm tauri build
```

After ~10 minutes, your installer is at:

```
apps/desktop/src-tauri/target/release/bundle/dmg/Office Reminder_0.1.0_aarch64.dmg
```

(For Apple Silicon Macs. Intel Macs get `_x86_64.dmg`.)

That `.dmg` is what you give to your Mac-using teammates. They double-click, drag the app into Applications, and run it.

For Windows installers, you have to run `pnpm tauri build` on a Windows machine. Same for Linux. (Tauri can't cross-compile easily.) If your office is all Mac, you only need the one above.

> macOS will warn unidentified-developer the first time. Right-click the app → Open → Open. Or for wider distribution, sign with an Apple Developer ID ($99/year) — see the SETUP.md file for details.

---

## Step 10 — (Optional) Put the web admin online so teammates can sign up

Right now your web admin only runs on your laptop. To make it accessible at a real URL:

1. Push the project to a GitHub repo (private is fine).
2. Sign up at **https://vercel.com** with your GitHub account (free).
3. Click **New Project** → import the repo.
4. **Important**: change the **Root Directory** to `apps/web`.
5. Under **Environment Variables**, add the same values from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click **Deploy**. After ~2 minutes, you get a URL like `https://office-reminder-yourname.vercel.app`.

Now your teammates:

1. Go to that URL → sign up → log in.
2. On the teams page, paste your team's **join code** under "Join a team".
3. Install the desktop `.dmg` (or .msi/.AppImage on their OS) → log in with the same account.
4. They start receiving reminders automatically.

---

## What you actually need to remember

Most of the above is one-time setup. Day-to-day, you'll only do this:

```bash
# Start the apps locally for testing
cd "/Users/hasib/Desktop/Office Reminder"
pnpm web:dev      # web admin at localhost:3000
pnpm desktop:dev  # desktop app
```

To create a reminder, log into the web admin → click your team → "+ New reminder."

To onboard a new teammate: hand them the Vercel URL + the team's join code + the installer for their OS.

---

## When something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| `pnpm: command not found` | Step 1 didn't take | Re-run `npm install -g pnpm`, open a new Terminal |
| `cargo: command not found` | Rust install needs new shell | Open a new Terminal, or run `source "$HOME/.cargo/env"` |
| Web app won't start, "supabaseUrl is required" | env file isn't being read | Make sure it's named `.env.local` (note the leading dot) and lives at `apps/web/.env.local` |
| Sign-up succeeds but you can't log in | Email confirmation is on | Re-do step 3a, or check your inbox for the confirmation link |
| Reminder shows in web app, but desktop never fires | Desktop can't talk to Supabase | Check `apps/desktop/.env.local` has the `VITE_*` lines filled in. Restart `pnpm desktop:dev` after editing — Vite reads env at startup |
| Reminder fires but the overlay doesn't appear | Permission missing | Make sure `apps/desktop/src-tauri/capabilities/default.json` is unmodified — it grants the right to spawn windows |
| `pnpm tauri build` fails with "icon not found" | Tauri wants a real icon | Run `pnpm tauri icon /path/to/any-1024x1024.png` from `apps/desktop/` to generate the full set |

If you hit something not on this list, copy the error message into our chat and I'll help debug.

---

## Where the files are (so you don't get lost)

```
Office Reminder/
├── PROJECT_PLAN.md     ← the design (read once for context)
├── SETUP.md            ← reference setup guide (more terse)
├── WALKTHROUGH.md      ← this file
├── README.md           ← short overview
│
├── apps/
│   ├── web/            ← the admin website (you'll edit pages here)
│   └── desktop/        ← the desktop app (UI in src/, Tauri shell in src-tauri/)
├── packages/shared/    ← shared types both apps use
└── supabase/migrations/← the SQL recipe you ran in Step 3
```
