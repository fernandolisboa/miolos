"use client";

import {
  projectCrossword,
  type CrosswordSize,
  type DailyCrosswordResponse,
} from "@miolos/core";
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
  CrosswordSize
> = {
  generate: generateCrossword,
  build: (generate, draw, size) => {
    const puzzle = generate(draw(), size);

    return {
      seed: puzzle.seed,
      daily: projectCrossword(FREE_PLAY_DATE, puzzle, size),
    };
  },
};

export function useFreeCrossword(
  size: CrosswordSize,
  deps?: FreeCrosswordDeps,
): FreeGeneration<FreeCrosswordPuzzle> {
  return useFreeGeneration(size, FREE_CROSSWORD, deps);
}
