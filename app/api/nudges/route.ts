import { db, publicNudge, type NudgeRow } from "@/lib/server/db";
import { HttpError, requireUser, route } from "@/lib/server/http";
import { createNudge } from "@/lib/server/nudges";

export const GET = route(async () => {
  const userId = await requireUser();
  const rows = (await db()`
    select * from nudges
    where user_id = ${userId} and status in ('pending', 'firing')
    order by (status = 'firing') desc, due_at asc
    limit 200`) as NudgeRow[];
  return Response.json({ nudges: rows.map(publicNudge) });
});

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const { text, dueAt } = (await req.json()) as { text?: string; dueAt?: string };
  const cleanText = (text ?? "").trim();
  if (!cleanText) throw new HttpError(400, "Add what to nudge you about.");
  if (cleanText.length > 280) throw new HttpError(400, "Keep it under 280 characters.");

  const due = new Date(dueAt ?? "");
  if (Number.isNaN(due.getTime())) throw new HttpError(400, "Add a time.");
  if (due.getTime() < Date.now() - 60_000) throw new HttpError(400, "That time has passed. Pick a later one.");
  if (due.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw new HttpError(400, "Pick a time within a year.");

  const n = await createNudge(userId, cleanText, due);
  return Response.json({ nudge: publicNudge(n) }, { status: 201 });
});
