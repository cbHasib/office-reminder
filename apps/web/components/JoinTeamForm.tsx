"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function JoinTeamForm() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true); setError(null); setInfo(null);
    const upper = code.trim().toUpperCase();

    try {
      // All validation (code lookup, membership, require_approval) happens
      // server-side — join codes are no longer client-readable.
      const { data, error: rpcErr } = await supabase.rpc("join_team_with_code", {
        p_code: upper,
        p_message: message.trim() || null,
      });
      if (rpcErr) { setError(rpcErr.message); return; }

      const result = data as { status: string; team_id?: string; team_name?: string };
      switch (result.status) {
        case "not_found":
          setError("No team with that code.");
          break;
        case "rate_limited":
          setError("Too many attempts — wait a few minutes and try again.");
          break;
        case "already_member":
          router.push(`/dashboard/teams/${result.team_id}`);
          router.refresh();
          break;
        case "request_pending":
          setInfo(`Request already pending for "${result.team_name}".`);
          break;
        case "request_sent":
          setInfo(`Request sent to ${result.team_name}. An admin will review it.`);
          router.refresh();
          break;
        case "joined":
          router.push(`/dashboard/teams/${result.team_id}`);
          router.refresh();
          break;
        default:
          setError("Unexpected response — please try again.");
      }
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Join code</label>
        <input className="input font-mono uppercase tracking-widest"
               maxLength={6} value={code}
               onChange={(e) => setCode(e.target.value.toUpperCase())}
               placeholder="ABC123" required />
      </div>
      <div>
        <label className="label">Optional message to the admin</label>
        <input className="input" value={message}
               onChange={(e) => setMessage(e.target.value)}
               placeholder="(only used when approval is required)" />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {info && <p className="text-sm text-success">{info}</p>}
      <button className="btn-primary w-full" disabled={loading || code.length !== 6}>
        {loading ? "Working…" : "Join team"}
      </button>
    </form>
  );
}
