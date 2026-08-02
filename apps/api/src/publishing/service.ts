import {
  binairoDailyContentSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
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
 * EXTENSION POINT: per-game by name on purpose — #23 and #25 added
 * `topUpSudokuBuffer` and `topUpNonogramBuffer` alongside this one, and #27
 * adds termo's, each widening the cron/buffer-depth contracts
 * (packages/core/src/contracts/cron.ts) in the same PR.
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
 * name explicitly, and the abstraction's later consumer would not fit it:
 * Termo draws from a curated word list (ADR-0015), which is not a
 * seed → generate → weekday-validate loop. #25 corrected the other half of
 * this claim: Nonogram IS that loop
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
 *   **0.094 ms**. A FAILING call never reaches `validateNonogram` at all.
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
        // this reads (generate.ts:31,:44-52), so it is UNREACHABLE for output
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
