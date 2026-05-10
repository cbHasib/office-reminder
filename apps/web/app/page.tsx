import Link from "next/link";

export default function MarketingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-ink-900">
          Office Reminder
        </h1>
        <p className="mt-4 text-lg text-ink-700">
          Time-based reminders that pop up on your team's screens — instead of
          getting buried in a WhatsApp group.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary">Create an account</Link>
          <Link href="/login" className="btn-secondary">Log in</Link>
        </div>
        <p className="mt-12 text-sm text-ink-500">
          Sign up, create a team, share a 6-character code, install the desktop
          app on each PC. That's it.
        </p>
      </div>
    </main>
  );
}
