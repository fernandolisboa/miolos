"use client";

/**
 * The Sudoku free-play generation machine (ADR-0011, ADR-0046). The
 * same shape as `use-free-binairo`, plus the one thing Sudoku owns: the
 * retry ladder. `generateDailySudoku` retries up to 1200 attempts
 * internally and an exhausted seed costs ~2s of CPU, so on
 * `SudokuGenerationError` — and ONLY that error — the effect draws a fresh
 * seed, up to three, before showing the error card. This is the publishing
 * side's fresh-seed-on-exhaustion precedent moved client-side. Any other
 * throw (a Zod parse rejection included) is an engine-contract regression
 * and surfaces immediately.
 *
 * Generation runs inside the effect, never during render and never on the
 * server: the generating skeleton commits and paints first, then the
 * effect blocks — honest feedback for the heavy tail, one frame for the
 * typical tens of milliseconds. No Web Worker: it would be the
 * repo's first, purchased against a rare, bounded worst case.
 */
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

/** Fresh seeds per generation request before the error card. */
export const FREE_PLAY_SUDOKU_SEED_ATTEMPTS = 3;

/**
 * What narrows the engine's `readonly number[]` solution to the digit
 * union the reducer's `use-hint` takes — one parse per puzzle, the
 * `play/play-record.ts` precedent for `sudokuDigitSchema`.
 */
const solutionSchema = z.array(sudokuDigitSchema).length(81);

export interface FreeSudokuPuzzle {
  readonly seed: number;
  readonly daily: DailySudokuResponse;
  /** Narrowed to the digit union; feeds `use-hint` directly. */
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

/** Test seams only — injected values must be referentially stable. */
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
      // One bounded re-render per generation, deliberately synchronous —
      // see use-free-binairo.ts for the full argument.
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

/** The ladder: only `SudokuGenerationError` buys a fresh seed. */
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
