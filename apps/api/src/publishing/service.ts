import {
  binairoDailyContentSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  listUsedTermoAnswers,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { isWeekday } from "@miolos/games";
import {
  BinairoGenerationError,
  generateBinairo,
  validateBinairo,
} from "@miolos/games/binairo";
import {
  generateNonogram,
  NONOGRAM_WEEKDAY_CRITERIA,
  NonogramGenerationError,
  validateNonogram,
} from "@miolos/games/nonogram";
import {
  generateDailySudoku,
  SudokuGenerationError,
  sudokuCriteriaForWeekday,
  validateSudoku,
} from "@miolos/games/sudoku";
import { TERMO_ANSWERS } from "@miolos/games/termo";

import { addDays, isoWeekdayOf } from "./dates";

/** What every per-game top-up returns; the cron route wraps it (plan 018 §7.2). */
export interface TopUpResult {
  generated: number;
  depth: number;
  failures: { date: string; reason: string }[];
}

/**
 * A top-up that wrote rows and THEN threw, carrying out the counters that
 * would otherwise die with the rejected promise (finding
 * `cron-generated-understated-on-partial-failure`).
 *
 * The partial write is real, not hypothetical: `insertDailyPuzzle` is one
 * autocommitted statement and no transaction spans the loop, so a run that
 * covered offsets 0-2 and then hit a transient Neon error has three durable
 * rows — and `generated: 0` in the response body and in the
 * `{event:"cron-publish"}` log line would be a state that never existed.
 *
 * This changes NOTHING about which errors propagate, which is the whole
 * point of §7.2/C2's propagate-and-isolate design: the original failure is
 * the `cause`, the wrapper is rethrown immediately, and the loop still
 * aborts rather than retrying against a dead database.
 */
export class TopUpAbortedError extends Error {
  constructor(
    readonly partial: Pick<TopUpResult, "generated" | "failures">,
    cause: unknown,
  ) {
    super(`top-up aborted after generating ${partial.generated} row(s)`, {
      cause,
    });
    this.name = "TopUpAbortedError";
  }
}

/**
 * Depth below which the buffer counts as shallow (plan 014 D12). A code
 * constant, not a remote tunable — bufferDepth is the tunable AC 4
 * names; this can become one later if operating shows the need
 * (deliberately not ADR-weight).
 */
export const BUFFER_ALERT_THRESHOLD = 4;

/**
 * The threshold that actually applies: a deliberately tuned-low depth
 * (bufferDepth < 4) must not make every healthy run red forever
 * (plan 014 A3). Shared by the cron status and GET /buffer-depth.
 */
export function effectiveThreshold(configuredDepth: number): number {
  return Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth);
}

// The engine already caps 64 attempts per seed internally; 8 fresh seeds
// on top makes an uncovered date astronomically unlikely without ever
// unbounding the loop.
const MAX_SEED_RETRIES_PER_DATE = 8;

/** Random uint32 via Web Crypto — same entropy source as the session tokens (ADR-0022). */
function randomUint32(): number {
  const box = new Uint32Array(1);
  crypto.getRandomValues(box);
  const value = box[0];
  if (value === undefined) {
    throw new Error("crypto.getRandomValues returned no value");
  }
  return value;
}

/**
 * Idempotent reconciliation (ADR-0010): top the binairo buffer up to
 * `depth` days of coverage starting at the DB clock's SP-today. Vercel
 * crons have no retries, and both missed and duplicate runs are
 * documented behavior — so this reconciles state, never "inserts one
 * more". Existing rows (killed ones included) are never touched (D14).
 *
 * Per date: fresh random seed → generate → re-validate (ADR-0010
 * "pre-generates AND validates" — belt and suspenders) → strict-parse
 * the content contract (fail-closed against shape drift, ADR-0024) →
 * insert with ON CONFLICT DO NOTHING. Retries with a new seed on
 * generation/validation misses; a date that exhausts its budget lands in
 * `failures` and the run continues — it never aborts.
 *
 * PER-GAME BY NAME, and the extension point is now DISCHARGED: #23, #25 and
 * #27 added `topUpSudokuBuffer`, `topUpNonogramBuffer` and
 * `topUpTermoBuffer` alongside this one, each widening the cron/buffer-depth
 * contracts (packages/core/src/contracts/cron.ts) in the same PR. All four
 * M2 games are wired; a fifth would follow the same rule.
 */
