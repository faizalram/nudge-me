import { db, publicNudge, type NudgeRow } from "@/lib/server/db";
import { HttpError, isUuid, requireUser, route } from "@/lib/server/http";
import { actOnNudge, type Action } from "@/lib/server/nudges";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "Nudge not found.");
  const [n] = (await db()`select * from nudges where id = ${id} and user_id = ${userId}`) as NudgeRow[];
  if (!n) throw new HttpError(404, "Nudge not found.");
  return Response.json({ nudge: publicNudge(n) });
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "Nudge not found.");

  const { action, minutes } = (await req.json()) as { action?: Action; minutes?: number };
  if (action !== "done" && action !== "cancel" && action !== "snooze") throw new HttpError(400, "Unknown action.");
  const mins = Math.round(Number(minutes ?? 10));
  if (action === "snooze" && !(mins >= 1 && mins <= 24 * 60)) throw new HttpError(400, "Snooze between 1 minute and 24 hours.");

  const n = await actOnNudge(userId, id, action, mins);
  if (!n) throw new HttpError(409, "This nudge is already done.");
  return Response.json({ nudge: publicNudge(n) });
});
