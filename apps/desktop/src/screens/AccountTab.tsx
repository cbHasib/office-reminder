import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getVersion } from "@tauri-apps/api/app";
import { supabase } from "@/lib/supabase";
import { externalLink, openExternal } from "@/lib/openExternal";
import { checkForUpdate, type UpdateInfo } from "@/lib/updateCheck";
import {
  APP_NAME, DEVELOPER, SOURCE_REPO_URL, WEB_URL, WEB_DOWNLOAD_URL,
} from "@office-reminder/shared";

export default function AccountTab({ session }: { session: Session }) {
  const [displayName, setDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [version, setVersion] = useState<string>("");
  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

  const [checking, setChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null | "none">(null);
  async function checkUpdates() {
    setChecking(true);
    const u = await checkForUpdate({ ignoreDismissed: true });
    setChecking(false);
    setUpdateInfo(u ?? "none");
  }

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

      <p className="section-title">About</p>
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--success)))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 700, fontSize: 18,
          }}>OR</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{APP_NAME}</p>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 12 }}>
              Version {version || "—"}
            </p>
          </div>
          <button className="btn btn-secondary"
                  onClick={checkUpdates} disabled={checking}
                  style={{ fontSize: 12 }}>
            {checking ? "Checking…" : "Check for updates"}
          </button>
        </div>
        {updateInfo === "none" && (
          <p className="success" style={{ marginBottom: 12, fontSize: 12 }}>
            You're on the latest version.
          </p>
        )}
        {updateInfo && updateInfo !== "none" && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 10, padding: "8px 10px", marginBottom: 12, borderRadius: 8,
            background: "rgb(var(--brand) / 0.10)",
            border: "1px solid rgb(var(--brand) / 0.35)",
          }}>
            <span style={{ fontSize: 12 }}>
              v{updateInfo.latest} is available.
            </span>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: "5px 10px" }}
                    onClick={() => openExternal(WEB_DOWNLOAD_URL)}>
              Download
            </button>
          </div>
        )}

        <AboutRow label="Web app" value={WEB_URL.replace("https://", "")} href={WEB_URL} />
        <AboutRow label="Source code" value="github.com/cbHasib/office-reminder" href={SOURCE_REPO_URL} />

        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: "1px solid rgb(var(--border))",
        }}>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Built by
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>{DEVELOPER.name}</p>
          <p className="muted" style={{ margin: "2px 0 8px", fontSize: 12 }}>
            {DEVELOPER.handle}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <a className="btn btn-secondary" {...externalLink(DEVELOPER.website)} style={{ textDecoration: "none", fontSize: 12, padding: "6px 10px" }}>
              Website
            </a>
            <a className="btn btn-secondary" {...externalLink(DEVELOPER.github)} style={{ textDecoration: "none", fontSize: 12, padding: "6px 10px" }}>
              GitHub
            </a>
            <a className="btn btn-secondary" {...externalLink(`mailto:${DEVELOPER.email}`)} style={{ textDecoration: "none", fontSize: 12, padding: "6px 10px" }}>
              Email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0",
    }}>
      <span className="muted" style={{ fontSize: 12 }}>{label}</span>
      <a {...externalLink(href)}
         className="text-brand"
         style={{ fontSize: 12, textDecoration: "none", fontFamily: "ui-monospace, monospace" }}>
        {value} ↗
      </a>
    </div>
  );
}
