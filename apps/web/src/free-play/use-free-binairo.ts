"use client";

/**
 * The Binairo free-play generation machine (ADR-0011, ADR-0046). One
 * job: seed → puzzle, in the browser, inside an effect — never during
 * render and never on the server (the seed is random, so SSR and hydration
 * would disagree; the same nothing-during-render discipline). The board
 * state itself lives
 * in the screen's inner board component, keyed on `{seed, level, run}` so
 * "Mais um" and level switches remount and re-init the daily reducer
 * cleanly.
 *
 * The generator output crosses into the daily-shaped reducer layer through
 * ONE `dailyBinairoResponseSchema.parse` — the "Zod at every boundary"
 * gate, and what narrows the readonly engine arrays to the mutable
 * response shape for free. The parse cannot reject for a correct engine
 * (the schema asserts exactly what ADR-0023's property tests prove); if it
 * ever throws, that is an engine-contract regression and it surfaces as
 * the error card rather than being re-rolled.
 */
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
  /** The normalized uint32 the puzzle came from — part of the board key. */
  readonly seed: number;
  readonly daily: DailyBinairoResponse;
  /** Feeds `use-hint` directly — no solver call needed. */
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

/**
 * Test seams only: the screens pass nothing and get the real generator and
 * the CSPRNG. Injected values must be referentially stable — they sit in
 * the generation effect's dependency array.
 */
export interface FreeBinairoDeps {
  readonly pickSeed?: () => number;
  readonly generate?: typeof generateBinairo;
}

export interface FreeBinairo {
  readonly phase: FreeBinairoPhase;
  /** Fresh seed at the current level — "Mais um" and "Tentar de novo" both. */
  readonly regenerate: () => void;
}

export function useFreeBinairo(
  level: FreePlayLevel,
  deps?: FreeBinairoDeps,
): FreeBinairo {
  const [run, setRun] = useState(0);
  // Tagged with the {level, run} it answered, so a stale result renders as
  // "generating" during the one commit between a change and its effect —
  // the skeleton paints first, then the effect swaps the board in.
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
      // The synchronous setState is the effect's whole product, and the
      // "cascade" is one bounded re-render per generation: the skeleton
      // commits, the effect generates, the board swaps in — generation may
      // not run during render, or SSR and hydration would disagree on a
      // random seed. Deferring it a tick would buy nothing
      // and cost every test its synchronous session.
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
      // BinairoGenerationError is unreachable in practice (64 internal
      // attempts over a validated ramp) but typed; a parse throw is an
      // engine-contract regression. Both surface, neither is re-rolled.
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
