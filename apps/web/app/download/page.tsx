/**
 * Public download page. Fetches the latest GitHub release on the server
 * and renders per-OS download buttons.
 *
 * Set NEXT_PUBLIC_GITHUB_REPO in .env.local to your repo, e.g. "hasib/office-reminder".
 */
import Link from "next/link";

export const revalidate = 300; // re-fetch every 5 minutes

const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO; // "owner/repo"

interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
}
interface GhRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: GhAsset[];
}

type OSKey = "mac-arm" | "mac-intel" | "windows-exe" | "windows-msi" | "linux-deb" | "linux-appimage";

const MATCHERS: { key: OSKey; label: string; sublabel: string; match: (n: string) => boolean }[] = [
  { key: "mac-arm",       label: "macOS (Apple Silicon)", sublabel: "M1 / M2 / M3 / M4",
    match: (n) => /\.dmg$/i.test(n) && /aarch64|arm64/i.test(n) },
  { key: "mac-intel",     label: "macOS (Intel)",         sublabel: "Older Macs",
    match: (n) => /\.dmg$/i.test(n) && /x64|x86_64/i.test(n) },
  { key: "windows-exe",   label: "Windows installer",     sublabel: "Recommended (.exe)",
    match: (n) => /-setup\.exe$/i.test(n) },
  { key: "windows-msi",   label: "Windows (.msi)",        sublabel: "For IT-managed PCs",
    match: (n) => /\.msi$/i.test(n) },
  { key: "linux-deb",     label: "Ubuntu / Debian (.deb)", sublabel: "sudo dpkg -i",
    match: (n) => /\.deb$/i.test(n) },
  { key: "linux-appimage",label: "Linux (AppImage)",      sublabel: "Portable, no install",
    match: (n) => /\.AppImage$/i.test(n) },
];

async function fetchLatest(): Promise<GhRelease | null> {
  if (!REPO) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as GhRelease;
  } catch {
    return null;
  }
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export default async function DownloadPage() {
  const release = await fetchLatest();

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-brand hover:underline">← Back</Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
          Download Office Reminder
        </h1>
        <p className="mt-3 text-subtle">
          Install the desktop app on every PC in your team. They'll log in with their
          account, then reminders pop up automatically.
        </p>

        {!REPO ? (
          <div className="mt-10 card card-pad">
            <p className="text-sm">
              Downloads aren't configured yet.{" "}
              Set <code className="kbd">NEXT_PUBLIC_GITHUB_REPO</code> in
              your env to a value like <code className="kbd">your-username/office-reminder</code>{" "}
              so this page can pull the latest release.
            </p>
          </div>
        ) : !release ? (
          <div className="mt-10 card card-pad">
            <p className="text-sm">
              No release found yet for <code className="kbd">{REPO}</code>.
              Push a tag like <code className="kbd">v0.1.0</code> to trigger the
              build workflow — the first release should appear in ~15 minutes.
            </p>
            <p className="text-xs text-subtle mt-3">
              See <Link href="https://github.com/" className="text-brand hover:underline">GitHub Releases</Link> directly if you've already published one.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3 text-sm text-subtle">
              <span className="kbd">{release.tag_name}</span>
              <span>· Published {new Date(release.published_at).toLocaleDateString()}</span>
              <Link href={release.html_url} className="text-brand hover:underline">
                Release notes →
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {MATCHERS.map((m) => {
                const asset = release.assets.find((a) => m.match(a.name));
                if (!asset) return null;
                return (
                  <a
                    key={m.key}
                    href={asset.browser_download_url}
                    className="card card-pad flex items-center justify-between
                               transition hover:border-brand hover:shadow-pop"
                  >
                    <div>
                      <p className="font-semibold">{m.label}</p>
                      <p className="text-xs text-subtle mt-0.5">{m.sublabel}</p>
                      <p className="text-xs text-subtle mt-1 font-mono truncate max-w-[18rem]">
                        {asset.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="btn-primary text-xs">Download</span>
                      <p className="text-xs text-subtle mt-1">{fmtSize(asset.size)}</p>
                    </div>
                  </a>
                );
              })}
            </div>

            <div className="mt-10 card card-pad text-sm text-subtle space-y-3">
              <div>
                <strong className="text-fg">macOS</strong> · After installing, the first
                launch may show "Office Reminder cannot be opened because the developer
                cannot be verified" — right-click the app in Applications →{" "}
                <em>Open</em> → <em>Open</em>.
                <br />
                If you instead see <em>"is damaged and can't be opened"</em>, open
                Terminal and run once:
                <code className="block mt-2 p-2 kbd whitespace-pre">
                  xattr -cr "/Applications/Office Reminder.app"
                </code>
              </div>
              <div>
                <strong className="text-fg">Windows</strong> · SmartScreen may show
                "Unknown publisher" on first install. Click <em>More info</em> →{" "}
                <em>Run anyway</em>.
              </div>
              <div>
                <strong className="text-fg">Ubuntu / Debian</strong> ·{" "}
                <code className="kbd">sudo dpkg -i office-reminder_*.deb</code> then launch
                from the apps grid. Or use the <em>.AppImage</em>: <code className="kbd">chmod +x</code> then double-click.
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