export async function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  // Hoisted OUT of the try so a throw can still report them (see
  // `TopUpAbortedError`); the loop below is unchanged.
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "binairo", today));

    // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
    // loop bounds never come from unclamped input.
    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
        // Unreachable by construction, but the engines demand the guard at
        // untyped boundaries (sudoku generate.ts TSDoc duty).
        throw new RangeError(`derived weekday out of range for ${target}`);
      }

      let covered = false;
      let lastReason = "no attempt made";
      for (let attempt = 0; attempt < MAX_SEED_RETRIES_PER_DATE; attempt += 1) {
        const seed = randomUint32();
        let puzzle;
        try {
          puzzle = generateBinairo({ seed, weekday });
        } catch (error) {
          if (error instanceof BinairoGenerationError) {
            lastReason = error.message;
            continue;
          }
          throw error;
        }
        const verdict = validateBinairo(puzzle, weekday);
        if (!verdict.approved) {
          lastReason = `validator rejected: ${verdict.reasons.join(", ")}`;
          continue;
        }
        const content = binairoDailyContentSchema.safeParse(puzzle);
        if (!content.success) {
          // Deterministic shape drift — retrying other seeds cannot fix it.
          // Fail closed for this date; the buffer drains and the alert fires.
          lastReason = `content schema rejected: ${content.error.message}`;
          break;
        }
        const inserted = await insertDailyPuzzle(db, {
          game: "binairo",
          date: target,
          seed,
          content: content.data,
        });
        if (inserted) {
          generated += 1;
        }
        // A lost ON CONFLICT race still means the date is covered.
        covered = true;
        break;
      }
      if (!covered) {
        failures.push({ date: target, reason: lastReason });
      }
    }

    return { generated, depth: await bufferDepth(db, "binairo"), failures };
  } catch (thrown) {
    // The trailing `bufferDepth` read is inside the try on purpose: it can
    // throw AFTER a full week was written, which is the case that most
    // understates the run.
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

/**
 * Per-DATE seed-retry budget for sudoku — deliberately 2, not binairo's 8
 * (plan 018 S13). `SUDOKU_MAX_GENERATION_ATTEMPTS = 1200` at the measured
 * ~1.7 ms/attempt makes ONE exhausted seed ~2 s, so two of them bound a
 * single date at ~4 s. Binairo's 8 is unchanged: its engine caps 64
 * attempts per seed, three orders of magnitude cheaper.
 *
 * Exported so the tests bind to the constant rather than to a copied
 * literal (T-API-S7/T-API-S16).
 */
export const MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2;

/**
 * RUN-scoped seed-retry budget, spent across every uncovered date in ONE
 * invocation. The per-date bound is NOT the run bound: the retry loop is
 * nested inside the per-date loop, so the per-date budget is spent once per
 * uncovered date — without this, a run would be bounded at
 * `depth × ~4 s`, i.e. ~28 s at the default `bufferDepth` of 7 and ~120 s
 * at `remoteConfigSchema`'s clamp ceiling of 30. With it the run is bounded
 * at ~8 s of sudoku CPU by construction, independent of `depth`
 * (plan 018 S13, and the reason `vercel.json` pins `maxDuration`).
 *
 * Residual cap-hit probability is ≈5e-7 per seed (plan 011 §8.1), so a run
 * in which even two dates exhaust is ≈2.5e-13: this is a construction
 * guarantee, not a scenario being designed for. When it is exhausted every
 * remaining uncovered date lands in `failures` and GET /buffer-depth
 * catches the shortfall on its next poll.
 */
export const MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4;

/** Reason recorded for dates skipped once the run budget is gone (plan 018 §7.1). */
const RUN_BUDGET_EXHAUSTED = "run seed-retry budget exhausted";

/**
 * The sudoku sibling of `topUpBinairoBuffer` — a NAMED sibling, not a
 * generic extraction (plan 018 S12). The TSDoc above sanctions per-game by
 * name explicitly, and the abstraction's later consumer did not fit it:
 * Termo draws from a curated word list (ADR-0015), which is not a
 * seed → generate → weekday-validate loop. That claim has since become the
 * TSDoc of a function that EXISTS — see `topUpTermoBuffer` at the bottom of
 * this file and its four structural deltas, of which the load-bearing one is
 * that it has no retry budget at all. #25 corrected the other half of this
 * claim: Nonogram IS that loop
 * (`packages/games/src/nonogram/generate.ts:23-70`) — but its validator takes
 * no external weekday, so `topUpNonogramBuffer` carries an assertion the
 * other two get from their validators.
 *
 * Everything binairo's top-up guarantees holds here identically —
 * idempotent reconciliation against the DB clock's SP-today, rows never
 * touched once written (D14), a fail-closed strict content parse before
 * insert (ADR-0024), ON CONFLICT DO NOTHING, and a run that records
 * failures instead of aborting. The four deltas are the engine calls, the
 * `SudokuGenerationError` branch, `validateSudoku` taking CRITERIA rather
 * than a weekday, and the two retry budgets above.
 */
export async function topUpSudokuBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  // Hoisted OUT of the try so a throw can still report them (see
  // `TopUpAbortedError`); the loop below is unchanged.
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "sudoku", today));
    let runBudget = MAX_SUDOKU_SEED_RETRIES_PER_RUN;

    // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
    // loop bounds never come from unclamped input.
    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      // Covered dates are checked FIRST, so a healthy buffer never spends the
      // run budget and a single hole is always filled.
      if (existing.has(target)) {
        continue;
      }
      if (runBudget <= 0) {
        failures.push({ date: target, reason: RUN_BUDGET_EXHAUSTED });
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
        // Unreachable by construction, but the engines demand the guard at
        // untyped boundaries (sudoku generate.ts TSDoc duty).
        throw new RangeError(`derived weekday out of range for ${target}`);
      }
      // validateSudoku takes CRITERIA, not a weekday; generateDailySudoku
      // does its own lookup, so this is the one place the table is read here.
      const criteria = sudokuCriteriaForWeekday(weekday);

      let covered = false;
      let lastReason = "no attempt made";
      for (
        let attempt = 0;
        attempt < MAX_SUDOKU_SEED_RETRIES_PER_DATE && runBudget > 0;
        attempt += 1
      ) {
        // Every path below either covers the date or spends exactly one unit
        // of the run budget. That exhaustiveness is what makes the ~8 s run
        // bound a property of the code rather than of a probability.
        const seed = randomUint32();
        let puzzle;
        try {
          puzzle = generateDailySudoku({ seed, weekday });
        } catch (error) {
          if (error instanceof SudokuGenerationError) {
            lastReason = error.message;
            runBudget -= 1;
            continue;
          }
          throw error;
        }
        const verdict = validateSudoku(puzzle, criteria);
        if (!verdict.approved) {
          lastReason = `validator rejected: ${verdict.reasons.join(", ")}`;
          runBudget -= 1;
          continue;
        }
        const content = sudokuDailyContentSchema.safeParse(puzzle);
        if (!content.success) {
          // Deterministic shape drift — retrying other seeds cannot fix it.
          // Fail closed for this date; the buffer drains and the alert fires.
          lastReason = `content schema rejected: ${content.error.message}`;
          runBudget -= 1;
          break;
        }
        const inserted = await insertDailyPuzzle(db, {
          game: "sudoku",
          date: target,
          seed,
          content: content.data,
        });
        if (inserted) {
          generated += 1;
        }
        // A lost ON CONFLICT race still means the date is covered.
        covered = true;
        break;
      }
      if (!covered) {
        failures.push({ date: target, reason: lastReason });
      }
    }

    return { generated, depth: await bufferDepth(db, "sudoku"), failures };
  } catch (thrown) {
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

/**
 * Per-DATE seed-retry budget for nonogram — binairo's 8, and NOT sudoku's
 * 2 + a run budget.
 *
 * TWO DIFFERENT COSTS, kept apart because conflating them is how the first
 * version of this comment came out ~2x wrong. Measured on this machine
 * (Node 24.18.1, n=4000/weekday, warm pools):
 *
 * - a whole SUCCESSFUL `generateNonogram` + `validateNonogram` round is
 *   0.023 ms (Mon 5x5) and 0.181 ms (Sun 15x15);
 * - one INTERNAL attempt — what the worst-run model multiplies — is
 *   `generateNonogram`'s own cost when it succeeds first try: 0.012 ms and
 *   **0.094 ms**, which already INCLUDES one `validateNonogram` round.
 *
 * A failing call skips the validator only when the weekday pool is empty
 * (`generate.ts`, the `continue` on an undefined pool entry). On a non-empty
 * pool every internal attempt builds a full puzzle and validates it before
 * failing — which is exactly what the 0.094 ms figure measures, so the
 * arithmetic below is unaffected either way.
 *
 * The worst-run model carries the INNER factor: "exhausting all 8 seeds"
 * means eight `generateNonogram` calls that each FAILED, and a failing call
 * runs `NONOGRAM_MAX_GENERATION_ATTEMPTS = 8` internal attempts before
 * throwing (generate.ts:11, :34-38, :65-69). So the absolute worst run —
 * every date uncovered at `remoteConfigSchema`'s clamp ceiling of 30, every
 * date exhausting all 8 seeds on the most expensive weekday — is
 * 30 dates x 8 seeds x 8 internal attempts x ~0.094 ms = ~181 ms, plus a
 * one-time ~30 ms to build all seven memoized pools: **~210 ms**. Against
 * `maxDuration: 60` s that is 0.35%, and 1.4% even at a 4x-slower runner. A
 * run-scoped budget would bound something already bounded two-plus orders of
 * magnitude below the limit (contrast sudoku's ~2 s per exhausted seed —
 * see `MAX_SUDOKU_SEED_RETRIES_PER_DATE` above).
 *
 * What the retries are NOT: a recovery mechanism. `weekdayPool` is memoized
 * and seed-INDEPENDENT (difficulty.ts:54,69-72), so a `NonogramGenerationError`
 * (an empty pool) reproduces on every fresh seed. They are the cross-engine
 * convention and a tripwire against content drift.
 *
 * A separate constant rather than the module-level `MAX_SEED_RETRIES_PER_DATE`
 * near the top of this file, because that one carries binairo's comment —
 * "the engine already
 * retries 64 attempts per seed internally" — which is FALSE for nonogram
 * (the cap is 8, generate.ts:11). Reusing it would attach a false claim to a
 * correct value. Exported so tests bind to the constant, not to a literal.
 */
export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;

/**
 * The nonogram sibling of `topUpBinairoBuffer` — a NAMED sibling for the same
 * reason the sudoku one is (plan 018 S12, plan 020 §9.1). Everything binairo's
 * top-up guarantees holds here identically: idempotent reconciliation against
 * the DB clock's SP-today, covered dates checked FIRST so a healthy buffer
 * never spends a retry, rows never touched once written (D14), a fresh
 * `randomUint32()` per attempt (never a seed derived from (game, date) —
 * ADR-0024 decision 1: "a derivable seed would make future dailies
 * precomputable"), a fail-closed strict content parse before insert, ON
 * CONFLICT DO NOTHING, and a run that records failures instead of aborting.
 *
 * Three deltas from binairo's loop, and no others:
 *
 * 1. `generateNonogram(seed, weekday)` takes POSITIONAL arguments — no
 *    options object, no `maxAttempts`, no `generateDaily*` wrapper. It is the
 *    odd one out among the three engines at this call site.
 * 2. `validateNonogram(puzzle)` takes ONE argument and returns
 *    `{ok, failures}`, not `{approved, reasons}`.
 * 3. The weekday/size cross-check below, which the other two get from their
 *    validators for free.
 *
 * When the engine adds a field the alarm is the WANTED one: `safeParse` fails
 * → `break` → the date lands in `failures` → every other uncovered date fails
 * identically → nothing is inserted → `bufferDepth` falls one per day →
 * GET /buffer-depth reports `depths.nonogram` below `effectiveThreshold` →
 * `shallow: true` → buffer-alert.yml opens the issue. Nothing bad is ever
 * written; the alarm fires before any row exists.
 */
export async function topUpNonogramBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  // Hoisted OUT of the try so a throw can still report them (see
  // `TopUpAbortedError`); the loop below is unchanged.
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "nonogram", today));

    // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
    // loop bounds never come from unclamped input.
    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
        // Unreachable by construction, but the engines demand the guard at
        // untyped boundaries (sudoku generate.ts TSDoc duty).
        throw new RangeError(`derived weekday out of range for ${target}`);
      }
      const expected = NONOGRAM_WEEKDAY_CRITERIA[weekday];

      let covered = false;
      let lastReason = "no attempt made";
      for (
        let attempt = 0;
        attempt < MAX_NONOGRAM_SEED_RETRIES_PER_DATE;
        attempt += 1
      ) {
        const seed = randomUint32();
        let puzzle;
        try {
          puzzle = generateNonogram(seed, weekday);
        } catch (error) {
          if (error instanceof NonogramGenerationError) {
            lastReason = error.message;
            continue;
          }
          throw error;
        }
        // A TRIPWIRE, not a restoration of ADR-0010's belt and suspenders:
        // `generateNonogram` writes both fields from the same criteria table
        // this reads (`generate.ts`, `NONOGRAM_WEEKDAY_CRITERIA[weekday]` and
        // the puzzle it returns), so it is UNREACHABLE for output
        // this loop generated. It ships anyway because it is the cheapest
        // gate here and the only one that fails closed for the date on drift
        // the validator structurally cannot see — `validateNonogram(puzzle)`
        // takes ONE argument and derives its criteria from `puzzle.weekday`
        // (validate.ts:63-68), so re-validating generator output compares a
        // value against itself. Binairo's and sudoku's validators take the
        // caller's weekday and do cross-check, which is why only nonogram
        // owes this line. `break`, never `continue`: a mismatch is code
        // drift, and every other seed reproduces it.
        if (puzzle.weekday !== weekday || puzzle.size !== expected.size) {
          lastReason =
            `weekday/size cross-check failed: expected weekday ${String(weekday)} ` +
            `size ${String(expected.size)}, got weekday ${String(puzzle.weekday)} ` +
            `size ${String(puzzle.size)}`;
          break;
        }
        const verdict = validateNonogram(puzzle);
        if (!verdict.ok) {
          lastReason = `validator rejected: ${verdict.failures.join(", ")}`;
          continue;
        }
        const content = nonogramDailyContentSchema.safeParse(puzzle);
        if (!content.success) {
          // Deterministic shape drift — retrying other seeds cannot fix it.
          // Fail closed for this date; the buffer drains and the alert fires.
          lastReason = `content schema rejected: ${content.error.message}`;
          break;
        }
        const inserted = await insertDailyPuzzle(db, {
          game: "nonogram",
          date: target,
          seed,
          content: content.data,
        });
        if (inserted) {
          generated += 1;
        }
        // A lost ON CONFLICT race still means the date is covered.
        covered = true;
        break;
      }
      if (!covered) {
        failures.push({ date: target, reason: lastReason });
      }
    }

    return { generated, depth: await bufferDepth(db, "nonogram"), failures };
  } catch (thrown) {
    // The trailing `bufferDepth` read is inside the try on purpose: it can
    // throw AFTER a full week was written, which is the case that most
    // understates the run.
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

/**
 * Remaining-answer count AT OR below which the run logs a warning (ADR-0040
 * decision 7 says "at 30 remaining", so the comparison is `<=`). NOT an alert:
 * the alert channel is buffer depth (ADR-0010) and `buffer-alert.yml`, and
 * this line lands in Vercel logs that nothing polls. It exists because the
 * depth alert gives only ~3 days of runway for THIS failure mode (see
 * `topUpTermoBuffer` delta 4), and 30 remaining is ~30 days. The real fix is
 * issue #74, filed with this PR.
 */
const LOW_ANSWER_POOL_WARNING = 30;

/** The one reason a termo date can go uncovered that is not schema drift. */
const ANSWER_LIST_EXHAUSTED =
  "answer list exhausted: every curated Termo answer is already used";

/**
 * Termination bound on the uniform draw below — NOT a seed-retry budget.
 * `topUpTermoBuffer` has none of those and must never grow one (see its
 * TSDoc). P(one reject) is at most 96/2^32 = 2.24e-8 for n = 400, so
 * P(64 consecutive) is about 1e-491: this throw is unreachable, and it
 * ships because "unreachable" is an argument, not a type.
 */
const MAX_UNIFORM_DRAW_ATTEMPTS = 64;

/**
 * The largest multiple of `maxExclusive` that fits in a uint32 — the accept
 * region's exclusive upper bound. A draw < limit is accepted; anything at or
 * above it is rejected and redrawn.
 *
 * EXPORTED SOLELY SO T-API-S33 CAN BIND TO THE REAL BOUNDARY. Left as a
 * function-local, the only thing a test could do is recompute this
 * expression and assert it equals itself — a tautology that stays green
 * under a change to `randomUint32() % maxExclusive`, which is precisely the
 * implementation ADR-0040 rejects. Exporting it lets the test stub draws of
 * `limit - 1` (accepted), `limit`, `limit + 1` and `2**32 - 1` (all
 * rejected) and assert the DECISION rather than the arithmetic.
 *
 * At `maxExclusive === 1` the limit is 2^32, one past the largest uint32, so
 * the reject region is empty and every draw is accepted. That is correct and
 * is pinned as its own case.
 */
export function uniformDrawLimit(maxExclusive: number): number {
  return Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
}

/**
 * A uniformly distributed index in [0, maxExclusive), plus the uint32 draw
 * that produced it (the value written to `daily_puzzles.seed`).
 *
 * Rejection sampling, not `randomUint32() % maxExclusive`. The bias of the
 * modulo is measurably nothing — 2^32 mod 400 = 96, so the worst residue is
 * 7.08e-8 too likely and the total variation distance from uniform is
 * 1.12e-8 — but rejection makes uniformity a CONSTRUCTION property (every
 * accepted value maps to exactly floor(2^32 / n) uint32s) instead of a claim
 * that has to be defended with those numbers every time someone reads it.
 * ADR-0023 reserves "prove" for exactly that difference. Expected draws:
 * 1.0000000224 at n = 400.
 *
 * NOT `createSeededRandom(...).nextInt(n)` (packages/games/src/random.ts):
 * that is `Math.floor(next() * n)`, the same granularity bias wrapped in a
 * splitmix32 round that adds nothing to CSPRNG output — and it would drag a
 * DETERMINISTIC generator into the one place ADR-0024 decision 1 requires
 * non-determinism.
 *
 * `nextDraw` is an INJECTION SEAM and nothing else; production never passes
 * it. `randomUint32` is a module-local, so `vi.mock` cannot reach it the way
 * this file's engine mocks reach `@miolos/games/*` — the parameter is what
 * lets T-API-S33 assert the accept/reject decision at the real boundary
 * instead of recomputing the arithmetic (plan 022 §19.5).
 */
export function drawUniformIndex(
  maxExclusive: number,
  nextDraw: () => number = randomUint32,
): { index: number; draw: number } {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(
      `maxExclusive must be a positive integer, got ${String(maxExclusive)}`,
    );
  }
  const limit = uniformDrawLimit(maxExclusive);
  for (let attempt = 0; attempt < MAX_UNIFORM_DRAW_ATTEMPTS; attempt += 1) {
    const draw = nextDraw();
    if (draw < limit) {
      return { index: draw % maxExclusive, draw };
    }
  }
  throw new Error(
    `uniform draw did not converge in ${String(MAX_UNIFORM_DRAW_ATTEMPTS)} attempts`,
  );
}

