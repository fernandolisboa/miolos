import type { StatsRow } from "@miolos/core";
import { desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, users } from "./schema";

/**
 * The #29 statistics readers (plan 033 §3.1, ADR-0051) — user-scoped
 * accessors reachable only through `@miolos/db/user` (ADR-0026 decision
 * 5), never the root entry: apps/web must not be able to name these
 * tables at all.
 *
 * NO JS `Date` appears in any statement in this file (the completions.ts
 * file-header law): every instant-to-day projection is a SQL expression,
 * because the DB clock is the only clock (CLAUDE.md invariant, ADR-0010).
 * The `created_at`-to-SP-date expression in `getUserSince` is a NEW
 * fact's derivation (the account's birth day, D2's calendar anchor) —
 * not a second spelling of on-time, which since #58 (ADR-0066) is a
 * STORED write-time verdict with a single producer, `onTimeAtWrite`
 * applied by `POST /completions` — every reader here projects the column.
 */

/**
 * Every completion row of one user, shaped for the #29/#30 derivations
 * (ADR-0049 decision 6: the statistics and, later, the medals recompute
 * over this ONE reader). Deliberately UNFILTERED — no `where outcome`, no
 * `where on_time`: the pure functions in packages/core are the only place
 * lost and late rows are excluded (plan 033 D3). Two filters would be two
 * definitions of the exclusions; there is one.
 *
 * No limit in v1, on `listCompletionsForStreak`'s own argument: the
 * composite PK bounds the result at ≤4 rows per day and
 * `completions_user_date_idx` was built for exactly this read; a windowed
 * read is a later optimisation with a measured trigger (plan 027 §16
 * risk 6), never a semantic change.
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
 * The SP calendar day the account was born on (plan 033 D2's anchor —
 * `computeCalendar`'s `since`). `undefined` only if the user row vanished
 * mid-request (a deletion race) — callers throw, landing in the route's
 * catch-all 500. The trailing `::text` is the `todaySaoPaulo` register:
 * without it the driver hands back a JS `Date` for a `date` value, and
 * this module returns strings, never Dates.
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
