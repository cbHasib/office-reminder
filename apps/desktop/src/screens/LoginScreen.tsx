import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { externalLink } from "@/lib/openExternal";
import { WEB_SIGNUP_URL, WEB_FORGOT_PASSWORD_URL } from "@office-reminder/shared";

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
    <div className="login-wrap">
      <form onSubmit={onSubmit} className="login-card">
        <h1 className="h1">Welcome back</h1>
        <p className="muted" style={{ marginTop: 4 }}>Log in to your Office Reminder account.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="you@company.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required
                   value={password} onChange={(e) => setPassword(e.target.value)}
                   placeholder="••••••••" />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Logging in…" : "Log in"}
          </button>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            New user?{" "}
            <a className="text-brand" {...externalLink(WEB_SIGNUP_URL)} style={{ textDecoration: "underline" }}>
              Create an account
            </a>{" "}
            then log in here.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: 12 }}>
            Forgot your password?{" "}
            <a className="text-brand" {...externalLink(WEB_FORGOT_PASSWORD_URL)} style={{ textDecoration: "underline" }}>
              Reset on the web
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
