"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { dailySudokuResponseSchema, sudokuDigitSchema } from "@miolos/core";
import {
  generateDailySudoku,
  SudokuGenerationError,
  type SudokuPuzzle,
} from "@miolos/games/sudoku";
import { z } from "zod";

import type { SudokuDigit } from "../sudoku/state";
import { FREE_PLAY_DATE, LEVEL_WEEKDAYS, type FreePlayLevel } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export const FREE_PLAY_SUDOKU_SEED_ATTEMPTS = 3;

const solutionSchema = z.array(sudokuDigitSchema).length(81);

export interface FreeSudokuPuzzle {
  readonly seed: number;
  readonly daily: DailySudokuResponse;

  readonly solution: readonly SudokuDigit[];
}

export type FreeSudokuDeps = FreeGenerationDeps<typeof generateDailySudoku>;

const FREE_SUDOKU: FreeGame<typeof generateDailySudoku, FreeSudokuPuzzle> = {
  generate: generateDailySudoku,
  build: (generate, draw, level) => {
    const puzzle = generateWithFreshSeeds(generate, draw, level);
    const daily = dailySudokuResponseSchema.parse({
      game: "sudoku",
      date: FREE_PLAY_DATE,
      givens: puzzle.givens,
      tier: puzzle.tier,
    });
    const solution = solutionSchema.parse(puzzle.solution);

    return { seed: puzzle.seed, daily, solution };
  },
};

export function useFreeSudoku(
  level: FreePlayLevel,
  deps?: FreeSudokuDeps,
): FreeGeneration<FreeSudokuPuzzle> {
  return useFreeGeneration(level, FREE_SUDOKU, deps);
}

function generateWithFreshSeeds(
  generate: typeof generateDailySudoku,
  draw: () => number,
  level: FreePlayLevel,
): SudokuPuzzle {
  for (let attempt = 1; ; attempt += 1) {
    const seed = draw();
    try {
      return generate({ seed, weekday: LEVEL_WEEKDAYS[level] });
    } catch (error) {
      if (
        !(error instanceof SudokuGenerationError) ||
        attempt >= FREE_PLAY_SUDOKU_SEED_ATTEMPTS
      ) {
        throw error;
      }
    }
  }
}
