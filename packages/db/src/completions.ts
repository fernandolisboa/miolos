import type {
  CompletionOutcome,
  Game,
  HintGrantSource,
  StreakRow,
} from "@miolos/core";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, hintGrants } from "./schema";

/**
 * User-scoped accessors (ADR-0026, ADR-0027) — reachable only through
 * `@miolos/db/user` (plan 017 D17), never the root entry: apps/web holds
 * the db dependency for the public wall read and must not be able to name
 * these tables at all.
 *
 * NO JS `Date` appears in any statement in this file. `completed_at` and
 * `granted_at` are column defaults, and every day-scoped predicate is a
 * SQL expression over `now() at time zone 'America/Sao_Paulo'` — the DB
 * clock is the only clock (CLAUDE.md invariant, ADR-0010).
 */

/**
 * A completion as the rest of the system sees it. `onTime` is computed in
 * the read-back SELECT, never stored (plan 017 D16): ADR-0009 recomputes
 * streaks from these rows, so the derivation must stay the definition.
 * `completedAt` is deliberately absent — nothing outside this module has a
 * use for the raw instant, and exposing it invites JS timezone arithmetic.
 */
export interface CompletionRecord {
  readonly game: Game;
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  readonly elapsedMs: number;
  readonly hintsUsed: number;
}

/**
 * THE `on_time` derivation (ADR-0026 decision 2: "in one place and one
 * language"). Every reader projects this one expression — the two readers
 * here plus `listCompletionsForMerge` (merge.ts) and
 * `listCompletionsForStats` (stats.ts, #29) — a second spelling anywhere
 * is the drift that decision exists to prevent. #58, if it lands,
 * replaces this producer with a stored column and nothing downstream.
 */
export function onTimeSql() {
  return sql<boolean>`(${completions.completedAt} at time zone ${SAO_PAULO_TIME_ZONE})::date = ${completions.date}`;
}

/**
 * Read a completion back with its SQL-derived `on_time`; `undefined` when
 * the player has not finished that puzzle. A projected `.select({...})` is
 * proven to work on the union `Db` (the `resolveSession` precedent) —
 * unlike `.returning({...})`, which does not (see `recordCompletion`).
 */
export async function getCompletion(
  db: Db,
  userId: string,
  game: Game,
  date: string,
): Promise<CompletionRecord | undefined> {
  const rows = await db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
      onTime: onTimeSql(),
    })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        eq(completions.game, game),
        eq(completions.date, date),
      ),
    )
    .limit(1);
  return rows[0];
}

/**
 * Every completion row of one user, shaped for `computeStreak` (ADR-0009).
 * Deliberately UNFILTERED — no `where outcome`, no `where on_time`: the
 * pure function in packages/core is the only place lost and late rows are
 * excluded, so the API seam exercises the authority AC 1 names (plan 027
 * D3). Two filters would be two definitions of the streak; there is one.
 *
 * No limit in v1: the composite PK bounds the result at ≤4 rows per day,
 * and `completions_user_date_idx` was built for exactly this read
 * (schema.ts). A windowed read is a later optimisation with a measured
 * trigger (plan 027 §16 risk 6), never a semantic change. The descending
 * order is not required by the (permutation-invariant) function — it keeps
 * the planner on the index and test fixtures readable.
 */
export async function listCompletionsForStreak(
  db: Db,
  userId: string,
): Promise<StreakRow[]> {
  return db
    .select({
      date: completions.date,
      outcome: completions.outcome,
      onTime: onTimeSql(),
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.date));
}

/**
 * Write-once completion (plan 017 D15). Returns the stored record and
 * whether THIS call wrote it, so an idempotent replay can be answered with
 * the row the server already holds instead of a conflict.
 *
 * Never `ON CONFLICT DO UPDATE`: an upsert would bump `completed_at` and
 * silently reclassify an on-time completion as late — the one thing the
 * streak mechanic cannot survive.
 *
 * `guesses` is Termo's and only Termo's (#27, ADR-0038 decision 6). It is
 * OPTIONAL here rather than a discriminated per-game input because the
 * database is what enforces the pairing: `completions_guesses_check` is an
 * equality, so a termo row without it and a grid row with it both fail the
 * write. Omitted, drizzle emits the SQL keyword `default` — i.e. NULL — which
 * is the only legal value for the other three games.
 */
export async function recordCompletion(
  db: Db,
  input: {
    userId: string;
    game: Game;
    date: string;
    outcome: CompletionOutcome;
    elapsedMs: number;
    hintsUsed: number;
    guesses?: number;
  },
): Promise<{ record: CompletionRecord; recorded: boolean }> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse (session/service.ts and
  // buffer.ts precedents). The row shape is discarded anyway — `on_time`
  // has to come from SQL, so the read-back below is unconditional.
  const inserted = await db
    .insert(completions)
    .values({
      userId: input.userId,
      game: input.game,
      date: input.date,
      outcome: input.outcome,
      elapsedMs: input.elapsedMs,
      hintsUsed: input.hintsUsed,
      guesses: input.guesses,
    })
    .onConflictDoNothing({
      target: [completions.userId, completions.game, completions.date],
    })
    .returning();
  const recorded = inserted.length > 0;

  const record = await getCompletion(db, input.userId, input.game, input.date);
  if (!record) {
    // Only reachable if the row vanished between the two statements — the
    // schema has no delete path, so this is a bug or a manual truncate.
    throw new Error("completions insert left no readable row");
  }
  return { record, recorded };
}

/**
 * DORMANT (plan 017 D22). Hints GRANTED for the DB clock's SP today; 0
 * when none. Named for what it computes: v1 records no consumption of
 * granted hints, so this is not "available" — ADR-0027 names the seam the
 * rewarded-ad ticket must add.
 *
 * The day scope is the whole expiry mechanism: nothing decrements and
 * nothing carries over, so a grant is gone the moment its date key falls
 * behind SP-today. No job, no TTL column.
 */
export async function grantedHintsToday(
  db: Db,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({
      // `sum(integer)` is bigint in Postgres and would arrive as a STRING;
      // the ::int cast keeps the driver-parsed value a number. The CHECK
      // caps a grant at 10 hints, so overflow is not a concern.
      hints: sql<number>`coalesce(sum(${hintGrants.hints}), 0)::int`,
    })
    .from(hintGrants)
    .where(
      and(
        eq(hintGrants.userId, userId),
        sql`${hintGrants.date} = (now() at time zone ${SAO_PAULO_TIME_ZONE})::date`,
      ),
    );
  return rows[0]?.hints ?? 0;
}

/**
 * DORMANT (plan 017 D22) — append-only grant event, never a balance
 * top-up. `date` is the SP day the grant is valid for, and the row is the
 * whole record: nothing here reads or mutates a running total.
 *
 * EXTENSION POINT: the rewarded-ad ticket is the first caller.
 */
export async function grantHints(
  db: Db,
  input: {
    userId: string;
    date: string;
    source: HintGrantSource;
    hints: number;
  },
): Promise<void> {
  await db.insert(hintGrants).values({
    userId: input.userId,
    date: input.date,
    source: input.source,
    hints: input.hints,
  });
}
