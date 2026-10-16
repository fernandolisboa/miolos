"use client";

import { generateColoredNonogram } from "@miolos/games/colored-nonogram";

import type { ColoredNonogramBoard } from "../colored-nonogram/state";
import {
  FREE_PLAY_DATE,
  NONOGRAM_LEVEL_SIZES,
  type FreePlayLevel,
} from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeColoredNonogramPuzzle extends ColoredNonogramBoard {
  readonly seed: number;
  readonly tones: string;
}

const FREE_COLORED_NONOGRAM: FreeGame<
  typeof generateColoredNonogram,
  FreeColoredNonogramPuzzle
> = {
  generate: generateColoredNonogram,
  build: (generate, draw, level) => {
    const puzzle = generate(draw(), NONOGRAM_LEVEL_SIZES[level]);
    return {
      seed: puzzle.seed,
      date: FREE_PLAY_DATE,
      clues: puzzle.clues,
      solution: puzzle.solution,
      tones: puzzle.tones,
    };
  },
};

export function useFreeColoredNonogram(
  level: FreePlayLevel,
  deps?: FreeGenerationDeps<typeof generateColoredNonogram>,
): FreeGeneration<FreeColoredNonogramPuzzle> {
  return useFreeGeneration(level, FREE_COLORED_NONOGRAM, deps);
}
