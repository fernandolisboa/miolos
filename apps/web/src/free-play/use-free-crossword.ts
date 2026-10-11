"use client";

import type { DailyCrosswordResponse } from "@miolos/core";
import { projectCrosswordDaily } from "@miolos/core";
import { generateCrossword } from "@miolos/games/crossword";

import { FREE_PLAY_DATE } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeCrosswordPuzzle {
  readonly seed: number;
  readonly daily: DailyCrosswordResponse;
}

export type FreeCrosswordDeps = FreeGenerationDeps<typeof generateCrossword>;

const FREE_CROSSWORD: FreeGame<
  typeof generateCrossword,
  FreeCrosswordPuzzle,
  null
> = {
  generate: generateCrossword,
  build: (generate, draw) => {
    const puzzle = generate(draw());

    return {
      seed: puzzle.seed,
      daily: projectCrosswordDaily(FREE_PLAY_DATE, puzzle),
    };
  },
};

export function useFreeCrossword(
  deps?: FreeCrosswordDeps,
): FreeGeneration<FreeCrosswordPuzzle> {
  return useFreeGeneration(null, FREE_CROSSWORD, deps);
}
