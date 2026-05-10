import Link from "next/link";

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
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary">Create an account</Link>
          <Link href="/login" className="btn-secondary">Log in</Link>
        </div>
        <p className="mt-12 text-xs text-subtle">
          Free for any team. Sign up · create a team · share a 6-character code.
        </p>
      </div>
    </main>
  );
}
