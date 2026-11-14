function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const hm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** "Today 15:00", "Tomorrow 09:00", "Sat 21 Nov, 09:00" */
export function formatDue(d: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (days === 0) return `Today ${hm(d)}`;
  if (days === 1) return `Tomorrow ${hm(d)}`;
  if (days === -1) return `Yesterday ${hm(d)}`;
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${hm(d)}`;
}

/** "in 5 min", "in 2h 30m", "in 3 days" */
export function formatIn(d: Date, now: Date = new Date()): string {
  const min = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (min < 0) return "passed";
  if (min < 1) return "in under a minute";
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const days = Math.round(h / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}

/** Local wall-clock string for the server-side parser: "2026-11-14T10:05" */
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${hm(d)}`;
}

/** Reverse of localStamp, read in the device's time zone */
export function fromLocalStamp(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}