/**
 * The termo sibling of `topUpBinairoBuffer` — the one this file's own TSDoc
 * said would not fit the family's shape, and it does not: "Termo draws from
 * a curated word list (ADR-0015), which is not a seed → generate →
 * weekday-validate loop."
 *
 * Everything binairo's top-up guarantees still holds: idempotent
 * reconciliation against the DB clock's SP-today, covered dates checked
 * FIRST, rows never touched once written (ADR-0024 D14), a fail-closed
 * strict content parse before insert, ON CONFLICT DO NOTHING, and a run that
 * records failures instead of aborting.
 *
 * FOUR STRUCTURAL DELTAS, and no others:
 *
 * 1. NO INNER ATTEMPT LOOP AND NO RETRY BUDGET, and that absence is
 *    load-bearing rather than an omission. There is no generator that can
 *    fail, no validator that can reject and no weekday ramp; the only
 *    non-throwing failure left is deterministic schema drift, which every
 *    sibling `break`s on. A `MAX_TERMO_SEED_RETRIES_PER_DATE` added later
 *    "for symmetry" would guard nothing. `drawUniformIndex`'s 64-attempt cap
 *    is a draw-termination bound, not a retry budget.
 *
 * 2. IT READS STORED `content` BACK — the first top-up in this package that
 *    does. `listUsedTermoAnswers` is the no-repeat rule: 400 answers under
 *    uniform independent picks collide with probability 0.505 inside 24 days
 *    (birthday problem, N = 400), so without it a repeat is the norm rather
 *    than the exception. Do not "harmonise" the read away.
 *
 * 3. THE POOL IS RUN-SCOPED. Built once and spliced on every successful
 *    insert, so two dates in the SAME run cannot draw the same answer — a
 *    collision the used-set read alone would not prevent, because it is
 *    taken before the first write.
 *
 * 4. EXHAUSTION FAILS CLOSED. There is no recycling branch and adding one is
 *    a product decision with its own ADR (ADR-0040 Rejected). When the pool
 *    empties, every remaining uncovered date lands in `failures`, the buffer
 *    drains one day per day, `depths.termo` falls below `effectiveThreshold`
 *    and `buffer-alert.yml` opens the issue — the same chain nonogram's
 *    schema-drift comment describes. Runway is only ~3 days, which is why
 *    `LOW_ANSWER_POOL_WARNING` exists.
 *
 * Measured cost (Node v24.18.1, n = 2000 after 200 warm-up, pool rebuilt
 * every iteration, TERMO_ANSWERS constructed once outside the timed loop
 * exactly as module init does it): a cold week (depth 7, empty buffer) is
 * 0.0193 ms of CPU; depth 7 with 350 used is 0.0338 ms; depth 30 empty is
 * 0.0424 ms; the absolute worst run — depth 30 at remoteConfigSchema's clamp
 * ceiling with 370 answers already used — is 0.0573 ms. Against binairo's
 * ~7 ms this is ~360x cheaper, which is what puts termo FIRST in the cron's
 * cost-ascending order (packages/core/src/contracts/cron.ts).
 *
 * The honest asymmetry, in BOTH its figures because the smaller one reads as
 * the total: a sibling top-up costs THREE run-level Neon round trips
 * (todaySaoPaulo, listBufferedDates, the trailing bufferDepth) plus one per
 * insert; this one costs FOUR, because `listUsedTermoAnswers` is a read no
 * other top-up makes. So it is +1 round trip AGAINST A SIBLING, and +4 at
 * RUN LEVEL — the cron's fixed cost goes from 9 to 13 — against -7 ms of CPU.
 * Cost-ascending orders by GENERATION cost — a CPU overrun must never starve
 * a cheaper game — so termo is first on the rule as written.
 *
 * Determinism is not a property here, and this says so rather than leaving
 * the absence to be read as an oversight: "same seed → same puzzle" is
 * meaningless for termo, because the pick is `crypto.getRandomValues`-driven
 * precisely so that it cannot be reproduced (ADR-0024 decision 1). The
 * invariant that replaces it is "the answer stored is the answer served,
 * forever", and its mechanism is row immutability, not a seed.
 */
