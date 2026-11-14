"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseNudge } from "@/lib/parse";
import { formatDue, formatIn, fromLocalStamp, localStamp } from "@/lib/format";
import {
  api,
  ApiError,
  enablePush,
  errorMessage,
  isIOS,
  isStandalone,
  pushSupported,
  registerSW,
  setBadge,
  syncPush,
  type Me,
  type Nudge,
} from "@/lib/client";
import Auth from "./Auth";
import InstallGuide from "./InstallGuide";

type Phase = "loading" | "install" | "auth" | "ready" | "error";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [fatal, setFatal] = useState("");

  const loadMe = useCallback(async () => {
    try {
      const m = await api<Me>("/api/me");
      setMe(m);
      setPhase("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setPhase("auth");
      else {
        setFatal(errorMessage(e));
        setPhase("error");
      }
    }
  }, []);

  const signedOut = useCallback(() => {
    setMe(null);
    setPhase("auth");
  }, []);

  useEffect(() => {
    registerSW();
    if (isIOS() && !isStandalone()) {
      setPhase("install");
      return;
    }
    loadMe();
  }, [loadMe]);

  if (phase === "install") return <InstallGuide />;
  if (phase === "auth") return <Auth onSignedIn={loadMe} />;
  if (phase === "error")
    return (
      <main className="shell">
        <h1 className="wordmark">Nudge Me</h1>
        <p className="error">{fatal}</p>
        <button className="btn" style={{ marginTop: "1rem", justifySelf: "start" }} onClick={loadMe}>
          Try again
        </button>
      </main>
    );
  if (phase === "loading" || !me)
    return (
      <main className="shell">
        <h1 className="wordmark">Nudge Me</h1>
      </main>
    );
  return <Main me={me} onSignedOut={signedOut} />;
}

function addMinutes(min: number) {
  return new Date(Date.now() + min * 60_000);
}

function tomorrowAt(hour: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0);
}

const CHIPS: { label: string; at: () => Date }[] = [
  { label: "+15 min", at: () => addMinutes(15) },
  { label: "+1 hour", at: () => addMinutes(60) },
  { label: "+3 hours", at: () => addMinutes(180) },
  { label: "Tomorrow 09:00", at: () => tomorrowAt(9) },
];

