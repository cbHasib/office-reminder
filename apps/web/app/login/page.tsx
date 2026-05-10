"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push("/dashboard/teams");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <form onSubmit={onSubmit} className="card card-pad w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-subtle mt-1">Log in to your Office Reminder account.</p>
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email}
                 onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" required value={password}
                 onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
        <p className="text-sm text-subtle">
          New here? <Link className="text-brand hover:underline" href="/signup">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
