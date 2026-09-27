"use client";

import type { DailyNonogramResponse } from "@miolos/core";
import { dailyNonogramResponseSchema } from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";

import { FREE_PLAY_DATE, LEVEL_WEEKDAYS, type FreePlayLevel } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeNonogramPuzzle {
  readonly seed: number;

  readonly daily: DailyNonogramResponse;
}

export type FreeNonogramDeps = FreeGenerationDeps<typeof generateNonogram>;

const FREE_NONOGRAM: FreeGame<typeof generateNonogram, FreeNonogramPuzzle> = {
  generate: generateNonogram,
  build: (generate, draw, level) => {
    const puzzle = generate(draw(), LEVEL_WEEKDAYS[level]);
    const daily = dailyNonogramResponseSchema.parse({
      game: "nonogram",
      date: FREE_PLAY_DATE,
      size: puzzle.size,
      clues: puzzle.clues,
    });

    return { seed: puzzle.seed, daily };
  },
};

export function useFreeNonogram(
  level: FreePlayLevel,
  deps?: FreeNonogramDeps,
): FreeGeneration<FreeNonogramPuzzle> {
  return useFreeGeneration(level, FREE_NONOGRAM, deps);
}