function Main({ me, onSignedOut }: { me: Me; onSignedOut: () => void }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");

  const parsed = useMemo(() => parseNudge(input, now), [input, now]);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ nudges: Nudge[] }>("/api/nudges");
      setNudges(r.nudges);
      setLoaded(true);
      setBadge(r.nudges.filter((n) => n.status === "firing").length);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onSignedOut();
    }
  }, [onSignedOut]);

  useEffect(() => {
    refresh();
    const tick = setInterval(() => setNow(new Date()), 15_000);
    const poll = setInterval(refresh, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(new Date());
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (!pushSupported()) return;
    setPerm(Notification.permission);
    syncPush(me.vapidPublicKey).catch(() => {});
  }, [me.vapidPublicKey]);

  async function turnOn() {
    setError("");
    try {
      await enablePush(me.vapidPublicKey);
      setPerm("granted");
    } catch (e) {
      setPerm(Notification.permission);
      setError(errorMessage(e));
    }
  }

  async function create(override?: Date) {
    if (busy) return;
    setError("");
    setNotice("");
    const current = parseNudge(input, new Date());
    let text = current.text;
    let due = override ?? current.due;

    if (!text) {
      setError("Add what to nudge you about.");
      return;
    }

    setBusy(true);
    try {
      if (!due) {
        if (!me.smartParse) {
          setError("Add a time, like 'jam 3' or 'in 20 min', or tap a time below.");
          return;
        }
        const r = await api<{ text: string; due: string | null }>("/api/parse", {
          method: "POST",
          body: JSON.stringify({
            text: input,
            now: localStamp(new Date()),
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        due = r.due ? fromLocalStamp(r.due) : null;
        text = r.text || text;
        if (!due) {
          setError("No time found. Add one, like 'besok jam 9', or tap a time below.");
          return;
        }
      }
      if (due.getTime() <= Date.now()) {
        setError("That time has passed. Pick a later one.");
        return;
      }
      await api("/api/nudges", { method: "POST", body: JSON.stringify({ text, dueAt: due.toISOString() }) });
      setInput("");
      setNotice(`Nudge set for ${formatDue(due)}.`);
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(n: Nudge, action: "done" | "cancel") {
    if (action === "cancel" && !window.confirm(`Cancel "${n.text}"?`)) return;
    setNudges((list) => list.filter((x) => x.id !== n.id));
    try {
      await api(`/api/nudges/${n.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    } catch (e) {
      setError(errorMessage(e));
    }
    refresh();
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setBadge(0);
    onSignedOut();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create();
  }

  const ringing = nudges.filter((n) => n.status === "firing");
  const upcoming = nudges.filter((n) => n.status === "pending");

  let preview: React.ReactNode;
  if (!input.trim()) {
    preview = <span className="muted">Type a task and a time, in Bahasa or English.</span>;
  } else if (parsed.due && parsed.due.getTime() <= now.getTime()) {
    preview = <span className="error">That time has passed.</span>;
  } else if (parsed.due) {
    preview = (
      <span>
        <strong>{formatDue(parsed.due, now)}</strong>
        <span className="muted">, {formatIn(parsed.due, now)}</span>
      </span>
    );
  } else {
    preview = (
      <span className="muted">
        {me.smartParse ? "No time found yet. Press Enter to read it, or tap a time." : "Add a time, or tap one below."}
      </span>
    );
  }

  return (
    <main className="shell">
      <header className="top">
        <h1 className="wordmark">Nudge Me</h1>
      </header>

      {perm === "default" && (
        <div className="banner">
          <p>Turn on notifications so nudges reach this device.</p>
          <button className="btn" onClick={turnOn}>
            Turn on nudges
          </button>
        </div>
      )}
      {perm === "denied" && (
        <div className="banner">
          <p>Notifications are blocked. Turn them on in Settings, Notifications, Nudge Me.</p>
        </div>
      )}
      {perm === "unsupported" && isIOS() && (
        <div className="banner">
          <p>This iOS version can&apos;t receive web notifications. Update to iOS 16.4 or later.</p>
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <input
          aria-label="What should we nudge you about, and when?"
          placeholder="Bayar listrik besok jam 9"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setNow(new Date());
            setError("");
            setNotice("");
          }}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          maxLength={280}
          disabled={busy}
        />
        <p className="preview" aria-live="polite">
          {preview}
        </p>
        <div className="chips">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => create(c.at())}
            >
              {c.label}
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        {notice && (
          <p className="notice" aria-live="polite">
            {notice}
          </p>
        )}
      </form>

      {ringing.length > 0 && (
        <section className="section">
          <h2>Ringing</h2>
          <ul className="list">
            {ringing.map((n) => (
              <li key={n.id} className="ring">
                <button className="ring-body" onClick={() => router.push(`/n/${n.id}`)}>
                  <span className="ring-text">{n.text}</span>
                  <span className="ring-meta">
                    Due {formatDue(new Date(n.dueAt), now)}
                    {n.fireCount > 1 ? `, nudged ${n.fireCount} times` : ""}
                  </span>
                </button>
                <button className="btn" onClick={() => act(n, "done")}>
                  Done
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="section">
          <h2>Upcoming</h2>
          <ul className="list">
            {upcoming.map((n) => {
              const due = new Date(n.dueAt);
              return (
                <li key={n.id} className="row">
                  <button className="row-text" onClick={() => router.push(`/n/${n.id}`)}>
                    {n.text}
                  </button>
                  <span className="row-time">
                    {formatDue(due, now)}
                    <small>{formatIn(due, now)}</small>
                  </span>
                  <button className="row-x" aria-label={`Cancel ${n.text}`} onClick={() => act(n, "cancel")}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loaded && nudges.length === 0 && (
        <p className="empty">Nothing scheduled. Try &ldquo;telpon Ibu jam 7 malam&rdquo; or &ldquo;stretch in 20 min&rdquo;.</p>
      )}

      <footer className="footer small muted">
        Signed in as {me.user.name}.{" "}
        <button className="link small" onClick={signOut}>
          Sign out
        </button>
      </footer>
    </main>
  );
}
