"use client";

import type { DailyNonogramResponse } from "@miolos/core";
import { dailyNonogramResponseSchema } from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
import { useCallback, useEffect, useState } from "react";

import {
  FREE_PLAY_DATE,
  LEVEL_WEEKDAYS,
  pickSeed,
  type FreePlayLevel,
} from "./catalog";

export interface FreeNonogramPuzzle {
  readonly seed: number;

  readonly daily: DailyNonogramResponse;
}

export type FreeNonogramPhase =
  | { readonly kind: "generating" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "ready";
      readonly run: number;
      readonly puzzle: FreeNonogramPuzzle;
    };

export interface FreeNonogramDeps {
  readonly pickSeed?: () => number;
  readonly generate?: typeof generateNonogram;
}

export interface FreeNonogram {
  readonly phase: FreeNonogramPhase;
  readonly regenerate: () => void;
}

export function useFreeNonogram(
  level: FreePlayLevel,
  deps?: FreeNonogramDeps,
): FreeNonogram {
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<{
    readonly level: FreePlayLevel;
    readonly run: number;
    readonly phase: FreeNonogramPhase;
  } | null>(null);
  const draw = deps?.pickSeed ?? pickSeed;
  const generate = deps?.generate ?? generateNonogram;

  useEffect(() => {
    try {
      const seed = draw();
      const puzzle = generate(seed, LEVEL_WEEKDAYS[level]);
      const daily = dailyNonogramResponseSchema.parse({
        game: "nonogram",
        date: FREE_PLAY_DATE,
        size: puzzle.size,
        clues: puzzle.clues,
      });

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({
        level,
        run,
        phase: { kind: "ready", run, puzzle: { seed: puzzle.seed, daily } },
      });
    } catch {
      setSettled({ level, run, phase: { kind: "failed" } });
    }
  }, [level, run, draw, generate]);

  const regenerate = useCallback(() => {
    setRun((current) => current + 1);
  }, []);

  const phase: FreeNonogramPhase =
    settled !== null && settled.level === level && settled.run === run
      ? settled.phase
      : { kind: "generating" };

  return { phase, regenerate };
}
