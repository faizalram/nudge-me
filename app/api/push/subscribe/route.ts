import { db } from "@/lib/server/db";
import { HttpError, requireUser, route } from "@/lib/server/http";

export const POST = route(async (req: Request) => {
  const userId = await requireUser();
  const sub = (await req.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, "Invalid push subscription.");

  await db()`
    insert into push_subscriptions (endpoint, user_id, p256dh, auth)
    values (${sub.endpoint}, ${userId}, ${sub.keys.p256dh}, ${sub.keys.auth})
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  return Response.json({ ok: true });
});
