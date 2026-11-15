// Rule-based time parser for mixed Bahasa Indonesia + English nudges.
// Runs in the browser, so the preview is instant and free.
// Examples: "rapat jam 3", "bayar listrik besok jam 9", "call mom at 3pm",
// "minum obat 30 menit lagi", "angkat mie 3 menit 30 detik lagi", "in 45 sec", "in 20 min check oven", "jumat sore kirim laporan".

export type Parsed = { text: string; due: Date | null };

type Category = "am" | "noon" | "pm" | "night";

const PARTS = "pagi|siang|sore|malam|morning|noon|afternoon|evening|night";
const PART_INFO: Record<string, { cat: Category; hour: number }> = {
  pagi: { cat: "am", hour: 8 },
  morning: { cat: "am", hour: 8 },
  siang: { cat: "noon", hour: 12 },
  noon: { cat: "noon", hour: 12 },
  afternoon: { cat: "pm", hour: 15 },
  sore: { cat: "pm", hour: 16 },
  evening: { cat: "pm", hour: 19 },
  malam: { cat: "night", hour: 20 },
  night: { cat: "night", hour: 20 },
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, sunday: 0,
  senin: 1, monday: 1,
  selasa: 2, tuesday: 2,
  rabu: 3, wednesday: 3,
  kamis: 4, thursday: 4,
  jumat: 5, "jum'at": 5, friday: 5,
  sabtu: 6, saturday: 6,
};
const WD = Object.keys(WEEKDAYS).join("|");

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agt: 7, agus: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};
const MON = Object.keys(MONTHS).join("|");

const PREFIX = String.raw`(?:\b(?:jam|jm|pukul|pkl|at)\s*|@\s*)`;
const NOT_UNIT = String.raw`(?!\s*(?:menit|mnt|min|mins|minutes?|jam|hours?|hrs?|hari|days?|minggu|weeks?|lagi)\b)`;
const TIME_SUFFIX =
  String.raw`(?:\s+${PREFIX}?(\d{1,2})(?:[:.](\d{2}))?\b${NOT_UNIT}(?:\s*(am|pm|${PARTS})\b)?|\s+(${PARTS})\b)?`;

const DATE_WORDS = [
  "day after tomorrow", "hari ini", "today", "besok", "tomorrow", "tmrw", "tmr", "bsk", "lusa",
  "nanti", "tonight", "this morning", "this afternoon", "this evening", "next week",
  "minggu depan", "pekan depan",
].join("|");

