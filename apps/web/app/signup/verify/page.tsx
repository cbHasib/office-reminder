"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function VerifyPage() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const supabase = createClient();
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    if (!email) return;
    setSending(true); setMsg(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/teams`,
      },
    });
    setSending(false);
    setMsg(error ? error.message : "Verification email resent. Check your inbox.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="card card-pad w-full max-w-sm text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand">
            <path d="M3 7l9 6 9-6M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7l9-4 9 4" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-subtle mt-2">
            We sent a verification link to{" "}
            {email ? <strong className="text-fg">{email}</strong> : "your email"}.
            Click it to activate your account, then come back here to log in.
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <Link href="/login" className="btn-primary w-full">I've verified — log in</Link>
          {email && (
            <button onClick={resend} className="btn-secondary w-full" disabled={sending}>
              {sending ? "Sending…" : "Resend verification email"}
            </button>
          )}
        </div>
        {msg && <p className="text-xs text-subtle">{msg}</p>}
        <p className="text-xs text-subtle pt-2">
          Wrong email?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Sign up again
          </Link>
        </p>
      </div>
    </main>
  );
}
