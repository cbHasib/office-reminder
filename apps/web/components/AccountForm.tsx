"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function AccountForm({
  initialDisplayName, initialEmail,
}: { initialDisplayName: string; initialEmail: string }) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [profileMsg, setProfileMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  async function saveProfile() {
    setSavingProfile(true); setProfileMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingProfile(false);
      setProfileMsg({ kind: "err", text: "Not signed in." });
      return;
    }
    const { error } = await supabase
      .from("users")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setSavingProfile(false);
    setProfileMsg(error
      ? { kind: "err", text: error.message }
      : { kind: "ok", text: "Profile updated." });
  }

  async function changePassword() {
    setPwdMsg(null);
    if (newPwd.length < 8) {
      setPwdMsg({ kind: "err", text: "New password must be at least 8 characters." }); return;
    }
    if (newPwd !== newPwd2) {
      setPwdMsg({ kind: "err", text: "Passwords don't match." }); return;
    }
    setSavingPwd(true);

    // Verify current password by attempting a fresh sign-in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPwdMsg({ kind: "err", text: "Not signed in." }); setSavingPwd(false); return; }
    const { error: signinErr } = await supabase.auth.signInWithPassword({
      email: user.email, password: currentPwd,
    });
    if (signinErr) {
      setSavingPwd(false);
      // Only credential failures mean a wrong password — surface anything
      // else (network, rate limit) as-is instead of blaming the password.
      const wrongPwd = signinErr.message.toLowerCase().includes("invalid login credentials");
      setPwdMsg({ kind: "err", text: wrongPwd ? "Current password is wrong." : signinErr.message });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) {
      setPwdMsg({ kind: "err", text: error.message });
    } else {
      setPwdMsg({ kind: "ok", text: "Password changed." });
      setCurrentPwd(""); setNewPwd(""); setNewPwd2("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold">Profile</h2>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={initialEmail} disabled />
          <p className="hint">Email changes go through Supabase auth — contact us to change it for now.</p>
        </div>
        {profileMsg && <p className={`text-sm ${profileMsg.kind === "ok" ? "text-success" : "text-danger"}`}>
          {profileMsg.text}
        </p>}
        <div className="flex justify-end">
          <button className="btn-primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </div>
      </section>

      <section className="card card-pad space-y-4">
        <h2 className="text-base font-semibold">Change password</h2>
        <div>
          <label className="label">Current password</label>
          <input className="input" type="password"
                 value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
        </div>
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" minLength={8}
                 value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" minLength={8}
                 value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} />
        </div>
        {pwdMsg && <p className={`text-sm ${pwdMsg.kind === "ok" ? "text-success" : "text-danger"}`}>
          {pwdMsg.text}
        </p>}
        <div className="flex justify-end">
          <button className="btn-primary" onClick={changePassword} disabled={savingPwd}>
            {savingPwd ? "Updating…" : "Change password"}
          </button>
        </div>
      </section>
    </div>
  );
}
