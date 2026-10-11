"use client";

import type { DailyQueensResponse } from "@miolos/core";
import { dailyQueensResponseSchema } from "@miolos/core";
import { generateQueens } from "@miolos/games/queens";

import { FREE_PLAY_DATE, LEVEL_WEEKDAYS, type FreePlayLevel } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeQueensPuzzle {
  readonly seed: number;
  readonly daily: DailyQueensResponse;
}

export type FreeQueensDeps = FreeGenerationDeps<typeof generateQueens>;

const FREE_QUEENS: FreeGame<typeof generateQueens, FreeQueensPuzzle> = {
  generate: generateQueens,
  build: (generate, draw, level) => {
    const puzzle = generate({ seed: draw(), weekday: LEVEL_WEEKDAYS[level] });
    const daily = dailyQueensResponseSchema.parse({
      game: "queens",
      date: FREE_PLAY_DATE,
      size: puzzle.size,
      regions: puzzle.regions,
    });

    return { seed: puzzle.seed, daily };
  },
};

export function useFreeQueens(
  level: FreePlayLevel,
  deps?: FreeQueensDeps,
): FreeGeneration<FreeQueensPuzzle> {
  return useFreeGeneration(level, FREE_QUEENS, deps);
}
