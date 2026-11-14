import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { HttpError, requireUser, route } from "@/lib/server/http";
import { clearSession } from "@/lib/server/session";

export const GET = route(async () => {
  const userId = await requireUser();
  const [user] = (await db()`select id, name from users where id = ${userId}`) as { id: string; name: string }[];
  if (!user) {
    await clearSession();
    throw new HttpError(401, "Sign in first.");
  }
  return Response.json({
    user,
    vapidPublicKey: env("VAPID_PUBLIC_KEY"),
    smartParse: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});