export async function topUpTermoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  // Hoisted OUT of the try so a throw can still report them (see
  // `TopUpAbortedError`).
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "termo", today));
    const used = new Set(await listUsedTermoAnswers(db));
    const pool = TERMO_ANSWERS.filter((answer) => !used.has(answer.normalized));

    // `<=`, not `<`: ADR-0040 decision 7 says the warning fires **at 30
    // remaining**, and a strict `<` made a pool of exactly 30 silent — the
    // one value the constant is named for (#27 step-7 finding A-4).
    if (pool.length <= LOW_ANSWER_POOL_WARNING) {
      // Once per RUN, not per date: this is a log line for a human reading
      // Vercel logs, and one per uncovered date would be up to 30 copies of
      // the same sentence.
      console.error(
        JSON.stringify({
          event: "termo-answer-pool-low",
          remaining: pool.length,
          total: TERMO_ANSWERS.length,
        }),
      );
    }

    // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
    // loop bounds never come from unclamped input.
    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      if (pool.length === 0) {
        failures.push({ date: target, reason: ANSWER_LIST_EXHAUSTED });
        continue;
      }
      const { index, draw } = drawUniformIndex(pool.length);
      const answer = pool[index];
      if (answer === undefined) {
        // Unreachable: `index` is in [0, pool.length). The guard exists
        // because noUncheckedIndexedAccess is on (tsconfig.base.json) and a
        // non-null assertion would be a worse way to say the same thing.
        throw new RangeError(`answer pool index ${String(index)} is empty`);
      }
      // The frozen TERMO_ANSWERS element is parsed DIRECTLY, never a rebuilt
      // object: that is what makes a future `TermoAnswer` field addition fail
      // closed here instead of being silently dropped (ADR-0024).
      const content = termoDailyContentSchema.safeParse(answer);
      if (!content.success) {
        // Deterministic shape drift — no other answer can fix it, and there
        // is no retry loop to break out of. Fail closed for this date; every
        // other date fails identically, the buffer drains and the alert
        // fires. No answer is spent: nothing was written.
        failures.push({
          date: target,
          reason: `content schema rejected: ${content.error.message}`,
        });
        continue;
      }
      const inserted = await insertDailyPuzzle(db, {
        game: "termo",
        date: target,
        // Provenance only. This value REPRODUCES NOTHING: the pick is a draw
        // over a run-scoped pool, so replaying it against a different pool
        // yields a different word (ADR-0040 decision 3).
        seed: draw,
        content: content.data,
      });
      if (inserted) {
        generated += 1;
        // Spent only on a real write. A lost ON CONFLICT race means another
        // writer covered the date with ITS answer, so ours was never used and
        // stays eligible.
        pool.splice(index, 1);
      }
    }

    return { generated, depth: await bufferDepth(db, "termo"), failures };
  } catch (thrown) {
    // The trailing `bufferDepth` read is inside the try on purpose: it can
    // throw AFTER a full week was written.
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}
