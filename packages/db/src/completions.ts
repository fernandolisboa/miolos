import type {
  CompletionOutcome,
  DayRow,
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
 * One user's completions for ONE São Paulo day, shaped for
 * `dayStateFromRows` (#83, ADR-0060 decision 1). At most four rows, by the
 * composite primary key.
 *
 * DATE-SCOPED IN SQL, unlike `listCompletionsForStreak` above and
 * `listCompletionsForStats`. Those two are unfiltered because the EXCLUSION
 * RULES — lost, late — must live in one place, and that place is
 * packages/core. Scoping to one date is not an exclusion rule: it is the
 * question. `getCompletion` two functions up already scopes
 * `(user, game, date)` in SQL for exactly that reason.
 *
 * NO SCHEMA CHANGE WAS OWED FOR IT, and the evidence is in the schema:
 * `completions_user_date_idx` on `(user_id, date)` exists, and its own
 * comment names *"the day so far"* as one of the two reads it was built
 * for. The read is <= 4 rows on an index built for it — constant cost
 * forever, on the most-hit route in the app. Reusing
 * `listCompletionsForStats` instead would need no db change at all, which
 * is its real merit, and it reads the user's ENTIRE history (~2 900 rows
 * after two years) to produce four enum values on every hub view: building
 * ADR-0051 decision 3's narrow endpoint with the wide read is building it
 * and skipping the point.
 *
 * `onTime` is the ONE `onTimeSql()` derivation (ADR-0026 decision 2), like
 * every other reader here. No second spelling, and no `completedAt`: the
 * verdict travels, the instant does not. `elapsedMs` DOES travel since #141
 * — the hub tile consumes it (ADR-0060 decision 2 as annotated there) — and
 * it is a stored column, so projecting it changes neither the predicate nor
 * the index this read sits on.
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
      onTime: onTimeSql(),
      elapsedMs: completions.elapsedMs,
    })
    .from(completions)
    .where(and(eq(completions.userId, userId), eq(completions.date, date)));
}

/**
 * THE write-instant day predicate: did this row's `completed_at` land on
 * the São Paulo calendar day `day`? One spelling, like `onTimeSql()` above
 * and for the same reason (ADR-0026 decision 2).
 *
 * `day` is compared against the WRITE instant, never against the puzzle's
 * own `date`: the ceiling below is a per-day rate rule on the writer, not
 * a date rule on the puzzle. The date rule lives in the route
 * (`isWritableDate`, ADR-0026 decision 6 as amended by ADR-0053), and
 * after #31 it has no lower bound at all — which is exactly why the
 * ceiling exists.
 *
 * No JS `Date`: the day arrives as a 'YYYY-MM-DD' string the caller read
 * off the DB clock, and the cast runs in Postgres.
 */
function writtenOnSaoPauloDay(day: string) {
  return sql`(${completions.completedAt} at time zone ${SAO_PAULO_TIME_ZONE})::date = ${day}`;
}

/**
 * The LATE-write ceiling (#31, ADR-0053 decision 13): at most `max` late
 * rows per user per São Paulo `day`. Passed only on the late branch, so
 * the daily ritual's INSERT is byte-identical to the one it always was.
 * Not an *archive*-write ceiling: the branch also admits ADR-0026
 * decision 7's post-rollover flush, which is inside it by construction.
 */
interface LateWriteCeiling {
  readonly day: string;
  readonly max: number;
}

/**
 * What a guarded write answers. `capped: true` is the ONLY shape carrying
 * no record: the ceiling refused the row and nothing was written.
 */
type CompletionWrite =
  | {
      readonly capped: false;
      readonly record: CompletionRecord;
      readonly recorded: boolean;
    }
  | { readonly capped: true };

