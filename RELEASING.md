# Cutting a release

Your source code lives in a **private** repo (`cbHasib/office-reminder`). Installers are published to a **public** mirror repo (`cbHasib/office-reminder-releases`) so anyone can download them without a GitHub login. The build workflow lives in the private repo but pushes its release to the public one.

## One-time setup (~5 min)

### 1. Create the public mirror repo

Go to https://github.com/new and create:

- **Owner:** `cbHasib`
- **Name:** `office-reminder-releases`
- **Visibility:** Public
- **Initialize with:** README (so the repo isn't empty)

That's it — this repo never gets any code. It only holds release artifacts.

### 2. Generate a fine-grained Personal Access Token

GitHub → **Settings** (your account, not the repo) → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.

- **Token name:** `office-reminder-releases-write`
- **Expiration:** 1 year (set a calendar reminder to rotate)
- **Resource owner:** `cbHasib`
- **Repository access:** **Only select repositories** → pick `office-reminder-releases`
- **Permissions** → Repository permissions:
  - **Contents:** Read and write
  - (Metadata is automatically Read-only, that's fine)
- Click **Generate token**. Copy the `github_pat_…` string.

### 3. Add the secret + variable to the source repo

In `cbHasib/office-reminder` (the private one):

**Settings → Secrets and variables → Actions → Secrets tab → New repository secret**

- `RELEASES_PAT` — paste the PAT from step 2
- `VITE_SUPABASE_URL` — your Supabase URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

**Settings → Secrets and variables → Actions → Variables tab → New repository variable**

- `RELEASES_REPO` — `cbHasib/office-reminder-releases`

### 4. Allow Actions to run

Settings → Actions → General → Workflow permissions → **Read and write permissions**. Save.

### 5. Configure the web app to point at the mirror

Vercel project → Settings → Environment Variables:

- `NEXT_PUBLIC_GITHUB_REPO` — `cbHasib/office-reminder-releases`

Locally, set the same in `apps/web/.env.local`.

---

## Cutting a release — the 60-second loop

```bash
# 1. Bump version in three files at once
./scripts/bump-version.sh 0.1.0

# 2. Commit, tag, push
git add -A
git commit -m "release: v0.1.0"
git tag v0.1.0
git push origin main --tags
```

3. Watch the build at `https://github.com/cbHasib/office-reminder/actions`. Four runners spin up:
   - macOS Apple Silicon
   - macOS Intel
   - Windows
   - Ubuntu

4. ~15 minutes later, your **public** release page is live at:

   `https://github.com/cbHasib/office-reminder-releases/releases/latest`

   And your hosted `/download` page on Vercel shows all four installers automatically (5-minute cache).

That's it. Share `your-app.vercel.app/download` with your office — they click, install, log in.

---

## Manual trigger (no tag)

To run a build for testing without releasing: Actions tab → **Build & publish installers** → **Run workflow** → leave the tag input empty → Run. Installers come back as workflow artifacts that only you can download (from the run page). No release is created.

To create a release retroactively, run the workflow with the tag input filled in (e.g. `v0.1.1`).

---

## Yanking a bad release

If you shipped a broken build:

```bash
# 1. Delete the release in the PUBLIC repo UI:
#    github.com/cbHasib/office-reminder-releases/releases → bad version → Delete

# 2. Delete the tag in the PRIVATE source repo:
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# 3. Fix the issue, bump to v0.1.1, push again
./scripts/bump-version.sh 0.1.1
git add -A && git commit -m "release: v0.1.1" && git tag v0.1.1
git push origin main --tags
```

The cached `/download` page refreshes within 5 minutes.

---

## How the mirror works under the hood

The build workflow runs in the private source repo. When it hits the publish step:

- For a **tagged push** or **manual run with a tag**, it sets `GITHUB_TOKEN=$RELEASES_PAT` and `GITHUB_REPOSITORY=$RELEASES_REPO` on the `tauri-action` step. The action then creates/updates the release in the **public** mirror, attaching the `.dmg` / `.msi` / `.deb` / `.AppImage`.
- For a **build-only run** (no tag), it uses the default token + repo, so nothing is published — installers come back as artifacts.

Your private repo never leaks. The public mirror only contains compiled binaries and the release notes you wrote.

---

## Adding code signing (optional)

For internal-office use, unsigned is fine — your teammates do the right-click-Open or "Run anyway" dance once. If you start distributing to strangers:

- **macOS** ($99/yr Apple Developer): set `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` as repo secrets. The workflow already reads them.
- **Windows** ($150–300/yr Authenticode cert): set `WINDOWS_CERTIFICATE` (base64 `.pfx`) and `WINDOWS_CERTIFICATE_PASSWORD`. You'll also configure `signingIdentity` in `apps/desktop/src-tauri/tauri.conf.json` and add a Windows signing step.

Full setup at [tauri.app/develop/sign-macos](https://tauri.app/develop/sign-macos/) and [tauri.app/develop/sign-windows](https://tauri.app/develop/sign-windows/).
