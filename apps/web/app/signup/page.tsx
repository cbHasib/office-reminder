"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/teams`,
      },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }

    // If email confirmation is required, Supabase returns a user with
    // identities array but no session. Send them to the "check inbox" page.
    if (data.user && !data.session) {
      router.push(`/signup/verify?email=${encodeURIComponent(email)}`);
    } else {
      // Auto-confirm flow (dev mode) — straight to login.
      router.push("/login");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <form onSubmit={onSubmit} className="card card-pad w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-subtle mt-1">Get started in under a minute.</p>
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" required value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)} placeholder="Hasib" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required minLength={8} value={password}
                 onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-sm text-subtle">
          Already have an account? <Link className="text-brand hover:underline" href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
