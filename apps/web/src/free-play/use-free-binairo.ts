"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { dailyBinairoResponseSchema } from "@miolos/core";
import { generateBinairo, type BinairoSolvedGrid } from "@miolos/games/binairo";

import { FREE_PLAY_DATE, LEVEL_WEEKDAYS, type FreePlayLevel } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeBinairoPuzzle {
  readonly seed: number;
  readonly daily: DailyBinairoResponse;

  readonly solution: BinairoSolvedGrid;
}

export type FreeBinairoDeps = FreeGenerationDeps<typeof generateBinairo>;

const FREE_BINAIRO: FreeGame<typeof generateBinairo, FreeBinairoPuzzle> = {
  generate: generateBinairo,
  build: (generate, draw, level) => {
    const puzzle = generate({ seed: draw(), weekday: LEVEL_WEEKDAYS[level] });
    const daily = dailyBinairoResponseSchema.parse({
      game: "binairo",
      date: FREE_PLAY_DATE,
      size: puzzle.size,
      givens: puzzle.givens,
    });

    return { seed: puzzle.seed, daily, solution: puzzle.solution };
  },
};

export function useFreeBinairo(
  level: FreePlayLevel,
  deps?: FreeBinairoDeps,
): FreeGeneration<FreeBinairoPuzzle> {
  return useFreeGeneration(level, FREE_BINAIRO, deps);
}
