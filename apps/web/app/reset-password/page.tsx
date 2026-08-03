"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

/**
 * Landing page for the password-recovery email link. The link goes through
 * /auth/callback, which exchanges the code for a session and redirects here,
 * so by the time this renders the user should be signed in.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pwd !== pwd2) { setError("Passwords don't match."); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => { router.push("/dashboard/teams"); router.refresh(); }, 1500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <div className="card card-pad w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        </div>

        {checking ? (
          <p className="text-sm text-subtle">Checking your reset link…</p>
        ) : done ? (
          <p className="text-sm text-success">
            Password updated — taking you to your dashboard…
          </p>
        ) : !hasSession ? (
          <>
            <p className="text-sm text-danger">
              This reset link is invalid or has expired.
            </p>
            <p className="text-sm text-subtle">
              Request a new one from the{" "}
              <Link className="text-brand hover:underline" href="/forgot-password">
                forgot password
              </Link>{" "}
              page, and open the email link in this same browser.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input className="input" type="password" required minLength={8} value={pwd}
                     onChange={(e) => setPwd(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input className="input" type="password" required minLength={8} value={pwd2}
                     onChange={(e) => setPwd2(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button className="btn-primary w-full" disabled={saving}>
              {saving ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