/**
 * The ceiling folded INTO the insert, as one statement.
 *
 * This is the whole point of the shape and it is a correctness property,
 * not a round-trip saving. A `count(*)` read followed by an INSERT is
 * check-then-act: `Promise.all` over N requests reads one snapshot of the
 * count in all N and writes N rows, so the "50 per day" bound held only
 * against a strictly sequential client (step-6 finding F1). Measured on
 * the test stack: 20 concurrent writes against a ceiling of 10 wrote 20
 * rows in the two-statement form and 10 in this one.
 *
 * `INSERT ... SELECT ... WHERE (subquery) < max` renders as ONE SQL
 * statement — byte-identical through the neon-http and PGlite dialects,
 * PINNED by T-DB-S58 rather than probed once (production runs `neon-http`
 * and every other assertion about this guard runs on PGlite, so the
 * equality is load-bearing) — which matters because `neon-http` is
 * non-interactive-only and
 * PGlite has no batch, so this repo has no transaction to put the pair in
 * (merge.ts's recorded constraint, and why `pg_advisory_lock` is not
 * available either). The honest residual is READ COMMITTED's: each
 * statement takes its own snapshot at its own start, so writes whose
 * statements overlap in time can still overshoot by the number in flight.
 * ADR-0053 decision 13 states that bound rather than claiming a stricter
 * one.
 *
 * Two spellings that must be read together:
 *
 * - **Lateness is `onTimeSql()` negated**, never re-derived (ADR-0026
 *   decision 2's rule, applied to a guard), so the ceiling counts exactly
 *   the rows every reader projects as late.
 * - **`completed_at` is `now()` written out**, because `INSERT ... SELECT`
 *   has no `DEFAULT` keyword available in its select list. It is the same
 *   DB clock the column's own `defaultNow()` would have used — still no JS
 *   `Date` anywhere in this file — and drizzle builds the column list from
 *   the table, so a new column makes this select too short and the suite
 *   reds loudly rather than defaulting silently.
 */
function guardedInsertSelect(
  input: {
    userId: string;
    game: Game;
    date: string;
    outcome: CompletionOutcome;
    elapsedMs: number;
    hintsUsed: number;
    guesses?: number;
  },
  ceiling: LateWriteCeiling,
) {
  return sql`select ${input.userId}::uuid, ${input.game}::text, ${input.date}::date, now(), ${input.outcome}::text, ${input.elapsedMs}::integer, ${input.hintsUsed}::integer, ${input.guesses ?? null}::integer
    where (
      select count(*) from ${completions}
      where ${completions.userId} = ${input.userId}::uuid
        and ${writtenOnSaoPauloDay(ceiling.day)}
        and not (${onTimeSql()})
    ) < ${ceiling.max}`;
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
 *
 * `ceiling` is the late-write ceiling (#31, ADR-0053 decision 13) and is
 * supplied ONLY on the late branch. With it the INSERT carries its own
 * guard (`guardedInsertSelect` above) and the result may be `capped`;
 * without it — every daily write — the statement and the return shape are
 * exactly what they always were, which is what the two overloads say.
 *
 * A capped caller can still REPLAY: the guard suppresses the insert, the
 * unconditional read-back still runs, and a row already held comes back as
 * `recorded: false`. Only "guard refused AND no row is readable" is
 * `capped`.
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
): Promise<Extract<CompletionWrite, { capped: false }>>;
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
  ceiling: LateWriteCeiling,
): Promise<CompletionWrite>;
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
  ceiling?: LateWriteCeiling,
): Promise<CompletionWrite> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse (session/service.ts and
  // buffer.ts precedents). The row shape is discarded anyway — `on_time`
  // has to come from SQL, so the read-back below is unconditional.
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
      // `!recorded` is load-bearing, not decoration — `!record` alone would
      // answer 429 for a row this call DID write, where the unguarded arm
      // throws. That asymmetry has no justification, and the doc block
      // above already promises the conjunction.
      return { capped: true };
    }
    // The row vanished between the two statements: a bug, a manual
    // truncate, or a concurrent `mergeAccounts` (merge.ts deletes the
    // loser's completions, reachable through POST /attach/confirm — so
    // "the schema has no delete path", which this comment used to say, is
    // false). Whatever the cause, it is not the ceiling, and both arms
    // treat it the same way.
    throw new Error("completions insert left no readable row");
  }
  return { capped: false, record, recorded };
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
