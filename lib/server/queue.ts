import { Client, Receiver } from "@upstash/qstash";
import { appUrl, env } from "./env";

/** Asks QStash to call /api/fire at `at` with { id, seq }. */
export async function enqueueFire(id: string, seq: number, at: Date, deduplicationId?: string) {
  const client = new Client({
    token: env("QSTASH_TOKEN"),
    ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}),
  });
  await client.publishJSON({
    url: `${appUrl()}/api/fire`,
    body: { id, seq },
    notBefore: Math.max(Math.floor(at.getTime() / 1000), Math.floor(Date.now() / 1000)),
    retries: 3,
    ...(deduplicationId ? { deduplicationId } : {}),
  });
}

export async function verifyQStash(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;
  const receiver = new Receiver({
    currentSigningKey: env("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: env("QSTASH_NEXT_SIGNING_KEY"),
  });
  try {
    return await receiver.verify({ signature, body: rawBody });
  } catch {
    return false;
  }
}
