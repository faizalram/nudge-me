// Prints fresh secrets for Vercel. Paste the output into
// Vercel > Project > Settings > Environment Variables (paste works for many lines at once).
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const vapid = webpush.generateVAPIDKeys();

console.log(`VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}
VAPID_SUBJECT=mailto:you@example.com
SESSION_SECRET=${randomBytes(32).toString("base64url")}
CRON_SECRET=${randomBytes(24).toString("base64url")}
INVITE_CODE=${randomBytes(4).toString("hex")}`);

console.error("\nChange VAPID_SUBJECT to your own email (keep the mailto: part).");
