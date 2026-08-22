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

/** What every per-game top-up returns. */
export interface TopUpResult {
  generated: number;
  depth: number;
  failures: { date: string; reason: string }[];
}

/**
 * A top-up that wrote rows and THEN threw, carrying the counters that would
 * otherwise die with the rejected promise: `insertDailyPuzzle` is one
 * autocommitted statement with no transaction spanning the loop, so a run
 * that fails partway still has durable rows, and `generated: 0` would
 * describe a state that never existed. Rethrown immediately with the
 * original failure as `cause`.
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
 * Depth below which the buffer counts as shallow. A code constant, not a
 * remote tunable — `bufferDepth` is the tunable.
 */
export const BUFFER_ALERT_THRESHOLD = 4;

/**
 * The threshold that actually applies: a deliberately tuned-low depth
 * (`bufferDepth` < 4) must not make every healthy run red forever. Shared
 * by the cron status and GET /buffer-depth.
 */
export function effectiveThreshold(configuredDepth: number): number {
  return Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth);
}

// The engine already caps 64 attempts per seed internally; 8 fresh seeds
// on top makes an uncovered date astronomically unlikely without ever
// unbounding the loop.
const MAX_SEED_RETRIES_PER_DATE = 8;

/** Random uint32 via Web Crypto — see ADR-0022. */
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
 * Idempotent reconciliation: top the binairo buffer up to `depth` days of
 * coverage from the DB clock's SP-today. Vercel crons have no retries and
 * both missed and duplicate runs are documented behavior, so this
 * reconciles state rather than "inserting one more"; existing rows (killed
 * ones included) are never touched.
 *
 * Per date: fresh seed → generate → re-validate → strict-parse the content
 * contract → insert with ON CONFLICT DO NOTHING, retrying with a new seed
 * on a miss. A date that exhausts its budget lands in `failures` and the
 * run continues.
 *
 * Per-game by name, not a generic abstraction — a fifth game would follow
 * the same shape. `topUpSudokuBuffer`, `topUpNonogramBuffer` and
 * `topUpTermoBuffer` below share this contract; each doc states only its
 * delta from it.
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
 * Per-DATE seed-retry budget for sudoku — deliberately 2, not binairo's 8:
 * sudoku runs 1200 internal attempts per seed against binairo's 64, each
 * attempt costlier, so
 * bounding one date's total time needs far fewer retries here.
 *
 * Exported so the tests bind to the constant rather than to a copied
 * literal.
 */
export const MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2;

/**
 * RUN-scoped seed-retry budget, spent across every uncovered date in ONE
 * invocation — not the per-date bound. Without a run-level cap the total
 * run time would scale with `depth`; with this budget the run is bounded
 * independent of `depth`, which is why `vercel.json` pins `maxDuration: 60`
 * against it. The measured basis, recorded here because nothing else in the
 * repo holds it: ~1.7 ms per sudoku attempt, so an exhausted seed costs ~2 s
 * and this budget bounds a run at ~8 s. When it is exhausted every remaining uncovered date lands in
 * `failures`, and GET /buffer-depth catches the shortfall on its next poll.
 */
export const MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4;

/** Reason recorded for dates skipped once the run budget is gone. */
const RUN_BUDGET_EXHAUSTED = "run seed-retry budget exhausted";

/**
 * The sudoku sibling of `topUpBinairoBuffer` — a named sibling, not a
 * generic extraction: Termo draws from a curated word list (ADR-0015),
 * which is not a seed → generate → weekday-validate loop, and nonogram's
 * validator takes no external weekday, so `topUpNonogramBuffer` carries an
 * assertion the other two get from their validators.
 *
 * Same contract as `topUpBinairoBuffer` above. Deltas: the engine calls,
 * the `SudokuGenerationError` branch, `validateSudoku` taking CRITERIA
 * rather than a weekday, and the two retry budgets above.
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
        // of the run budget. That exhaustiveness is what makes the run
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
 * Per-DATE seed-retry budget for nonogram — binairo's 8, not sudoku's 2 +
 * a run budget: nonogram's generation cost is cheap enough that a
 * run-level cap would bound something already far below `maxDuration`.
 *
 * Not a recovery mechanism: `weekdayPool` is memoized and seed-independent,
 * so a `NonogramGenerationError` (an empty pool) reproduces on every fresh
 * seed. This is a tripwire against content drift, exported so tests bind to
 * the constant rather than a literal.
 */
export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;

/**
 * The nonogram sibling of `topUpBinairoBuffer` — same contract, four
 * deltas: `generateNonogram(seed, weekday)` takes positional arguments, not
 * an options object; `validateNonogram(puzzle)` returns `{ok, failures}`
 * from one argument; a fresh `randomUint32()` per attempt (never a seed
 * derived from (game, date), which would make future dailies
 * precomputable); and the weekday/size cross-check below, which the other
 * two get from their validators for free.
 *
 * That cross-check is a tripwire, not belt-and-suspenders: on a real
 * schema-drift mismatch it `break`s, the date lands in `failures`, the
 * buffer drains one day per day, and `buffer-alert.yml` opens the issue
 * before any bad row is ever written.
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
        // TRIPWIRE: `validateNonogram(puzzle)` derives its criteria from
        // `puzzle.weekday`, so re-validating generator output only compares
        // a value against itself. This is the one check that actually
        // catches drift. `break`, not `continue`: a mismatch is code drift,
        // and every other seed reproduces it identically.
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
 * Remaining-answer count AT OR below which the run logs a warning (`<=`,
 * not `<`: the threshold itself must trip it). NOT an alert: the alert
 * channel is buffer depth and `buffer-alert.yml`, and this line lands in
 * Vercel logs that nothing polls. It exists because the depth alert gives
 * only ~3 days of runway for this failure mode.
 *
 * TODO(#74): a real alert for a low Termo answer pool.
 */
