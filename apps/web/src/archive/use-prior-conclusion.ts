"use client";

import type { Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord } from "../play/play-record";

let priorCache:
  | { readonly game: Game; readonly date: string; readonly value: boolean }
  | undefined;

function priorSnapshot(game: Game, date: string): boolean {
  const cached = priorCache;
  if (cached?.game === game && cached.date === date) {
    return cached.value;
  }
  const value = readPlayRecord(game, date)?.concluded === true;
  priorCache = { game, date, value };
  return value;
}

const subscribe = (): (() => void) => () => {
  priorCache = undefined;
};

const serverSnapshot = (): boolean => false;

export function usePriorConclusion(game: Game, date: string): boolean {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => priorSnapshot(game, date), [game, date]),
    serverSnapshot,
  );
}
