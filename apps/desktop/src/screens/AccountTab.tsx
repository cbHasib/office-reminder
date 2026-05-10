import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export default function AccountTab({ session }: { session: Session }) {
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("users").select("display_name").eq("id", session.user.id).single();
      if (data?.display_name) setDisplayName(data.display_name);
    })();
  }, [session.user.id]);

  async function saveProfile() {
    setSavingProfile(true); setProfileMsg(null);
    const { error } = await supabase
      .from("users").update({ display_name: displayName }).eq("id", session.user.id);
    setSavingProfile(false);
    setProfileMsg(error ? error.message : "Saved.");
  }

  async function changePassword() {
    setPwdMsg(null);
    if (newPwd.length < 8) { setPwdMsg({ ok: false, text: "New password must be at least 8 characters." }); return; }
    if (newPwd !== newPwd2) { setPwdMsg({ ok: false, text: "Passwords don't match." }); return; }
    setSavingPwd(true);
    const { error: signinErr } = await supabase.auth.signInWithPassword({
      email: session.user.email!, password: currentPwd,
    });
    if (signinErr) { setSavingPwd(false); setPwdMsg({ ok: false, text: "Current password is wrong." }); return; }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) setPwdMsg({ ok: false, text: error.message });
    else { setPwdMsg({ ok: true, text: "Password changed." }); setCurrentPwd(""); setNewPwd(""); setNewPwd2(""); }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="h1">Account</h1>
        <p className="muted" style={{ marginTop: 4 }}>{session.user.email}</p>
      </header>

      <p className="section-title">Profile</p>
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <label className="label">Display name</label>
          <input className="input" value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        {profileMsg && <p className={profileMsg === "Saved." ? "success" : "error"}>{profileMsg}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <p className="section-title">Change password</p>
      <div className="card">
        <div style={{ marginBottom: 14 }}>
          <label className="label">Current password</label>
          <input className="input" type="password"
                 value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">New password</label>
          <input className="input" type="password" minLength={8}
                 value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="label">Confirm new password</label>
          <input className="input" type="password" minLength={8}
                 value={newPwd2} onChange={(e) => setNewPwd2(e.target.value)} />
        </div>
        {pwdMsg && <p className={pwdMsg.ok ? "success" : "error"}>{pwdMsg.text}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          <button className="btn btn-primary" onClick={changePassword} disabled={savingPwd}>
            {savingPwd ? "Updating…" : "Change password"}
          </button>
        </div>
      </div>

      <p className="section-title">Session</p>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 500 }}>Log out of this device</p>
            <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
              You'll need to log in again to receive reminders.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={logout}>Log out</button>
        </div>
      </div>
    </div>
  );
}
