"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { dailySudokuResponseSchema, sudokuDigitSchema } from "@miolos/core";
import {
  SudokuGenerationError,
  type SudokuLayout,
  type SudokuVariant,
  type SudokuVariantPuzzle,
} from "@miolos/games/sudoku";
import { generateSudokuVariant } from "@miolos/games/sudoku-variants";
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

const unitSchema = z
  .array(z.number().int().min(0).max(80))
  .length(9)
  .refine((cells) => new Set(cells).size === 9)
  .readonly();

const layoutSchema = z
  .strictObject({
    regions: z
      .array(z.number().int().min(0).max(8))
      .length(81)
      .refine((regions) =>
        Array.from({ length: 9 }, (_, id) => id).every(
          (id) => regions.filter((region) => region === id).length === 9,
        ),
      )
      .readonly(),
    extraUnits: z.array(unitSchema).max(2).readonly(),
  })
  .readonly();

export interface FreeSudokuInput {
  readonly level: FreePlayLevel;
  readonly variant: SudokuVariant;
}

export interface FreeSudokuPuzzle {
  readonly seed: number;
  readonly daily: DailySudokuResponse;
  readonly layout: SudokuLayout;
  readonly solution: readonly SudokuDigit[];
}

export type FreeSudokuDeps = FreeGenerationDeps<typeof generateSudokuVariant>;

const FREE_SUDOKU: FreeGame<
  typeof generateSudokuVariant,
  FreeSudokuPuzzle,
  FreeSudokuInput
> = {
  generate: generateSudokuVariant,
  build: (generate, draw, input) => {
    const puzzle = generateWithFreshSeeds(generate, draw, input);
    const daily = dailySudokuResponseSchema.parse({
      game: "sudoku",
      date: FREE_PLAY_DATE,
      givens: puzzle.givens,
      tier: puzzle.tier,
    });
    const solution = solutionSchema.parse(puzzle.solution);
    const layout = layoutSchema.parse(puzzle.layout);

    return { seed: puzzle.seed, daily, layout, solution };
  },
};

export function useFreeSudoku(
  input: FreeSudokuInput,
  deps?: FreeSudokuDeps,
): FreeGeneration<FreeSudokuPuzzle> {
  return useFreeGeneration(input, FREE_SUDOKU, deps);
}

function generateWithFreshSeeds(
  generate: typeof generateSudokuVariant,
  draw: () => number,
  { level, variant }: FreeSudokuInput,
): SudokuVariantPuzzle {
  for (let attempt = 1; ; attempt += 1) {
    const seed = draw();
    try {
      return generate({ seed, weekday: LEVEL_WEEKDAYS[level], variant });
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
