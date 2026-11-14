import webpush from "web-push";
import { db } from "./db";
import { env } from "./env";

let configured = false;

function setup() {
  if (configured) return;
  webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  configured = true;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Sends a push to every device the user subscribed. Returns how many got it. */
export async function pushToUser(userId: string, payload: object): Promise<number> {
  setup();
  const sql = db();
  const subs = (await sql`select endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}`) as Sub[];
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sql`delete from push_subscriptions where endpoint = ${s.endpoint}`;
        } else {
          console.error("push failed", status, (e as { body?: string }).body);
        }
      }
    }),
  );
  return sent;
}
