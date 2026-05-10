import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 360, margin: "60px auto" }}>
        <h1 style={{ marginTop: 0 }}>Office Reminder</h1>
        <p className="muted" style={{ marginTop: -8 }}>Log in with your account.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <div>
            <label className="label">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={loading}>{loading ? "…" : "Log in"}</button>
          <p className="muted" style={{ marginTop: 0 }}>
            New user? Create an account in the web dashboard, then log in here.
          </p>
        </form>
      </div>
    </div>
  );
}
