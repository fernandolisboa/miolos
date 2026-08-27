"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { dailyBinairoResponseSchema } from "@miolos/core";
import { generateBinairo, type BinairoSolvedGrid } from "@miolos/games/binairo";
import { useCallback, useEffect, useState } from "react";

import {
  FREE_PLAY_DATE,
  LEVEL_WEEKDAYS,
  pickSeed,
  type FreePlayLevel,
} from "./catalog";

export interface FreeBinairoPuzzle {
  readonly seed: number;
  readonly daily: DailyBinairoResponse;

  readonly solution: BinairoSolvedGrid;
}

export type FreeBinairoPhase =
  | { readonly kind: "generating" }
  | { readonly kind: "failed" }
  | {
      readonly kind: "ready";
      readonly run: number;
      readonly puzzle: FreeBinairoPuzzle;
    };

export interface FreeBinairoDeps {
  readonly pickSeed?: () => number;
  readonly generate?: typeof generateBinairo;
}

export interface FreeBinairo {
  readonly phase: FreeBinairoPhase;

  readonly regenerate: () => void;
}

export function useFreeBinairo(
  level: FreePlayLevel,
  deps?: FreeBinairoDeps,
): FreeBinairo {
  const [run, setRun] = useState(0);

  const [settled, setSettled] = useState<{
    readonly level: FreePlayLevel;
    readonly run: number;
    readonly phase: FreeBinairoPhase;
  } | null>(null);
  const draw = deps?.pickSeed ?? pickSeed;
  const generate = deps?.generate ?? generateBinairo;

  useEffect(() => {
    try {
      const seed = draw();
      const puzzle = generate({ seed, weekday: LEVEL_WEEKDAYS[level] });
      const daily = dailyBinairoResponseSchema.parse({
        game: "binairo",
        date: FREE_PLAY_DATE,
        size: puzzle.size,
        givens: puzzle.givens,
      });

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({
        level,
        run,
        phase: {
          kind: "ready",
          run,
          puzzle: { seed: puzzle.seed, daily, solution: puzzle.solution },
        },
      });
    } catch {
      setSettled({ level, run, phase: { kind: "failed" } });
    }
  }, [level, run, draw, generate]);

  const regenerate = useCallback(() => {
    setRun((current) => current + 1);
  }, []);

  const phase: FreeBinairoPhase =
    settled !== null && settled.level === level && settled.run === run
      ? settled.phase
      : { kind: "generating" };

  return { phase, regenerate };
}
