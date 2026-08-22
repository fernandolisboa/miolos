import {
  LATE_SYNC_CREDIT_DAYS_BACK,
  type CompletionOutcome,
  type DayRow,
  type Game,
  type HintGrantSource,
  type StreakRow,
} from "@miolos/core";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, hintGrants } from "./schema";

/**
 * User-scoped accessors (ADR-0026, ADR-0027) — reachable only through
 * `@miolos/db/user`, never the root entry: apps/web must not be able to
 * name these tables at all.
 *
 * NO JS `Date` appears in any statement in this file. `completed_at` and
 * `granted_at` are column defaults, and every day-scoped predicate is a
 * SQL expression over `now() at time zone 'America/Sao_Paulo'` — the DB
 * clock is the only clock (ADR-0010).
 */

/**
 * A completion as the rest of the system sees it. `onTime` is the STORED
 * write-time verdict, decided once by `POST /completions` and persisted —
 * never re-derived at read time (ADR-0066). `completedAt` is deliberately
 * absent: nothing outside this module needs the raw instant, and exposing
 * it invites JS timezone arithmetic.
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
 * Read a completion back with its STORED `on_time`; `undefined` when
 * the player has not finished that puzzle.
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
      onTime: completions.onTime,
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
 * Deliberately UNFILTERED: the pure function in packages/core is the only
 * place lost and late rows are excluded, so there is one definition of the
 * streak, not two.
 */
export async function listCompletionsForStreak(
  db: Db,
  userId: string,
): Promise<StreakRow[]> {
  return db
    .select({
      date: completions.date,
      outcome: completions.outcome,
      onTime: completions.onTime,
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.date));
}

/**
 * One user's completions for ONE São Paulo day, shaped for
 * `dayStateFromRows` (ADR-0060). At most four rows, by the composite
 * primary key.
 *
 * DATE-SCOPED IN SQL, unlike `listCompletionsForStreak` above: scoping to
 * one date is the question, not an exclusion rule, so it stays here
 * rather than in packages/core with lost/late.
 */
export async function listCompletionsForDay(
  db: Db,
  userId: string,
  date: string,
): Promise<DayRow[]> {
  return db
    .select({
      game: completions.game,
      outcome: completions.outcome,
      onTime: completions.onTime,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
    })
    .from(completions)
    .where(and(eq(completions.userId, userId), eq(completions.date, date)));
}

/**
 * Did this row's `completed_at` land on the São Paulo calendar day `day`?
 * NOT the on-time question — on-time is a stored write-time verdict; this
 * predicate's two consumers ask about the WRITE instant's day, which no
 * stored column carries, never against the puzzle's own `date` (that rule
 * lives in the route's `isWritableDate`).
 *
 * No JS `Date`: `day` arrives as a 'YYYY-MM-DD' string read off the DB
 * clock, and the cast runs in Postgres.
 */
function writtenOnSaoPauloDay(day: string) {
  return sql`(${completions.completedAt} at time zone ${SAO_PAULO_TIME_ZONE})::date = ${day}`;
}

/** At most `max` late completions per user per São Paulo `day`. */
interface LateWriteCeiling {
  readonly day: string;
  readonly max: number;
}

/** `capped: true` is the only shape with no record: the ceiling refused the write. */
type CompletionWrite =
  | {
      readonly capped: false;
      readonly record: CompletionRecord;
      readonly recorded: boolean;
    }
  | { readonly capped: true };

/**
 * The write input shared by `guardedInsertSelect` and both
 * `recordCompletion` overloads. `onTime` is the write-time verdict,
 * decided by the route and stored verbatim.
 */
interface CompletionWriteInput {
  userId: string;
  game: Game;
  date: string;
  outcome: CompletionOutcome;
  elapsedMs: number;
  hintsUsed: number;
  guesses?: number;
  onTime: boolean;
}

/**
 * The ceiling folded INTO the insert, as one statement — a correctness
 * property, not a round-trip saving. A `count(*)` read followed by an
 * INSERT is check-then-act: concurrent writers can all read the same
 * count and all pass, overshooting the ceiling. `INSERT ... SELECT ...
 * WHERE (subquery) < max` renders as ONE statement, so no transaction is
 * needed to close the race — this repo has none available anyway
 * (neon-http is non-interactive-only, PGlite has no batch; see merge.ts).
 * The honest residual is READ COMMITTED's: each statement takes its own
 * snapshot at its own start, so writes whose statements overlap in time
 * can still overshoot by the number in flight (see ADR-0053).
 *
 * Lateness is the STORED `on_time` negated, never re-derived, so the
 * ceiling counts exactly the rows every reader projects as late; a
 * CREDITED row never enters this ARM (the route passes a ceiling only
 * when the write-time verdict is `false`). `completed_at` is `now()`
 * written out explicitly, because `INSERT ... SELECT` has no `DEFAULT`
 * keyword in its select list — still the DB clock, still no JS `Date`.
 */
function guardedInsertSelect(
  input: CompletionWriteInput,
  ceiling: LateWriteCeiling,
) {
  return sql`select ${input.userId}::uuid, ${input.game}::text, ${input.date}::date, now(), ${input.outcome}::text, ${input.elapsedMs}::integer, ${input.hintsUsed}::integer, ${input.guesses ?? null}::integer, ${input.onTime}::boolean
    where (
      select count(*) from ${completions}
      where ${completions.userId} = ${input.userId}::uuid
        and ${writtenOnSaoPauloDay(ceiling.day)}
        and not ${completions.onTime}
    ) < ${ceiling.max}`;
}

