"use client";

import {
  deriveBoardStatus,
  evaluateGuess,
  TERMO_VARIANTS,
  type TermoVariant,
} from "@miolos/games/termo";
import { drawFreeTermoWords } from "@miolos/games/termo-free";
import { useCallback } from "react";

import { freeTermoPlayReducer } from "../termo/state";
import type {
  TermoJudge,
  TermoPlay,
  TermoPlayState,
  TermoVerdict,
} from "../termo/types";
import { useTermoBoard } from "../termo/use-termo-board";
import { FREE_PLAY_DATE } from "./catalog";
import {
  useFreeGeneration,
  type FreeGame,
  type FreeGeneration,
  type FreeGenerationDeps,
} from "./use-free-generation";

export interface FreeTermoPuzzle {
  readonly seed: number;
  readonly words: readonly string[];
}

export type FreeTermoDeps = FreeGenerationDeps<typeof drawFreeTermoWords>;

const FREE_TERMO: FreeGame<
  typeof drawFreeTermoWords,
  FreeTermoPuzzle,
  TermoVariant
> = {
  generate: drawFreeTermoWords,
  build: (generate, draw, variant) => {
    const seed = draw();
    return { seed, words: generate(seed, TERMO_VARIANTS[variant].boards) };
  },
};

export function useFreeTermo(
  variant: TermoVariant,
  deps?: FreeTermoDeps,
): FreeGeneration<FreeTermoPuzzle> {
  return useFreeGeneration(variant, FREE_TERMO, deps);
}

export function judgeFreeGuess(
  armed: TermoPlayState,
  guess: string,
  canonical: string,
): TermoVerdict {
  const tiles = evaluateGuess(guess, canonical);
  const status = deriveBoardStatus([
    ...armed.guesses.map((row) => row.tiles),
    tiles,
  ]);
  return {
    type: "judged",
    guess,
    tiles,
    status,
    answer: status === "playing" ? undefined : canonical,
  };
}

export function useFreeTermoBoard(canonical: string): TermoPlay {
  const judge = useCallback<TermoJudge>(
    (armed, guess) => judgeFreeGuess(armed, guess, canonical),
    [canonical],
  );
  return useTermoBoard(FREE_PLAY_DATE, judge, freeTermoPlayReducer).play;
}
