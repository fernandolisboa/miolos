"use client";

import { useCallback, useEffect, useState } from "react";

import { pickSeed, type FreePlayLevel } from "./catalog";

export type FreePhase<TPuzzle> =
  | { readonly kind: "generating" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly run: number; readonly puzzle: TPuzzle };

export interface FreeGame<TGenerate, TPuzzle> {
  readonly generate: TGenerate;
  readonly build: (
    generate: TGenerate,
    draw: () => number,
    level: FreePlayLevel,
  ) => TPuzzle;
}

export interface FreeGenerationDeps<TGenerate> {
  readonly pickSeed?: () => number;
  readonly generate?: TGenerate;
}

export interface FreeGeneration<TPuzzle> {
  readonly phase: FreePhase<TPuzzle>;
  readonly regenerate: () => void;
}

export function useFreeGeneration<TGenerate, TPuzzle>(
  level: FreePlayLevel,
  game: FreeGame<TGenerate, TPuzzle>,
  deps?: FreeGenerationDeps<TGenerate>,
): FreeGeneration<TPuzzle> {
  const [{ build, generate: defaultGenerate }] = useState(game);
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<{
    readonly level: FreePlayLevel;
    readonly run: number;
    readonly phase: FreePhase<TPuzzle>;
  } | null>(null);
  const draw = deps?.pickSeed ?? pickSeed;
  const generate = deps?.generate ?? defaultGenerate;

  useEffect(() => {
    try {
      const puzzle = build(generate, draw, level);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({ level, run, phase: { kind: "ready", run, puzzle } });
    } catch {
      setSettled({ level, run, phase: { kind: "failed" } });
    }
  }, [level, run, build, generate, draw]);

  const regenerate = useCallback(() => {
    setRun((current) => current + 1);
  }, []);

  const phase: FreePhase<TPuzzle> =
    settled !== null && settled.level === level && settled.run === run
      ? settled.phase
      : { kind: "generating" };

  return { phase, regenerate };
}
