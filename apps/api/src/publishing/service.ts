import {
  binairoDailyContentSchema,
  crosswordDailyContentSchema,
  minesweeperDailyContentSchema,
  nonogramDailyContentSchema,
  queensDailyContentSchema,
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
  CrosswordGenerationError,
  generateCrossword,
  validateCrossword,
} from "@miolos/games/crossword";
import {
  generateMinesweeperDaily,
  MinesweeperGenerationError,
  validateMinesweeperDaily,
} from "@miolos/games/minesweeper";
import {
  generateNonogram,
  NONOGRAM_WEEKDAY_CRITERIA,
  NonogramGenerationError,
  validateNonogram,
} from "@miolos/games/nonogram";
import {
  generateQueens,
  QueensGenerationError,
  validateQueens,
} from "@miolos/games/queens";
import {
  generateDailySudoku,
  SudokuGenerationError,
  sudokuCriteriaForWeekday,
  validateSudoku,
} from "@miolos/games/sudoku";
import { TERMO_ANSWERS, type TermoAnswer } from "@miolos/games/termo-answers";

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
  startRun: () => CoverDate | Promise<CoverDate>,
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

type Rejection = Exclude<Attempt, { kind: "content" }>;

interface ContentSchema {
  safeParse(
    puzzle: unknown,
  ):
    | { success: true; data: unknown }
    | { success: false; error: { message: string } };
}

function validatorRejection(
  failures: readonly string[],
): Rejection | undefined {
  return failures.length === 0
    ? undefined
    : { kind: "retry", reason: `validator rejected: ${failures.join(", ")}` };
}

function okRejection(
  verdict:
    | { readonly ok: true }
    | { readonly ok: false; readonly failures: readonly string[] },
): Rejection | undefined {
  return validatorRejection(verdict.ok ? [] : verdict.failures);
}

function seededAttempt<P>(
  generate: () => P,
  generationError: abstract new (...args: never[]) => Error,
  rejection: (puzzle: P) => Rejection | undefined,
  schema: ContentSchema,
): Attempt {
  let puzzle: P;
  try {
    puzzle = generate();
  } catch (error) {
    if (error instanceof generationError) {
      return { kind: "retry", reason: error.message };
    }
    throw error;
  }
  const rejected = rejection(puzzle);
  if (rejected !== undefined) {
    return rejected;
  }
  const content = schema.safeParse(puzzle);
  if (!content.success) {
    return {
      kind: "stop",
      reason: `content schema rejected: ${content.error.message}`,
    };
  }
  return { kind: "content", content: content.data };
}

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

function topUpWithSeedRetries(
  db: Db,
  game: Game,
  depth: number,
  maxAttemptsPerDate: number,
  attempt: (seed: number, weekday: Weekday) => Attempt,
): Promise<TopUpResult> {
  return topUpBuffer(
    db,
    game,
    depth,
    () => (target, insert) =>
      withSeedRetries(target, maxAttemptsPerDate, attempt, insert),
  );
}

export const MAX_BINAIRO_SEED_RETRIES_PER_DATE = 8;

function attemptBinairo(seed: number, weekday: Weekday): Attempt {
  return seededAttempt(
    () => generateBinairo({ seed, weekday }),
    BinairoGenerationError,
    (puzzle) => {
      const verdict = validateBinairo(puzzle, weekday);
      return validatorRejection(verdict.approved ? [] : verdict.reasons);
    },
    binairoDailyContentSchema,
  );
}

export function topUpBinairoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpWithSeedRetries(
    db,
    "binairo",
    depth,
    MAX_BINAIRO_SEED_RETRIES_PER_DATE,
    attemptBinairo,
  );
}

export const MAX_SUDOKU_SEED_RETRIES_PER_DATE = 2;

export const MAX_SUDOKU_SEED_RETRIES_PER_RUN = 4;

const RUN_BUDGET_EXHAUSTED = "run seed-retry budget exhausted";

function attemptSudoku(seed: number, weekday: Weekday): Attempt {
  return seededAttempt(
    () => generateDailySudoku({ seed, weekday }),
    SudokuGenerationError,
    (puzzle) => {
      const verdict = validateSudoku(puzzle, sudokuCriteriaForWeekday(weekday));
      return validatorRejection(verdict.approved ? [] : verdict.reasons);
    },
    sudokuDailyContentSchema,
  );
}

