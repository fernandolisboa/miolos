"use client";

/**
 * The Nonogram free-play generation machine (#28, ADR-0011, ADR-0046).
 * Same shape as `use-free-binairo`; generation is sub-millisecond after
 * the one-time pool build, so the generating state is one frame.
 *
 * THE REVEAL NEVER LEAVES THIS MODULE. `generateNonogram` returns
 * `reveal: {motifId, name, mirrored, solution}` — the motif library
 * legitimately rides the free-play chunk (ADR-0047), but the curated name
 * stays non-user-facing **in free play** (ADR-0033's copy rule as narrowed
 * by ADR-0070 — a narrowing, not a reversal: since #64 the DAILY conclusion
 * names its motif, from the user's own completed `/day` claim over the wire,
 * never from these tables; free play generates infinitely, motifs recur, and
 * there is no day for a server to judge, so it stays unnamed permanently):
 * the parse below keeps only the playable projection `{size, clues}`, and the
 * reducer derives its own solution from the clues (`solutionMarks`), so no
 * screen ever holds `reveal` at all.
 */
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
  /** The playable projection only — `reveal` is dropped at the parse. */
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

/** Test seams only — injected values must be referentially stable. */
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
      // One bounded re-render per generation, deliberately synchronous —
      // see use-free-binairo.ts for the full argument (plan 025 D5.1).
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
