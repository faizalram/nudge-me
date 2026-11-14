import { sweep } from "@/lib/server/nudges";

// Vercel Cron, once a day (see vercel.json). Vercel sends CRON_SECRET as a Bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const queued = await sweep();
  return Response.json({ queued });
}
