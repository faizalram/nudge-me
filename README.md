# Nudge Me

One-line reminders for iPhone. Type "bayar listrik besok jam 9", and it nudges you at that time, then keeps nudging until you tap Done.

Stack: Next.js on Vercel, Neon Postgres, Upstash QStash (exact-time wake-ups), Web Push (Declarative Web Push on iOS 18.4+), passkeys for sign-in.

## Deploy

You need Node.js 20+, Git, a GitHub account, and a Vercel account (Hobby is fine).

1. **Install and generate secrets**

   ```bash
   npm install
   npm run secrets
   ```

   Copy the six lines it prints. Change `VAPID_SUBJECT` to your own email (keep `mailto:`). `INVITE_CODE` is what friends type to sign up.

2. **Push to a private GitHub repo**

   Create an empty private repo called `nudge-me` on GitHub, then:

   ```bash
   git init
   git add .
   git commit -m "Nudge Me v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/nudge-me.git
   git push -u origin main
   ```

3. **Import into Vercel**

   Vercel > Add New > Project > import `nudge-me`. Open Environment Variables, paste the six lines from step 1 into the Key field (Vercel splits them), then Deploy.

4. **Add the database**

   In the project: Storage > Create Database > Neon > connect it to this project. That adds `DATABASE_URL`.
   Open the database in Neon > SQL Editor > paste all of `schema.sql` > Run.

5. **Add QStash**

   Go to console.upstash.com > QStash. Copy `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (and `QSTASH_URL` if the console shows one) into Vercel > Settings > Environment Variables.

6. **Optional: smart time reading**

   Add `ANTHROPIC_API_KEY` from console.anthropic.com. Without it, the built-in parser still handles common phrases; the key only kicks in when it finds no time.

7. **Redeploy**

   Deployments > latest > ... > Redeploy. New variables only apply to new deployments.

8. **Install on iPhone**

   Open `https://YOUR-PROJECT.vercel.app` in Safari > Share > Add to Home Screen. Open Nudge Me from the Home Screen > Create an account (name + invite code) > Face ID > Turn on nudges > Allow.

   Test it: type `tes 2 menit lagi`, lock the phone, and wait.

## How it behaves

- A nudge rings at its time, then re-nudges every 5 min for 30 min, every 15 min until about 2 hours, then hourly, and stops pushing after 24 hours. The Home Screen badge stays until you tap Done. Change this in `lib/server/nudges.ts`.
- The backoff keeps a forgotten nudge to about 34 QStash messages a day, so a few ignored nudges can't use up the free 1,000/day.
- Nudges more than 6 days out wait in the database; a daily Vercel Cron hands them to QStash.

## Troubleshooting

- **The app shows "Missing environment variable X"**: add X in Vercel, then redeploy.
- **No notification arrives**: check iPhone Settings > Notifications > Nudge Me, and allow Nudge Me in your Focus modes. In the Upstash console, QStash logs show whether `/api/fire` was called and what it returned. Vercel > Logs shows server errors.
- **Passkey sign-in fails**: always use the production URL. Passkeys are tied to the domain, so preview URLs won't work. If you add a custom domain later, set `APP_URL` and create new passkeys there.

## Time phrases the parser understands

`jam 3`, `jam 3 sore`, `15:30`, `15.30`, `3pm`, `at 9`, `30 menit lagi`, `1 jam 30 menit lagi`, `in 20 min`, `in 2 hours`, `besok jam 9`, `besok pagi`, `nanti malam`, `tonight`, `lusa`, `jumat sore`, `senin depan jam 10`, `tgl 25`, `20/12`, `5 des`, `nov 20`, `3 hari lagi`, `2 minggu lagi`.

A bare hour like `jam 8` picks the nearest upcoming 08:00 or 20:00. With a date (`besok jam 3`), 1 to 6 means afternoon.
