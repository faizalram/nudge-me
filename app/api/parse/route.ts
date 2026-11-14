import { HttpError, requireUser, route } from "@/lib/server/http";

// Fallback for times the built-in parser misses. Needs ANTHROPIC_API_KEY.
export const POST = route(async (req: Request) => {
  await requireUser();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new HttpError(501, "Smart time reading is off. Add a time like 'jam 3' or 'in 20 min'.");

  const { text, now, tz } = (await req.json()) as { text?: string; now?: string; tz?: string };
  const input = (text ?? "").trim().slice(0, 280);
  if (!input || !now) throw new HttpError(400, "Nothing to read.");

  const system = [
    "You extract a reminder from a short note written in Indonesian, English, or a mix.",
    `The user's local time now is ${now} (${tz ?? "unknown time zone"}).`,
    'Reply with JSON only, no other text: {"text": string, "due": string | null}',
    '"text" is the task with the time words removed, in the user\'s own words.',
    '"due" is the local date and time as "YYYY-MM-DDTHH:mm", or null if the note has no time.',
    "Rules: a bare hour from 1 to 6 with no other hint means afternoon. A date with no time means 09:00.",
    "Never return a time earlier than now.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: input }],
    }),
  });
  if (!res.ok) {
    console.error("anthropic error", res.status, await res.text());
    throw new HttpError(502, "Couldn't read the time. Add one like 'jam 3' or tap a time below.");
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const out = data.content?.find((b) => b.type === "text")?.text ?? "";
  const json = out.match(/\{[\s\S]*\}/)?.[0];
  let parsed: { text?: unknown; due?: unknown } = {};
  try {
    parsed = json ? JSON.parse(json) : {};
  } catch {
    parsed = {};
  }
  const due = typeof parsed.due === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(parsed.due) ? parsed.due : null;
  const cleanText = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : input;
  return Response.json({ text: cleanText, due });
});
