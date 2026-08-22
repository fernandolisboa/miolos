import type { StatsRow } from "@miolos/core";
import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, users } from "./schema";

/**
 * User-scoped accessors, reachable only through `@miolos/db/user`, never
 * the root entry.
 *
 * No JS `Date` appears in any statement in this file: every
 * instant-to-day projection is a SQL expression, because the DB clock is
 * the only clock (ADR-0010).
 */

/**
 * Every completion row of one user, deliberately unfiltered — no
 * `where outcome`, no `where on_time`: the pure functions in
 * packages/core are the only place lost and late rows are excluded.
 * Two filters would be two definitions of the exclusions; there is one.
 *
 * No `LIMIT`: unbounded reads are cheap at v1 scale; a windowed read is
 * a later optimisation, not a semantic change.
 */
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

/**
 * The SP calendar day the account was born on. `undefined` only if the
 * user row vanished mid-request (a deletion race) — callers throw. The
 * trailing `::text` matters: without it the driver hands back a JS
 * `Date` for a `date` column, and this module returns strings, never
 * Dates.
 */
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
