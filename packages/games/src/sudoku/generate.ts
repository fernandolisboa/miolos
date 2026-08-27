import { createSeededRandom } from "../random";
import type { Weekday } from "../weekday";
import { gradeInternal } from "./grade";
import { countSolutionsInternal, fillGrid, shuffleInPlace } from "./solve";
import type {
  SudokuApprovalCriteria,
  SudokuGrid,
  SudokuPuzzle,
  SudokuTier,
} from "./types";
import { sudokuCriteriaForWeekday } from "./criteria";
import { validateCriteria } from "./validate";

export const SUDOKU_MAX_GENERATION_ATTEMPTS = 1200;

export class SudokuGenerationError extends Error {
  readonly seed: number;

  readonly criteria: SudokuApprovalCriteria;

  readonly attempts: number;

  constructor(
    seed: number,
    criteria: SudokuApprovalCriteria,
    attempts: number,
  ) {
    super(
      `No approved Sudoku found for seed ${String(seed)} with criteria ` +
        `{ tier: ${String(criteria.tier)}, minClues: ${String(criteria.minClues)}, ` +
        `maxClues: ${String(criteria.maxClues)} } after ${String(attempts)} attempts`,
    );
    this.name = "SudokuGenerationError";
    this.seed = seed;
    this.criteria = criteria;
    this.attempts = attempts;
  }
}

interface GenerationCandidate {
  readonly givens: SudokuGrid;
  readonly solution: SudokuGrid;
  readonly tier: SudokuTier;
  readonly clueCount: number;
}

function tryGenerate(
  attemptSeed: number,
  criteria: SudokuApprovalCriteria,
): GenerationCandidate | null {
  const rng = createSeededRandom(attemptSeed);
  const solution = fillGrid(rng);
  const order = Array.from({ length: 81 }, (_, i) => i);
  shuffleInPlace(order, rng);
  const grid = [...solution];
  let clues = 81;
  for (const idx of order) {
    if (clues === criteria.minClues) {
      break;
    }
    const removed = grid[idx]!;
    grid[idx] = 0;
    if (countSolutionsInternal(grid, 2) > 1) {
      grid[idx] = removed;
      continue;
    }
    const grade = gradeInternal(grid).grade;
    if (grade === "beyond" || grade > criteria.tier) {
      grid[idx] = removed;
      continue;
    }
    clues -= 1;
  }
  const finalGrade = gradeInternal(grid).grade;
  if (finalGrade !== criteria.tier) {
    return null;
  }
  if (clues < criteria.minClues || clues > criteria.maxClues) {
    return null;
  }
  return {
    givens: Object.freeze(grid),
    solution: Object.freeze(solution),
    tier: finalGrade,
    clueCount: clues,
  };
}

export function generateSudoku(options: {
  readonly seed: number;
  readonly criteria: SudokuApprovalCriteria;
  readonly maxAttempts?: number;
}): SudokuPuzzle {
  const { criteria } = options;
  validateCriteria(criteria);
  const maxAttempts = options.maxAttempts ?? SUDOKU_MAX_GENERATION_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      `maxAttempts must be a positive integer, got ${String(maxAttempts)}`,
    );
  }
  const normalizedSeed = options.seed >>> 0;
  const master = createSeededRandom(normalizedSeed);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptSeed = master.nextInt(0x1_0000_0000);
    const candidate = tryGenerate(attemptSeed, criteria);
    if (candidate !== null) {
      return Object.freeze({ ...candidate, seed: normalizedSeed });
    }
  }
  throw new SudokuGenerationError(normalizedSeed, criteria, maxAttempts);
}

export function generateDailySudoku(options: {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly maxAttempts?: number;
}): SudokuPuzzle {
  return generateSudoku({
    seed: options.seed,
    criteria: sudokuCriteriaForWeekday(options.weekday),
    ...(options.maxAttempts !== undefined
      ? { maxAttempts: options.maxAttempts }
      : {}),
  });
}
