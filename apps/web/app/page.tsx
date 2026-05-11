import Link from "next/link";
import { DEVELOPER, SOURCE_REPO_URL } from "@office-reminder/shared";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse at top, rgb(var(--brand) / 0.18), transparent 60%)," +
            "radial-gradient(ellipse at bottom right, rgb(var(--success) / 0.10), transparent 50%)",
        }}
      />
      <div className="max-w-xl text-center">
        <p className="text-sm font-medium text-brand mb-3">Office Reminder</p>
        <h1 className="text-5xl font-semibold tracking-tight text-fg">
          Reminders that <span className="text-brand">land</span> on every screen.
        </h1>
        <p className="mt-5 text-lg text-subtle leading-relaxed">
          A small desktop app for your team that pops up countdowns before
          prayer times, meetings, and recurring rituals — instead of getting
          buried in a WhatsApp group.
        </p>
        <div className="mt-8 flex justify-center gap-3 flex-wrap">
          <Link href="/signup" className="btn-primary">Create an account</Link>
          <Link href="/login" className="btn-secondary">Log in</Link>
          <Link href="/download" className="btn-secondary">Download desktop app</Link>
        </div>
        <p className="mt-12 text-xs text-subtle">
          Free for any team. Sign up · create a team · share a 6-character code.
        </p>
      </div>

      <footer className="absolute bottom-6 inset-x-0 text-center text-xs text-subtle">
        Built by{" "}
        <a href={DEVELOPER.website} target="_blank" rel="noreferrer"
           className="text-brand hover:underline">
          {DEVELOPER.name}
        </a>{" "}
        ·{" "}
        <a href={SOURCE_REPO_URL} target="_blank" rel="noreferrer"
           className="hover:underline">
          Source
        </a>
      </footer>
    </main>
  );
}
