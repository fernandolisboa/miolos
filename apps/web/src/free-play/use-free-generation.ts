"use client";

import { useCallback, useEffect, useState } from "react";

import { pickSeed, type FreePlayLevel } from "./catalog";

export type FreePhase<TPuzzle> =
  | { readonly kind: "generating" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly run: number; readonly puzzle: TPuzzle };

export interface FreeGame<TGenerate, TPuzzle, TInput = FreePlayLevel> {
  readonly generate: TGenerate;
  readonly build: (
    generate: TGenerate,
    draw: () => number,
    input: TInput,
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

export function useFreeGeneration<TInput, TGenerate, TPuzzle>(
  input: TInput,
  game: FreeGame<TGenerate, TPuzzle, TInput>,
  deps?: FreeGenerationDeps<TGenerate>,
): FreeGeneration<TPuzzle> {
  const [{ build, generate: defaultGenerate }] = useState(game);
  const [run, setRun] = useState(0);
  const [settled, setSettled] = useState<{
    readonly input: TInput;
    readonly run: number;
    readonly phase: FreePhase<TPuzzle>;
  } | null>(null);
  const draw = deps?.pickSeed ?? pickSeed;
  const generate = deps?.generate ?? defaultGenerate;

  useEffect(() => {
    try {
      const puzzle = build(generate, draw, input);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({ input, run, phase: { kind: "ready", run, puzzle } });
    } catch {
      setSettled({ input, run, phase: { kind: "failed" } });
    }
  }, [input, run, build, generate, draw]);

  const regenerate = useCallback(() => {
    setRun((current) => current + 1);
  }, []);

  const phase: FreePhase<TPuzzle> =
    settled !== null && settled.input === input && settled.run === run
      ? settled.phase
      : { kind: "generating" };

  return { phase, regenerate };
}
