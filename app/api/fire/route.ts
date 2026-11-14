import { fireNudge } from "@/lib/server/nudges";
import { verifyQStash } from "@/lib/server/queue";

// Called by QStash at the scheduled time. A 500 here makes QStash retry.
export async function POST(req: Request) {
  const raw = await req.text();
  if (!(await verifyQStash(req, raw))) return new Response("Invalid signature", { status: 401 });

  const { id, seq } = JSON.parse(raw) as { id: string; seq: number };
  const result = await fireNudge(id, seq);
  return Response.json(result);
}
