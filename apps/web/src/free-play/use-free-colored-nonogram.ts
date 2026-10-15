"use client";

import { generateColoredNonogram } from "@miolos/games/colored-nonogram";

import type { ColoredNonogramBoard } from "../colored-nonogram/state";
import { FREE_PLAY_DATE, type FreePlayLevel } from "./catalog";
import { LEVEL_SIZES } from "./nonogram-free-shell";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeColoredNonogramPuzzle extends ColoredNonogramBoard {
  readonly seed: number;
}

const FREE_COLORED_NONOGRAM: FreeGame<
  typeof generateColoredNonogram,
  FreeColoredNonogramPuzzle
> = {
  generate: generateColoredNonogram,
  build: (generate, draw, level) => {
    const size = LEVEL_SIZES[level];
    const puzzle = generate(draw(), size);
    return {
      seed: puzzle.seed,
      date: FREE_PLAY_DATE,
      size,
      clues: puzzle.clues,
      solution: puzzle.solution,
    };
  },
};

export function useFreeColoredNonogram(
  level: FreePlayLevel,
  deps?: FreeGenerationDeps<typeof generateColoredNonogram>,
): FreeGeneration<FreeColoredNonogramPuzzle> {
  return useFreeGeneration(level, FREE_COLORED_NONOGRAM, deps);
}