const RE = {
  relHM: new RegExp(String.raw`(?:\bin\s+)?\b(\d{1,2})\s*(?:jam|hours?|hrs?|h)\s*(\d{1,2})\s*(?:menit|mnt|minutes?|mins?|m)\b(?:\s+lagi\b)?`, "g"),
  relHalf: /(?:\bin\s+)?\b(?:setengah\s+jam|half\s+an?\s+hour)\b(?:\s+lagi\b)?/g,
  relHour1: /\bin\s+an?\s+hour\b|\bsejam(?:\s+lagi)?\b/g,
  relMS: /(?:\bin\s+)?\b(\d{1,3})\s*(?:menit|mnt|minutes?|mins?|m)\s*(\d{1,3})\s*(?:detik|dtk|seconds?|secs?|s)\b(?:\s+lagi\b)?/g,
  relMin: /(?:\bin\s+)?\b(\d{1,4})\s*(?:menit|mnt|minutes?|mins?|m)\b(?:\s+lagi\b)?/g,
  relSec: /(?:\bin\s+)?\b(\d{1,5})\s*(?:detik|dtk|seconds?|secs?|s)\b(?:\s+lagi\b)?/g,
  relHour: /\bin\s+(\d{1,3})\s*(?:jam|hours?|hrs?|h)\b|\b(\d{1,3})\s*(?:jam|hours?|hrs?|h)\s+lagi\b|\b(\d{1,3})\s*(?:hours?|hrs?|h)\b/g,
  relDays: /\bin\s+(\d{1,2})\s*days?\b|\b(\d{1,2})\s*(?:hari|days?)\s+lagi\b/g,
  relWeeks: /\bin\s+(\d{1,2})\s*weeks?\b|\b(\d{1,2})\s*(?:minggu|pekan|weeks?)\s+lagi\b/g,
  partToday: new RegExp(String.raw`\b(${PARTS})\s+ini\b`, "g"),
  dateWord: new RegExp(String.raw`\b(${DATE_WORDS}|(?:hari\s+)?(?:next\s+)?(?:${WD})(?:\s+depan)?)\b` + TIME_SUFFIX, "g"),
  dmy: /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g,
  dMon: new RegExp(String.raw`\b(?:(?:tgl\.?|tanggal)\s*)?(\d{1,2})\s+(${MON})\b(?:\s+(\d{4})\b)?`, "g"),
  monD: new RegExp(String.raw`\b(${MON})\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "g"),
  tgl: /\b(?:tgl\.?|tanggal)\s*(\d{1,2})\b/g,
  hhmm: new RegExp(String.raw`${PREFIX}?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?:\s*(am|pm|${PARTS})\b)?`, "g"),
  hAmPm: new RegExp(String.raw`${PREFIX}?\b(1[0-2]|0?[1-9])\s*(am|pm)\b`, "g"),
  hPrefixed: new RegExp(String.raw`${PREFIX}([01]?\d|2[0-3])\b${NOT_UNIT}(?:\s*(${PARTS})\b)?`, "g"),
  hPart: new RegExp(String.raw`\b(1[0-2]|0?[1-9])\s+(${PARTS})\b`, "g"),
};

const MASK = "\u0001";

class Scanner {
  src: string;
  work: string;
  masked: boolean[];
  constructor(src: string) {
    this.src = src;
    this.work = src.toLowerCase();
    this.masked = new Array(src.length).fill(false);
  }
  // Calls fn for each match; fn returns false to leave that match in the text.
  take(re: RegExp, fn: (m: RegExpExecArray) => boolean | void) {
    re.lastIndex = 0;
    const hits: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.work))) {
      hits.push(m);
      if (m[0].length === 0) re.lastIndex++;
    }
    for (const hit of hits) {
      if (fn(hit) === false) continue;
      const a = hit.index;
      const b = a + hit[0].length;
      this.work = this.work.slice(0, a) + MASK.repeat(b - a) + this.work.slice(b);
      for (let i = a; i < b; i++) this.masked[i] = true;
    }
  }
  rest() {
    let out = "";
    for (let i = 0; i < this.src.length; i++) out += this.masked[i] ? " " : this.src[i];
    return out;
  }
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function at(day: Date, h: number, m: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

function hourForPart(h: number, cat: Category): number {
  if (cat === "am") return h === 12 ? 0 : h;
  if (cat === "noon") return h >= 1 && h <= 6 ? h + 12 : h;
  if (cat === "pm") return h < 12 ? h + 12 : h;
  // night: "jam 8 malam" = 20:00, "jam 12 malam" = 00:00, "jam 2 malam" = 02:00
  if (h === 12) return 0;
  return h >= 5 && h < 12 ? h + 12 : h;
}

function cleanText(s: string) {
  let t = s.replace(/\s+/g, " ").trim();
  t = t.replace(
    /^(?:(?:tolong\s+)?(?:ingetin|ingatin|ingatkan|ingetkan)(?:\s+(?:aku|saya|gue|gw))?(?:\s+(?:untuk|buat|utk))?|remind me(?:\s+to)?|nudge me(?:\s+to)?|jangan lupa)\b\s*/i,
    "",
  );
  t = t.replace(/(?:^|\s)(?:at|on|by|pada|in)\s*$/i, "");
  t = t.replace(/^[\s,;:.-]+|[\s,;:-]+$/g, "");
  return t.replace(/\s+/g, " ").trim();
}

export function parseNudge(input: string, now: Date = new Date()): Parsed {
  const s = new Scanner(input);

  type State = {
    relSec: number;
    hasRel: boolean;
    exact: boolean;
    dayOffset: number | null;
    weekday: { dow: number; strict: boolean } | null;
    abs: { d: number; mo: number | null; y: number | null } | null;
    time: { h: number; m: number; mod: string | null } | null;
    part: string | null;
  };
  const st: State = { relSec: 0, hasRel: false, exact: false, dayOffset: null, weekday: null, abs: null, time: null, part: null };
  const dateSet = () => st.dayOffset !== null || st.weekday !== null || st.abs !== null;

  // 1. Relative times ("30 detik lagi", "30 menit lagi", "in 2 hours", "1 jam 30 menit lagi")
  s.take(RE.relHM, (m) => { st.relSec += (+m[1] * 60 + +m[2]) * 60; st.hasRel = true; });
  s.take(RE.relHalf, () => { st.relSec += 30 * 60; st.hasRel = true; });
  s.take(RE.relHour1, () => { st.relSec += 60 * 60; st.hasRel = true; });
  s.take(RE.relMS, (m) => { st.relSec += +m[1] * 60 + +m[2]; st.hasRel = true; st.exact = true; });
  s.take(RE.relMin, (m) => { st.relSec += +m[1] * 60; st.hasRel = true; });
  s.take(RE.relSec, (m) => { st.relSec += +m[1]; st.hasRel = true; st.exact = true; });
  s.take(RE.relHour, (m) => { st.relSec += +(m[1] ?? m[2] ?? m[3]) * 3600; st.hasRel = true; });

  // 2. Relative days ("3 hari lagi", "2 minggu lagi", "in 3 days")
  s.take(RE.relDays, (m) => { if (dateSet()) return false; st.dayOffset = +(m[1] ?? m[2]); });
  s.take(RE.relWeeks, (m) => { if (dateSet()) return false; st.dayOffset = 7 * +(m[1] ?? m[2]); });

  // 3. "malam ini", "sore ini"
  s.take(RE.partToday, (m) => {
    if (dateSet()) return false;
    st.dayOffset = 0;
    st.part = m[1];
  });

  // 4. Date words, optionally followed by a time ("besok jam 9", "jumat sore", "nanti malam")
  s.take(RE.dateWord, (m) => {
    if (dateSet()) return false;
    const word = m[1].replace(/\s+/g, " ");
    const hasTime = m[2] !== undefined;
    const hasPart = m[5] !== undefined;
    if (word === "nanti" && !hasTime && !hasPart) return false;

    if (word === "hari ini" || word === "today" || word === "nanti") st.dayOffset = 0;
    else if (["besok", "tomorrow", "tmrw", "tmr", "bsk"].includes(word)) st.dayOffset = 1;
    else if (word === "lusa" || word === "day after tomorrow") st.dayOffset = 2;
    else if (word === "tonight") { st.dayOffset = 0; st.part = "night"; }
    else if (word.startsWith("this ")) { st.dayOffset = 0; st.part = word.slice(5); }
    else if (word === "next week" || word === "minggu depan" || word === "pekan depan") st.dayOffset = 7;
    else {
      const strict = word.includes("next ") || word.endsWith(" depan");
      const name = word.replace(/^hari\s+/, "").replace(/^next\s+/, "").replace(/\s+depan$/, "");
      if (!(name in WEEKDAYS)) return false;
      st.weekday = { dow: WEEKDAYS[name], strict };
    }

    if (hasTime) {
      const h = +m[2];
      const mi = m[3] ? +m[3] : 0;
      if (h <= 23 && mi <= 59) st.time = { h, m: mi, mod: m[4] ?? null };
    } else if (hasPart) {
      st.part = m[5];
    }
  });

  // 5. Absolute dates ("20/12", "20 nov", "nov 20", "tgl 25")
  s.take(RE.dmy, (m) => {
    if (dateSet()) return false;
    const d = +m[1];
    const mo = +m[2];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return false;
    let y = m[3] ? +m[3] : null;
    if (y !== null && y < 100) y += 2000;
    st.abs = { d, mo: mo - 1, y };
  });
  s.take(RE.dMon, (m) => {
    if (dateSet()) return false;
    if (+m[1] < 1 || +m[1] > 31) return false;
    st.abs = { d: +m[1], mo: MONTHS[m[2]], y: m[3] ? +m[3] : null };
  });
  s.take(RE.monD, (m) => {
    if (dateSet()) return false;
    if (+m[2] < 1 || +m[2] > 31) return false;
    st.abs = { d: +m[2], mo: MONTHS[m[1]], y: null };
  });
  s.take(RE.tgl, (m) => {
    if (dateSet()) return false;
    if (+m[1] < 1 || +m[1] > 31) return false;
    st.abs = { d: +m[1], mo: null, y: null };
  });

  // 6. Times ("15:30", "3pm", "jam 3 sore", "at 9", "9 pagi")
  s.take(RE.hhmm, (m) => { if (st.time) return false; st.time = { h: +m[1], m: +m[2], mod: m[3] ?? null }; });
  s.take(RE.hAmPm, (m) => { if (st.time) return false; st.time = { h: +m[1], m: 0, mod: m[2] }; });
  s.take(RE.hPrefixed, (m) => { if (st.time) return false; st.time = { h: +m[1], m: 0, mod: m[2] ?? null }; });
  s.take(RE.hPart, (m) => { if (st.time) return false; st.time = { h: +m[1], m: 0, mod: m[2] }; });

  const text = cleanText(s.rest());

  if (st.hasRel) {
    const due = new Date(now.getTime() + st.relSec * 1000);
    // Seconds given: keep them. Otherwise land on a whole minute.
    if (!st.exact) due.setSeconds(due.getSeconds() >= 30 ? 60 : 0, 0);
    else due.setMilliseconds(0);
    return { text, due };
  }

  // Resolve the date
  const today = startOfDay(now);
  let base: Date | null = null;
  let rollWeek = false;
  let isToday = false;
  if (st.abs) {
    const a = st.abs as { d: number; mo: number | null; y: number | null };
    let y = a.y ?? now.getFullYear();
    let mo = a.mo ?? now.getMonth();
    let d = new Date(y, mo, a.d);
    if (a.y === null && d < today) {
      if (a.mo === null) mo += 1;
      else y += 1;
      d = new Date(y, mo, a.d);
    }
    if (d.getDate() === a.d) base = d;
  } else if (st.weekday) {
    const w = st.weekday as { dow: number; strict: boolean };
    let diff = (w.dow - now.getDay() + 7) % 7;
    if (diff === 0 && w.strict) diff = 7;
    rollWeek = diff === 0;
    base = addDays(today, diff);
  } else if (st.dayOffset !== null) {
    base = addDays(today, st.dayOffset);
    isToday = st.dayOffset === 0;
  }

  if (!st.time && !st.part && !base) return { text, due: null };

  // Resolve the hour
  let h = 9;
  let mi = 0;
  let ambiguous = false;
  if (st.time) {
    const t = st.time as { h: number; m: number; mod: string | null };
    h = t.h;
    mi = t.m;
    if (t.mod === "am") h = h === 12 ? 0 : h;
    else if (t.mod === "pm") h = h < 12 ? h + 12 : h;
    else if (t.mod) h = hourForPart(h, PART_INFO[t.mod].cat);
    else if (h >= 1 && h <= 12) ambiguous = true;
  } else if (st.part) {
    h = PART_INFO[st.part].hour;
  }

  const options = ambiguous ? [h % 12, (h % 12) + 12] : [h];
  let due: Date | null = null;

  if (!base || isToday) {
    // No date (or "today"): pick the nearest upcoming option
    const days = base ? [0] : [0, 1];
    for (const add of days) {
      for (const hh of options) {
        const d = at(addDays(today, add), hh, mi);
        if (d > now && (!due || d < due)) due = d;
      }
    }
    if (!due) due = at(base ?? today, ambiguous && h <= 6 ? h + 12 : h, mi);
  } else {
    // A date was given: read 1 to 6 as afternoon ("besok jam 3" = 15:00)
    if (ambiguous) h = h === 12 ? 12 : h <= 6 ? h + 12 : h;
    due = at(base, h, mi);
    if (rollWeek && due <= now) due = at(addDays(base, 7), h, mi);
  }

  return { text, due };
}