/**
 * Write-once completion. Returns the stored record and whether THIS call
 * wrote it, so an idempotent replay can be answered with the row the
 * server already holds instead of a conflict.
 *
 * Never `ON CONFLICT DO UPDATE`: an upsert would bump `completed_at` and
 * silently reclassify an on-time completion as late — the one thing the
 * streak mechanic cannot survive.
 *
 * `guesses` is Termo's and only Termo's. It is OPTIONAL here rather than a
 * discriminated per-game input because the database enforces the pairing:
 * `completions_guesses_check` is an equality, so a termo row without it
 * and a grid row with it both fail the write.
 *
 * `ceiling` is supplied ONLY when the write-time verdict is late
 * (`onTime === false`); a CREDITED write always takes the plain-values
 * arm. Without that exemption a player at the ceiling would 429 the
 * credited flush and retry after the next rollover, landing two days back
 * and storing `false` — a permanently lost streak day on a write-once
 * row. Safe: the credit is server-derived and unforgeable, bounded at ≤4
 * rows per user per day by construction. This pairing is a CALL-SITE
 * DISCIPLINE, enforced by review and tests rather than by types.
 *
 * A capped caller can still REPLAY: the guard suppresses the insert, the
 * unconditional read-back still runs, and a row already held comes back
 * as `recorded: false`. Only "guard refused AND no row is readable" is
 * `capped`.
 */
export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
): Promise<Extract<CompletionWrite, { capped: false }>>;
export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
  ceiling: LateWriteCeiling,
): Promise<CompletionWrite>;
export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
  ceiling?: LateWriteCeiling,
): Promise<CompletionWrite> {
  // Bare .returning(): on the union `Db` type only the no-argument overload
  // survives TS's union-signature collapse. The row shape is discarded
  // anyway — `on_time` has to come from SQL, so the read-back below is
  // unconditional.
  const inserted = ceiling
    ? await db
        .insert(completions)
        .select(guardedInsertSelect(input, ceiling))
        .onConflictDoNothing({
          target: [completions.userId, completions.game, completions.date],
        })
        .returning()
    : await db
        .insert(completions)
        .values({
          userId: input.userId,
          game: input.game,
          date: input.date,
          outcome: input.outcome,
          elapsedMs: input.elapsedMs,
          hintsUsed: input.hintsUsed,
          guesses: input.guesses,
          onTime: input.onTime,
        })
        .onConflictDoNothing({
          target: [completions.userId, completions.game, completions.date],
        })
        .returning();
  const recorded = inserted.length > 0;

  const record = await getCompletion(db, input.userId, input.game, input.date);
  if (!record) {
    if (ceiling && !recorded) {
      // The guard refused AND the caller holds no row: the ceiling is met.
      // `!recorded` is load-bearing — `!record` alone would 429 a row this
      // call DID write, where the unguarded arm throws instead.
      return { capped: true };
    }
    // The row vanished between the two statements: a bug, a manual
    // truncate, or a concurrent `mergeAccounts` deleting the loser's
    // completions. Whatever the cause, it is not the ceiling, and both
    // arms treat it the same way.
    throw new Error("completions insert left no readable row");
  }
  return { capped: false, record, recorded };
}

/**
 * The multi-past-date guard's read: has this user, on the current São
 * Paulo day (`today`), already written a CREDITED row for an IN-WINDOW
 * past date other than `excludingDate`? `POST /completions` refuses the
 * write with `422 multi-date-sync` when this answers true: per user per
 * writing day, at most one distinct past date is ever credited. Distinct
 * DATES, not games — three grid games for one date is legitimate.
 *
 * A WIDENING TRIPWIRE, provably empty under the 1-day credit window: the
 * predicate carries the window itself, so its match set is
 * `date ∈ [today − 1, today) ∧ date ≠ today − 1` — empty by CONSTRUCTION.
 * The window conjunct is load-bearing, not belt-and-braces: without it the
 * guard would catch the rollover-straddle artefact (a credit whose
 * `today` was read just before midnight but whose INSERT landed after)
 * and answer 422 — terminal in the sync client — to the next day's
 * legitimate credited flush, a silent permanent loss of a streak day. It
 * ships inert on purpose: read-then-act is safe only because a 1-day
 * window makes a concurrent double-credit of two distinct dates
 * structurally impossible, and any widening must fold this guard into the
 * insert instead (the ceiling's precedent).
 */
export async function hasCreditedPastDateToday(
  db: Db,
  userId: string,
  args: { today: string; excludingDate: string },
): Promise<boolean> {
  const rows = await db
    .select({ date: completions.date })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        eq(completions.onTime, true),
        sql`${completions.date} < ${args.today}`,
        sql`${completions.date} >= ${args.today}::date - ${LATE_SYNC_CREDIT_DAYS_BACK}::int`,
        sql`${completions.date} <> ${args.excludingDate}`,
        writtenOnSaoPauloDay(args.today),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * DORMANT: v1 records no consumption, so this is hints GRANTED for the DB
 * clock's SP today, not "available"; 0 when none. The day scope is the
 * whole expiry mechanism — nothing decrements or carries over, so a grant
 * is gone once its date key falls behind SP-today. No job, no TTL column.
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
 * DORMANT — append-only grant event, never a balance top-up. `date` is
 * the SP day the grant is valid for, and the row is the whole record:
 * nothing here reads or mutates a running total.
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