const LOW_ANSWER_POOL_WARNING = 30;

/** The one reason a termo date can go uncovered that is not schema drift. */
const ANSWER_LIST_EXHAUSTED =
  "answer list exhausted: every curated Termo answer is already used";

/**
 * Termination bound on the uniform draw below — NOT a seed-retry budget.
 * `topUpTermoBuffer` has none of those and must never grow one. The reject
 * region is small enough that this throw is unreachable in practice, and it
 * ships because "unreachable" is an argument, not a type.
 */
const MAX_UNIFORM_DRAW_ATTEMPTS = 64;

/**
 * The largest multiple of `maxExclusive` that fits in a uint32 — the accept
 * region's exclusive upper bound. A draw < limit is accepted; anything at
 * or above it is rejected and redrawn.
 *
 * Exported so a test can bind to the real boundary and stub draws of
 * `limit - 1`, `limit`, `limit + 1` and `2**32 - 1` — asserting the
 * accept/reject decision itself, not a recomputed (and tautological) copy
 * of this expression.
 *
 * At `maxExclusive === 1` the limit is 2^32 — one past the largest uint32 —
 * so the reject region is empty and every draw is accepted; that edge case
 * is pinned on its own.
 */
export function uniformDrawLimit(maxExclusive: number): number {
  return Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
}

/**
 * A uniformly distributed index in [0, maxExclusive), plus the uint32 draw
 * that produced it (the value written to `daily_puzzles.seed`).
 *
 * Rejection sampling, not `randomUint32() % maxExclusive`: the modulo's
 * bias is small, but rejection makes uniformity a CONSTRUCTION property —
 * every accepted value maps to exactly `floor(2^32 / n)` uint32s — rather
 * than a claim that needs a bias calculation to defend.
 *
 * NOT `createSeededRandom(...).nextInt(n)` (packages/games/src/random.ts):
 * that wraps the same bias in a splitmix32 round that adds nothing to
 * CSPRNG output, and would drag a deterministic generator into the one
 * place that requires non-determinism.
 *
 * `nextDraw` is an injection seam only; production never passes it.
 * `randomUint32` is module-local, so `vi.mock` can't reach it the way this
 * file's engine mocks reach `@miolos/games/*` — the parameter is what lets
 * a test assert the real accept/reject boundary instead of recomputing the
 * arithmetic.
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
 * The termo sibling of `topUpBinairoBuffer`. Termo draws from a curated
 * word list rather than a seed → generate → weekday-validate loop, so it
 * shares the family's contract — idempotent reconciliation, covered dates
 * checked FIRST, rows never touched once written, fail-closed strict
 * content parse, ON CONFLICT DO NOTHING, failures recorded instead of
 * aborting — only partially. Four structural deltas, and no others
 * (ADR-0040):
 *
 * 1. NO INNER RETRY LOOP AND NO RETRY BUDGET. There is no generator to
 *    fail and no validator to reject, so the only non-throwing failure is
 *    deterministic schema drift, which `break`s here exactly as it does in
 *    every sibling. Do not add one "for symmetry" — it would guard
 *    nothing. `drawUniformIndex`'s 64-attempt cap is a draw-termination
 *    bound, not a retry budget.
 * 2. READS STORED `content` BACK, the first top-up here that does:
 *    `listUsedTermoAnswers` enforces no-repeat, because a repeat is the
 *    norm rather than the exception under naive picking over a finite
 *    pool (the birthday problem — ADR-0040). Do not "harmonise" the read
 *    away.
 * 3. THE POOL IS RUN-SCOPED, built once and spliced on every successful
 *    insert, so two dates in the SAME run can't draw the same answer — a
 *    collision the used-set read alone would miss, since it is taken
 *    before the first write.
 * 4. EXHAUSTION FAILS CLOSED, with no recycling branch. When the pool
 *    empties, every remaining uncovered date lands in `failures`, the
 *    buffer drains one day per day, and `buffer-alert.yml` opens the
 *    issue. `LOW_ANSWER_POOL_WARNING` exists because that runway is only
 *    ~3 days.
 *
 * Determinism is not a property here: the pick is
 * `crypto.getRandomValues`-driven precisely so it can't be reproduced.
 * What replaces "same seed → same puzzle" is "the answer stored is the
 * answer served, forever" — row immutability, not a seed.
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

    // `<=`, not `<`: the warning must fire AT 30 remaining, and a strict `<`
    // would make a pool of exactly 30 silent.
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
        // yields a different word.
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
