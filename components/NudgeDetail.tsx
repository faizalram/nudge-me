"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, errorMessage, setBadge, type Nudge } from "@/lib/client";
import { formatDue } from "@/lib/format";

export default function NudgeDetail({ id }: { id: string }) {
  const router = useRouter();
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ nudge: Nudge }>(`/api/nudges/${id}`)
      .then((r) => setNudge(r.nudge))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/");
        else setError(errorMessage(e));
      });
  }, [id, router]);

  async function act(action: "done" | "snooze", minutes?: number) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/nudges/${id}`, { method: "PATCH", body: JSON.stringify({ action, minutes }) });
      const r = await api<{ nudges: Nudge[] }>("/api/nudges");
      setBadge(r.nudges.filter((n) => n.status === "firing").length);
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  const open = nudge && (nudge.status === "pending" || nudge.status === "firing");

  return (
    <main className="shell">
      <header className="top">
        <Link href="/" className="link small">
          All nudges
        </Link>
      </header>

      {!nudge && !error && <p className="muted">Loading</p>}

      {nudge && (
        <div className="detail">
          <p className="detail-text">{nudge.text}</p>
          <p className="muted" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>
            Due {formatDue(new Date(nudge.dueAt))}
            {nudge.status === "firing" && nudge.fireCount > 0
              ? `, nudged ${nudge.fireCount} time${nudge.fireCount > 1 ? "s" : ""}`
              : ""}
          </p>

          {open ? (
            <div className="detail-actions">
              <button className="btn btn-block btn-done" onClick={() => act("done")} disabled={busy}>
                Mark done
              </button>
              <div className="split">
                <button className="btn btn-quiet" onClick={() => act("snooze", 10)} disabled={busy}>
                  Snooze 10 min
                </button>
                <button className="btn btn-quiet" onClick={() => act("snooze", 60)} disabled={busy}>
                  Snooze 1 hour
                </button>
              </div>
            </div>
          ) : (
            <div className="detail-actions">
              <p style={{ margin: 0 }}>This nudge is {nudge.status === "done" ? "done" : "cancelled"}.</p>
              <Link href="/" className="btn btn-block" style={{ textAlign: "center", textDecoration: "none" }}>
                Back to all nudges
              </Link>
            </div>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </main>
  );
}
