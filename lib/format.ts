function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const p2 = (n: number) => String(n).padStart(2, "0");
const hm = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
// Shows seconds only when the nudge has them ("15:00" vs "10:03:30")
const hms = (d: Date) => (d.getSeconds() ? `${hm(d)}:${p2(d.getSeconds())}` : hm(d));

/** "Today 15:00", "Today 10:03:30", "Tomorrow 09:00", "Sat 21 Nov, 09:00" */
export function formatDue(d: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (days === 0) return `Today ${hms(d)}`;
  if (days === 1) return `Tomorrow ${hms(d)}`;
  if (days === -1) return `Yesterday ${hms(d)}`;
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${hms(d)}`;
}

/** "in 45 sec", "in 3m 30s", "in 25 min", "in 2h 30m", "in 3 days" */
export function formatIn(d: Date, now: Date = new Date()): string {
  const sec = Math.round((d.getTime() - now.getTime()) / 1000);
  if (sec < 0) return "passed";
  if (sec < 60) return `in ${sec} sec`;
  if (sec < 600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `in ${m}m ${s}s` : `in ${m} min`;
  }
  const min = Math.round(sec / 60);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const days = Math.round(h / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}

/** Local wall-clock string for the server-side parser: "2026-11-14T10:05" */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${hm(d)}`;
}

/** Reverse of localStamp, read in the device's time zone */
export function fromLocalStamp(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
