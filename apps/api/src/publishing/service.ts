import {
  binairoDailyContentSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import type { Db } from "@miolos/db";
import type { Game } from "@miolos/core";
import {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  listUsedTermoAnswers,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { isWeekday } from "@miolos/games";
import type { Weekday } from "@miolos/games";
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

function randomUint32(): number {
  const box = new Uint32Array(1);
  crypto.getRandomValues(box);
  const value = box[0];
  if (value === undefined) {
    throw new Error("crypto.getRandomValues returned no value");
  }
  return value;
}

type Insert = (seed: number, content: unknown) => Promise<boolean>;

type CoverDate = (
  target: string,
  insert: Insert,
) => Promise<string | undefined>;

async function topUpBuffer(
  db: Db,
  game: Game,
  depth: number,
  startRun: () => Promise<CoverDate>,
): Promise<TopUpResult> {
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, game, today));
    const coverDate = await startRun();

    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      const insert: Insert = async (seed, content) => {
        const inserted = await insertDailyPuzzle(db, {
          game,
          date: target,
          seed,
          content,
        });
        if (inserted) {
          generated += 1;
        }
        return inserted;
      };
      const reason = await coverDate(target, insert);
      if (reason !== undefined) {
        failures.push({ date: target, reason });
      }
    }

    return { generated, depth: await bufferDepth(db, game), failures };
  } catch (thrown) {
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}

type Attempt =
  | { kind: "content"; content: unknown }
  | { kind: "retry"; reason: string }
  | { kind: "stop"; reason: string };

async function withSeedRetries(
  target: string,
  maxAttempts: number,
  attempt: (seed: number, weekday: Weekday) => Attempt,
  insert: Insert,
): Promise<string | undefined> {
  const weekday = isoWeekdayOf(target);
  if (!isWeekday(weekday)) {
    throw new RangeError(`derived weekday out of range for ${target}`);
  }

  let lastReason = "no attempt made";
  for (let count = 0; count < maxAttempts; count += 1) {
    const seed = randomUint32();
    const outcome = attempt(seed, weekday);
    if (outcome.kind === "content") {
      await insert(seed, outcome.content);
      return undefined;
    }
    lastReason = outcome.reason;
    if (outcome.kind === "stop") {
      break;
    }
  }
  return lastReason;
}

export const MAX_BINAIRO_SEED_RETRIES_PER_DATE = 8;

export async function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpBuffer(db, "binairo", depth, () =>
    Promise.resolve((target, insert) =>
      withSeedRetries(
        target,
        MAX_BINAIRO_SEED_RETRIES_PER_DATE,
        (seed, weekday) => {
          let puzzle;
          try {
            puzzle = generateBinairo({ seed, weekday });
          } catch (error) {
            if (error instanceof BinairoGenerationError) {
              return { kind: "retry", reason: error.message };
            }
            throw error;
          }
          const verdict = validateBinairo(puzzle, weekday);
          if (!verdict.approved) {
            return {
              kind: "retry",
              reason: `validator rejected: ${verdict.reasons.join(", ")}`,
            };
          }
          const content = binairoDailyContentSchema.safeParse(puzzle);
          if (!content.success) {
            return {
              kind: "stop",
              reason: `content schema rejected: ${content.error.message}`,
            };
          }
          return { kind: "content", content: content.data };
        },
        insert,
      ),
    ),
  );
}

export const MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2;

export const MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4;

const RUN_BUDGET_EXHAUSTED = "run seed-retry budget exhausted";

export async function topUpSudokuBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpBuffer(db, "sudoku", depth, () => {
    let runBudget = MAX_SUDOKU_SEED_RETRIES_PER_RUN;
    return Promise.resolve((target, insert) => {
      if (runBudget <= 0) {
        return Promise.resolve(RUN_BUDGET_EXHAUSTED);
      }
      const maxAttempts = Math.min(MAX_SUDOKU_SEED_RETRIES_PER_DATE, runBudget);
      return withSeedRetries(
        target,
        maxAttempts,
        (seed, weekday) => {
          const criteria = sudokuCriteriaForWeekday(weekday);
          let puzzle;
          try {
            puzzle = generateDailySudoku({ seed, weekday });
          } catch (error) {
            if (error instanceof SudokuGenerationError) {
              runBudget -= 1;
              return { kind: "retry", reason: error.message };
            }
            throw error;
          }
          const verdict = validateSudoku(puzzle, criteria);
          if (!verdict.approved) {
            runBudget -= 1;
            return {
              kind: "retry",
              reason: `validator rejected: ${verdict.reasons.join(", ")}`,
            };
          }
          const content = sudokuDailyContentSchema.safeParse(puzzle);
          if (!content.success) {
            runBudget -= 1;
            return {
              kind: "stop",
              reason: `content schema rejected: ${content.error.message}`,
            };
          }
          return { kind: "content", content: content.data };
        },
        insert,
      );
    });
  });
}

export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;

export async function topUpNonogramBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpBuffer(db, "nonogram", depth, () =>
    Promise.resolve((target, insert) =>
      withSeedRetries(
        target,
        MAX_NONOGRAM_SEED_RETRIES_PER_DATE,
        (seed, weekday) => {
          let puzzle;
          try {
            puzzle = generateNonogram(seed, weekday);
          } catch (error) {
            if (error instanceof NonogramGenerationError) {
              return { kind: "retry", reason: error.message };
            }
            throw error;
          }

          const expected = NONOGRAM_WEEKDAY_CRITERIA[weekday];
          if (puzzle.weekday !== weekday || puzzle.size !== expected.size) {
            return {
              kind: "stop",
              reason:
                `weekday/size cross-check failed: expected weekday ${String(weekday)} ` +
                `size ${String(expected.size)}, got weekday ${String(puzzle.weekday)} ` +
                `size ${String(puzzle.size)}`,
            };
          }
          const verdict = validateNonogram(puzzle);
          if (!verdict.ok) {
            return {
              kind: "retry",
              reason: `validator rejected: ${verdict.failures.join(", ")}`,
            };
          }
          const content = nonogramDailyContentSchema.safeParse(puzzle);
          if (!content.success) {
            return {
              kind: "stop",
              reason: `content schema rejected: ${content.error.message}`,
            };
          }
          return { kind: "content", content: content.data };
        },
        insert,
      ),
    ),
  );
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
  return topUpBuffer(db, "termo", depth, async () => {
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

    return async (target, insert) => {
      if (pool.length === 0) {
        return ANSWER_LIST_EXHAUSTED;
      }
      const { index, draw } = drawUniformIndex(pool.length);
      const answer = pool[index];
      if (answer === undefined) {
        throw new RangeError(`answer list index ${String(index)} is empty`);
      }

      const content = termoDailyContentSchema.safeParse(answer);
      if (!content.success) {
        return `content schema rejected: ${content.error.message}`;
      }
      if (await insert(draw, content.data)) {
        pool.splice(index, 1);
      }
      return undefined;
    };
  });
}
