import { appUrl } from "./env";
import { db, toDate, type NudgeRow } from "./db";
import { pushToUser } from "./push";
import { enqueueFire } from "./queue";

// QStash free tier delays up to 7 days. Nudges further out wait in the DB
// and the daily cron (/api/cron/sweep) hands them over once they are within 6 days.
const QUEUE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

// Re-nudge every 5 min for the first 30 min, every 15 min until about 2 hours,
// then hourly. Stop pushing after 24 hours; the Home Screen badge stays until Done.
// This keeps an ignored nudge to about 34 QStash messages a day (free tier: 1,000/day).
const STOP_AFTER_MS = 24 * 60 * 60 * 1000;
function renudgeDelayMinutes(sentSoFar: number): number {
  if (sentSoFar < 6) return 5;
  if (sentSoFar < 12) return 15;
  return 60;
}

export async function createNudge(userId: string, text: string, due: Date): Promise<NudgeRow> {
  const sql = db();
  const [n] = (await sql`
    insert into nudges (user_id, text, due_at, next_fire_at)
    values (${userId}, ${text}, ${due}, ${due})
    returning *`) as NudgeRow[];

  if (due.getTime() - Date.now() < QUEUE_WINDOW_MS) {
    try {
      await enqueueFire(n.id, 0, due);
      await sql`update nudges set queued = true where id = ${n.id}`;
      n.queued = true;
    } catch (e) {
      await sql`delete from nudges where id = ${n.id}`;
      throw e;
    }
  }
  return n;
}

async function ringingCount(userId: string): Promise<number> {
  const sql = db();
  const [row] = (await sql`
    select count(*)::int as c from nudges where user_id = ${userId} and status = 'firing'`) as { c: number }[];
  return row?.c ?? 0;
}

/**
 * Called by QStash. Safe to run twice: it only acts when `seq` matches,
 * and every reschedule (fire, snooze, done, cancel) bumps seq.
 */
export async function fireNudge(id: string, seq: number): Promise<{ fired: boolean; reason?: string }> {
  const sql = db();
  const [n] = (await sql`select * from nudges where id = ${id}`) as NudgeRow[];
  if (!n) return { fired: false, reason: "not found" };
  if (n.status !== "pending" && n.status !== "firing") return { fired: false, reason: n.status };
  if (n.seq !== seq) return { fired: false, reason: "stale" };

  const sentBefore = n.fire_count;
  const badge = (await ringingCount(n.user_id)) + (n.status === "firing" ? 0 : 1);

  await pushToUser(n.user_id, {
    web_push: 8030,
    notification: {
      title: n.text,
      body: sentBefore === 0 ? "Tap to mark it done" : `Not done yet. Nudge ${sentBefore + 1}`,
      navigate: `${appUrl()}/n/${n.id}`,
      tag: `nudge-${n.id}`,
      silent: false,
      app_badge: String(badge),
    },
  });

  const nextSeq = seq + 1;
  const ringingFor = Date.now() - toDate(n.due_at).getTime();
  let nextAt: Date | null = null;
  if (ringingFor < STOP_AFTER_MS) {
    nextAt = new Date(Date.now() + renudgeDelayMinutes(sentBefore + 1) * 60_000);
    // Dedup id makes a QStash retry of this message safe
    await enqueueFire(n.id, nextSeq, nextAt, `renudge-${n.id}-${nextSeq}`);
  }

  await sql`
    update nudges
    set status = 'firing', seq = ${nextSeq}, fire_count = ${sentBefore + 1},
        next_fire_at = ${nextAt}, queued = ${nextAt !== null}
    where id = ${id} and seq = ${seq}`;

  return { fired: true };
}

export type Action = "done" | "cancel" | "snooze";

export async function actOnNudge(userId: string, id: string, action: Action, minutes = 10): Promise<NudgeRow | null> {
  const sql = db();

  if (action === "done" || action === "cancel") {
    const status = action === "done" ? "done" : "cancelled";
    const [n] = (await sql`
      update nudges
      set status = ${status}, done_at = now(), seq = seq + 1, next_fire_at = null, queued = false
      where id = ${id} and user_id = ${userId} and status in ('pending', 'firing')
      returning *`) as NudgeRow[];
    return n ?? null;
  }

  // Snooze: treat it as a fresh nudge at the new time
  const at = new Date(Date.now() + minutes * 60_000);
  const [n] = (await sql`
    update nudges
    set status = 'pending', due_at = ${at}, next_fire_at = ${at}, seq = seq + 1, fire_count = 0, queued = false
    where id = ${id} and user_id = ${userId} and status in ('pending', 'firing')
    returning *`) as NudgeRow[];
  if (!n) return null;
  await enqueueFire(n.id, n.seq, at);
  await sql`update nudges set queued = true where id = ${n.id} and seq = ${n.seq}`;
  return { ...n, queued: true };
}

/** Daily cron: hand QStash any nudge that is now inside its 7-day delay limit. */
export async function sweep(): Promise<number> {
  const sql = db();
  const rows = (await sql`
    select id, seq, next_fire_at from nudges
    where status in ('pending', 'firing')
      and queued = false
      and next_fire_at is not null
      and next_fire_at < now() + interval '6 days'`) as Pick<NudgeRow, "id" | "seq" | "next_fire_at">[];

  let count = 0;
  for (const r of rows) {
    await enqueueFire(r.id, r.seq, toDate(r.next_fire_at!), `sweep-${r.id}-${r.seq}`);
    await sql`update nudges set queued = true where id = ${r.id} and seq = ${r.seq}`;
    count++;
  }
  return count;
}
