import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { env } from "./env";

let client: NeonQueryFunction<false, false> | null = null;

/** Tagged-template SQL client. Usage: await db()`select * from users where id = ${id}` */
export function db(): NeonQueryFunction<false, false> {
  if (!client) client = neon(process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? env("DATABASE_URL"));
  return client;
}

export type NudgeRow = {
  id: string;
  user_id: string;
  text: string;
  due_at: Date | string;
  status: "pending" | "firing" | "done" | "cancelled";
  seq: number;
  next_fire_at: Date | string | null;
  queued: boolean;
  fire_count: number;
};

export function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

export function publicNudge(n: NudgeRow) {
  return {
    id: n.id,
    text: n.text,
    dueAt: toDate(n.due_at).toISOString(),
    status: n.status,
    fireCount: n.fire_count,
  };
}
