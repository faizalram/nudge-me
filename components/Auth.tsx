"use client";

import { useState, type FormEvent } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { api, errorMessage } from "@/lib/client";

export default function Auth({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const optionsJSON = await api<Parameters<typeof startAuthentication>[0]["optionsJSON"]>(
        "/api/auth/login/options",
        { method: "POST" },
      );
      const response = await startAuthentication({ optionsJSON });
      await api("/api/auth/login/verify", { method: "POST", body: JSON.stringify(response) });
      onSignedIn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function signUp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const optionsJSON = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>(
        "/api/auth/register/options",
        { method: "POST", body: JSON.stringify({ name, invite }) },
      );
      const response = await startRegistration({ optionsJSON });
      await api("/api/auth/register/verify", { method: "POST", body: JSON.stringify(response) });
      onSignedIn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <h1 className="wordmark wordmark-lg">Nudge Me</h1>
      <p className="intro muted">Type one line. It nudges you at that time, and keeps nudging until you mark it done.</p>

      <div className="ring demo" aria-hidden="true">
        <div className="ring-body">
          <span className="ring-text">Bayar listrik</span>
          <span className="ring-meta">Due Today 09:00, nudged 3 times</span>
        </div>
        <span className="btn">Done</span>
      </div>

      {mode === "signin" ? (
        <div className="form">
          <button className="btn btn-block" onClick={signIn} disabled={busy}>
            Sign in with passkey
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            New here?{" "}
            <button className="link small" onClick={() => { setMode("signup"); setError(""); }}>
              Create an account
            </button>
          </p>
        </div>
      ) : (
        <form className="form" onSubmit={signUp}>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" required />
          </label>
          <label>
            Invite code
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              required
            />
          </label>
          <button className="btn btn-block" type="submit" disabled={busy}>
            Create passkey
          </button>
          <p className="small muted" style={{ margin: 0 }}>
            Uses Face ID or Touch ID, no password.{" "}
            <button type="button" className="link small" onClick={() => { setMode("signin"); setError(""); }}>
              I already have an account
            </button>
          </p>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
