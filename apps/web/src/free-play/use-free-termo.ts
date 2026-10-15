"use client";

import { deriveBoardStatus, evaluateGuess } from "@miolos/games/termo";
import { drawFreeTermoWord } from "@miolos/games/termo-free";
import { useCallback } from "react";

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
  readonly canonical: string;
}

export type FreeTermoDeps = FreeGenerationDeps<typeof drawFreeTermoWord>;

const FREE_TERMO: FreeGame<typeof drawFreeTermoWord, FreeTermoPuzzle, null> = {
  generate: drawFreeTermoWord,
  build: (generate, draw) => {
    const seed = draw();
    return { seed, canonical: generate(seed) };
  },
};

export function useFreeTermo(
  deps?: FreeTermoDeps,
): FreeGeneration<FreeTermoPuzzle> {
  return useFreeGeneration(null, FREE_TERMO, deps);
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
  return useTermoBoard(FREE_PLAY_DATE, judge).play;
}
