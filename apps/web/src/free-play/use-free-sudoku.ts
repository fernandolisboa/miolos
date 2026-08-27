"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { dailySudokuResponseSchema, sudokuDigitSchema } from "@miolos/core";
import {
  generateDailySudoku,
  SudokuGenerationError,
  type SudokuPuzzle,
} from "@miolos/games/sudoku";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import type { SudokuDigit } from "../sudoku/state";
import {
  FREE_PLAY_DATE,
  LEVEL_WEEKDAYS,
  pickSeed,
  type FreePlayLevel,
} from "./catalog";

export const FREE_PLAY_SUDOKU_SEED_ATTEMPTS = 3;

const solutionSchema = z.array(sudokuDigitSchema).length(81);

export interface FreeSudokuPuzzle {
  readonly seed: number;
  readonly daily: DailySudokuResponse;

  readonly solution: readonly SudokuDigit[];
}

export type FreeSudokuPhase =
  | { readonly kind: "generating" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "ready";
      readonly run: number;
      readonly puzzle: FreeSudokuPuzzle;
    };

export interface FreeSudokuDeps {
  readonly pickSeed?: () => number;
  readonly generate?: typeof generateDailySudoku;
}

export interface FreeSudoku {
  readonly phase: FreeSudokuPhase;
  readonly regenerate: () => void;
}

export function useFreeSudoku(
  level: FreePlayLevel,
  deps?: FreeSudokuDeps,
): FreeSudoku {
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<{
    readonly level: FreePlayLevel;
    readonly run: number;
    readonly phase: FreeSudokuPhase;
  } | null>(null);
  const draw = deps?.pickSeed ?? pickSeed;
  const generate = deps?.generate ?? generateDailySudoku;

  useEffect(() => {
    try {
      const puzzle = generateWithFreshSeeds(generate, draw, level);
      const daily = dailySudokuResponseSchema.parse({
        game: "sudoku",
        date: FREE_PLAY_DATE,
        givens: puzzle.givens,
        tier: puzzle.tier,
      });
      const solution = solutionSchema.parse(puzzle.solution);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({
        level,
        run,
        phase: {
          kind: "ready",
          run,
          puzzle: { seed: puzzle.seed, daily, solution },
        },
      });
    } catch {
      setSettled({ level, run, phase: { kind: "failed" } });
    }
  }, [level, run, draw, generate]);

  const regenerate = useCallback(() => {
    setRun((current) => current + 1);
  }, []);

  const phase: FreeSudokuPhase =
    settled !== null && settled.level === level && settled.run === run
      ? settled.phase
      : { kind: "generating" };

  return { phase, regenerate };
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
