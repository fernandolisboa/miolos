import {
  binairoDailyContentSchema,
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
 * EXTENSION POINT: per-game by name on purpose — #23/#25/#27 add their
 * own top-up alongside and widen the cron/buffer-depth contracts
 * (packages/core/src/contracts/cron.ts) in the same PR.
 */
export async function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  const today = await todaySaoPaulo(db);
  const existing = new Set(await listBufferedDates(db, "binairo", today));
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];

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
 * name explicitly, and the abstraction's later consumers would not fit it:
 * Nonogram draws from a curated motif library (ADR-0021) and Termo from a
 * curated word list (ADR-0015), neither of which is a
 * seed → generate → weekday-validate loop.
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
  const today = await todaySaoPaulo(db);
  const existing = new Set(await listBufferedDates(db, "sudoku", today));
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
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
}
