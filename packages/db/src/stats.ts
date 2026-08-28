import type { StatsRow } from "@miolos/core";
import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, users } from "./schema";

export async function listCompletionsForStats(
  db: Db,
  userId: string,
): Promise<StatsRow[]> {
  return db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      onTime: completions.onTime,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
      guesses: completions.guesses,
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.date));
}

export async function getUserSince(
  db: Db,
  userId: string,
): Promise<string | undefined> {
  const rows = await db
    .select({
      since: sql<string>`((${users.createdAt} at time zone ${SAO_PAULO_TIME_ZONE})::date)::text`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.since;
}
