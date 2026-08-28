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

export interface TopUpResult {
  generated: number;
  depth: number;
  failures: { date: string; reason: string }[];
}

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

export const BUFFER_ALERT_THRESHOLD = 4;

export function effectiveThreshold(configuredDepth: number): number {
  return Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth);
}

const MAX_SEED_RETRIES_PER_DATE = 8;

function randomUint32(): number {
  const box = new Uint32Array(1);
  crypto.getRandomValues(box);
  const value = box[0];
  if (value === undefined) {
    throw new Error("crypto.getRandomValues returned no value");
  }
  return value;
}

export async function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "binairo", today));

    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
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

        covered = true;
        break;
      }
      if (!covered) {
        failures.push({ date: target, reason: lastReason });
      }
    }

    return { generated, depth: await bufferDepth(db, "binairo"), failures };
  } catch (thrown) {
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

export const MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2;

export const MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4;

const RUN_BUDGET_EXHAUSTED = "run seed-retry budget exhausted";

export async function topUpSudokuBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "sudoku", today));
    let runBudget = MAX_SUDOKU_SEED_RETRIES_PER_RUN;

    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);

      if (existing.has(target)) {
        continue;
      }
      if (runBudget <= 0) {
        failures.push({ date: target, reason: RUN_BUDGET_EXHAUSTED });
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
        throw new RangeError(`derived weekday out of range for ${target}`);
      }

      const criteria = sudokuCriteriaForWeekday(weekday);

      let covered = false;
      let lastReason = "no attempt made";
      for (
        let attempt = 0;
        attempt < MAX_SUDOKU_SEED_RETRIES_PER_DATE && runBudget > 0;
        attempt += 1
      ) {
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

export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;

export async function topUpNonogramBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "nonogram", today));

    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      const weekday = isoWeekdayOf(target);
      if (!isWeekday(weekday)) {
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

        covered = true;
        break;
      }
      if (!covered) {
        failures.push({ date: target, reason: lastReason });
      }
    }

    return { generated, depth: await bufferDepth(db, "nonogram"), failures };
  } catch (thrown) {
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

// TODO(#74): a real alert for a low Termo answer pool.
const LOW_ANSWER_POOL_WARNING = 30;

const ANSWER_LIST_EXHAUSTED =
  "answer list exhausted: every curated Termo answer is already used";

const MAX_UNIFORM_DRAW_ATTEMPTS = 64;

export function uniformDrawLimit(maxExclusive: number): number {
  return Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
}

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

export async function topUpTermoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "termo", today));
    const used = new Set(await listUsedTermoAnswers(db));
    const pool = TERMO_ANSWERS.filter((answer) => !used.has(answer.normalized));

    if (pool.length <= LOW_ANSWER_POOL_WARNING) {
      console.error(
        JSON.stringify({
          event: "termo-answer-pool-low",
          remaining: pool.length,
          total: TERMO_ANSWERS.length,
        }),
      );
    }

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
        throw new RangeError(`answer list index ${String(index)} is empty`);
      }

      const content = termoDailyContentSchema.safeParse(answer);
      if (!content.success) {
        failures.push({
          date: target,
          reason: `content schema rejected: ${content.error.message}`,
        });
        continue;
      }
      const inserted = await insertDailyPuzzle(db, {
        game: "termo",
        date: target,

        seed: draw,
        content: content.data,
      });
      if (inserted) {
        generated += 1;

        pool.splice(index, 1);
      }
    }

    return { generated, depth: await bufferDepth(db, "termo"), failures };
  } catch (thrown) {
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}
