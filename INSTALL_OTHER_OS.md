# Installing on Windows and Ubuntu

The desktop app is the same Tauri binary on all three OSes, but Tauri can't cross-compile easily — each OS has to build its own installer. You have three options, in order of effort:

1. **Easiest** — let GitHub Actions build all three installers for you on every git push.
2. **Manual** — sit down at a Windows PC / Ubuntu machine and run `pnpm tauri build` there.
3. **Cloud builders** — use a CI service like CircleCI / Buildkite if you don't want GitHub.

This doc covers (1) end to end, plus the manual fallback. End-users (your teammates) only ever download a finished installer and double-click — they don't need any of the build tooling.

## What end-users get

| OS | What you give them |
|---|---|
| macOS | `Office Reminder_0.1.0_aarch64.dmg` (Apple Silicon) or `..._x64.dmg` (Intel) |
| Windows 10/11 | `Office Reminder_0.1.0_x64-setup.exe` or `..._x64_en-US.msi` |
| Ubuntu 22.04+ | `office-reminder_0.1.0_amd64.deb` or `office-reminder_0.1.0_amd64.AppImage` |

End-user steps:

- **macOS**: double-click the `.dmg`, drag the app into Applications. First launch: right-click the app → Open → Open (this is needed once, because the app isn't signed by Apple).
- **Windows**: double-click the `.msi` or `-setup.exe`. Windows SmartScreen may warn "Unknown publisher" — click **More info → Run anyway**.
- **Ubuntu**: `sudo dpkg -i office-reminder_*.deb`, then launch from the apps grid. Or double-click the `.AppImage` if you prefer not to install. (You may need `chmod +x` on the AppImage first.)

In every case, they log in once with their Office Reminder credentials, then the app runs from the system tray. Quit it via the tray menu or from Activity Monitor/Task Manager when needed.

---

## Option 1 — Auto-build with GitHub Actions (recommended)

I've added a workflow at `.github/workflows/build-installers.yml`. It runs on every push to `main` and on tagged releases, spinning up a Mac, a Windows, and an Ubuntu runner to build all three installers in parallel.

### One-time setup

1. **Push the project to a GitHub repo** (public or private — public uses free CI minutes liberally; private gives you 2000 free minutes/month).
2. **Enable Actions** on the repo: Settings → Actions → "Allow all actions".
3. **Add secrets** for the build to find your Supabase credentials. Repo → Settings → Secrets and variables → Actions → New repository secret. Add:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your anon key
4. (Optional, only if you signed up for code signing certificates):
   - macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
   - Windows: `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`

### Triggering a build

```bash
# Bump the version in apps/desktop/package.json + src-tauri/tauri.conf.json + src-tauri/Cargo.toml
# Then tag and push:
git tag v0.1.0
git push origin v0.1.0
```

The workflow will run. After ~15 minutes you'll have a draft GitHub Release with all three installers attached. Edit the release notes, click **Publish**, and the download URLs are stable forever.

Hand those URLs to your teammates → they download the installer for their OS → done.

---

## Option 2 — Manual build on each OS

If you don't want to use CI, you (or someone you trust) needs physical or VM access to each OS.

### Windows

Prerequisites:

```powershell
# In an admin PowerShell:
# 1. Node + pnpm (if not already)
winget install OpenJS.NodeJS.LTS
npm install -g pnpm

# 2. Rust toolchain
winget install Rustlang.Rustup
rustup default stable

# 3. Microsoft C++ Build Tools (Tauri needs the MSVC compiler)
# Easiest: install Visual Studio Build Tools 2022 with the "Desktop development with C++" workload
# https://visualstudio.microsoft.com/visual-cpp-build-tools/

# 4. WebView2 runtime is pre-installed on Windows 11 and most updated Windows 10.
#    If missing: https://developer.microsoft.com/microsoft-edge/webview2/
```

Then in a regular PowerShell or Command Prompt:

```powershell
git clone <your repo>
cd office-reminder
pnpm install
# Set env vars temporarily (or use a .env.local in apps/desktop/)
$env:VITE_SUPABASE_URL = "https://your-project.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "your-anon-key"
cd apps/desktop
pnpm tauri build
```

Output:

```
apps/desktop/src-tauri/target/release/bundle/
  msi/Office Reminder_0.1.0_x64_en-US.msi
  nsis/Office Reminder_0.1.0_x64-setup.exe
```

Hand either of those to a Windows teammate. The `.msi` integrates into Add/Remove Programs cleanly. The `-setup.exe` is friendlier to non-technical users.

### Ubuntu 22.04+ (Debian-based)

Prerequisites:

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev \
  build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Node + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Build:

```bash
git clone <your repo>
cd office-reminder
pnpm install
echo "VITE_SUPABASE_URL=https://your-project.supabase.co" > apps/desktop/.env.local
echo "VITE_SUPABASE_ANON_KEY=your-anon-key"           >> apps/desktop/.env.local
cd apps/desktop
pnpm tauri build
```

Output:

```
apps/desktop/src-tauri/target/release/bundle/
  deb/office-reminder_0.1.0_amd64.deb
  appimage/office-reminder_0.1.0_amd64.AppImage
  rpm/office-reminder-0.1.0-1.x86_64.rpm
```

For Ubuntu/Debian teammates, hand them the `.deb`. For Fedora/RHEL, the `.rpm`. The `.AppImage` is portable and works on any modern Linux distro without installing.

> **ARM Linux note**: if you have a Raspberry Pi user or an Ampere server, build on that arch directly — cross-compiling Linux Tauri builds is fiddly.

---

## Troubleshooting

**Windows: "MSVC build tools not found"** — install the C++ workload from Visual Studio Build Tools and retry.

**Ubuntu: `libwebkit2gtk-4.1-dev` not found** — on Ubuntu 20.04 use `libwebkit2gtk-4.0-dev` instead, but you'll need to pin a slightly older Tauri version. Upgrading to Ubuntu 22.04+ is the easier fix.

**macOS: "Office Reminder is damaged and can't be opened"** — Gatekeeper sees the unsigned binary. Right-click → Open → Open. Or run once: `xattr -dr com.apple.quarantine "/Applications/Office Reminder.app"`.

**GitHub Actions: build runs out of disk space** — uncommon, but if it happens, add a step to free space:
```yaml
- name: Free disk space (Linux)
  if: matrix.platform == 'ubuntu-latest'
  run: |
    sudo rm -rf /usr/share/dotnet /opt/ghc "/usr/local/share/boost"
    sudo apt clean
    df -h
```

If you hit anything else, paste the failing log into chat and we'll fix it.
