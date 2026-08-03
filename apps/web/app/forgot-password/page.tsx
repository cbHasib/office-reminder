"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <form onSubmit={onSubmit} className="card card-pad w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-subtle mt-1">
            We&apos;ll email you a link to set a new password.
          </p>
        </div>
        {sent ? (
          <>
            <p className="text-sm text-success">
              Check your inbox — if an account exists for <strong>{email}</strong>, a
              reset link is on its way. Open it in this browser to continue.
            </p>
            <p className="text-sm text-subtle">
              Didn&apos;t get it? Check spam, or{" "}
              <button type="button" className="text-brand hover:underline"
                      onClick={() => setSent(false)}>
                try again
              </button>.
            </p>
          </>
        ) : (
          <>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}
        <p className="text-sm text-subtle">
          Remembered it? <Link className="text-brand hover:underline" href="/login">Back to login</Link>
        </p>
      </form>
    </main>
  );
}