export async function topUpSudokuBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpBuffer(db, "sudoku", depth, () => {
    let runBudget = MAX_SUDOKU_SEED_RETRIES_PER_RUN;
    const chargedAttempt = (seed: number, weekday: Weekday): Attempt => {
      const outcome = attemptSudoku(seed, weekday);
      if (outcome.kind !== "content") {
        runBudget -= 1;
      }
      return outcome;
    };
    return (target, insert) =>
      runBudget <= 0
        ? Promise.resolve(RUN_BUDGET_EXHAUSTED)
        : withSeedRetries(
            target,
            Math.min(MAX_SUDOKU_SEED_RETRIES_PER_DATE, runBudget),
            chargedAttempt,
            insert,
          );
  });
}

export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;

function nonogramCrossCheck(
  puzzle: ReturnType<typeof generateNonogram>,
  weekday: Weekday,
): Rejection | undefined {
  const expected = NONOGRAM_WEEKDAY_CRITERIA[weekday];
  if (puzzle.weekday === weekday && puzzle.size === expected.size) {
    return undefined;
  }
  return {
    kind: "stop",
    reason:
      `weekday/size cross-check failed: expected weekday ${String(weekday)} ` +
      `size ${String(expected.size)}, got weekday ${String(puzzle.weekday)} ` +
      `size ${String(puzzle.size)}`,
  };
}

function attemptNonogram(seed: number, weekday: Weekday): Attempt {
  return seededAttempt(
    () => generateNonogram(seed, weekday),
    NonogramGenerationError,
    (puzzle) =>
      nonogramCrossCheck(puzzle, weekday) ??
      okRejection(validateNonogram(puzzle)),
    nonogramDailyContentSchema,
  );
}

export function topUpNonogramBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpWithSeedRetries(
    db,
    "nonogram",
    depth,
    MAX_NONOGRAM_SEED_RETRIES_PER_DATE,
    attemptNonogram,
  );
}

export const MAX_CROSSWORD_SEED_RETRIES_PER_DATE = 8;

const CROSSWORD_GENERATION_SIZE = 7;

function attemptCrossword(seed: number): Attempt {
  return seededAttempt(
    () => generateCrossword(seed, CROSSWORD_GENERATION_SIZE),
    CrosswordGenerationError,
    (puzzle) => okRejection(validateCrossword(puzzle)),
    crosswordDailyContentSchema,
  );
}

export function topUpCrosswordBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpWithSeedRetries(
    db,
    "crossword",
    depth,
    MAX_CROSSWORD_SEED_RETRIES_PER_DATE,
    attemptCrossword,
  );
}

export const MAX_QUEENS_SEED_RETRIES_PER_DATE = 8;

function attemptQueens(seed: number, weekday: Weekday): Attempt {
  return seededAttempt(
    () => generateQueens({ seed, weekday }),
    QueensGenerationError,
    (puzzle) => okRejection(validateQueens(puzzle)),
    queensDailyContentSchema,
  );
}

export function topUpQueensBuffer(db: Db, depth: number): Promise<TopUpResult> {
  return topUpWithSeedRetries(
    db,
    "queens",
    depth,
    MAX_QUEENS_SEED_RETRIES_PER_DATE,
    attemptQueens,
  );
}

export const MAX_MINESWEEPER_SEED_RETRIES_PER_DATE = 8;

function attemptMinesweeper(seed: number, weekday: Weekday): Attempt {
  return seededAttempt(
    () => generateMinesweeperDaily({ seed, weekday }),
    MinesweeperGenerationError,
    (puzzle) => okRejection(validateMinesweeperDaily(puzzle)),
    minesweeperDailyContentSchema,
  );
}

export function topUpMinesweeperBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  return topUpWithSeedRetries(
    db,
    "minesweeper",
    depth,
    MAX_MINESWEEPER_SEED_RETRIES_PER_DATE,
    attemptMinesweeper,
  );
}

const LOW_ANSWER_LIST_WARNING = 30;

export async function unusedTermoAnswers(db: Db): Promise<TermoAnswer[]> {
  const used = new Set(await listUsedTermoAnswers(db));
  return TERMO_ANSWERS.filter((answer) => !used.has(answer.normalized));
}

export function isTermoAnswerListLow(remaining: number): boolean {
  return remaining <= LOW_ANSWER_LIST_WARNING;
}

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
    const pool = await unusedTermoAnswers(db);

    if (isTermoAnswerListLow(pool.length)) {
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

export type TopUp = (db: Db, depth: number) => Promise<TopUpResult>;

export const TOP_UPS: Record<Game, TopUp> = {
  binairo: topUpBinairoBuffer,
  sudoku: topUpSudokuBuffer,
  nonogram: topUpNonogramBuffer,
  termo: topUpTermoBuffer,
  crossword: topUpCrosswordBuffer,
  queens: topUpQueensBuffer,
  minesweeper: topUpMinesweeperBuffer,
};
