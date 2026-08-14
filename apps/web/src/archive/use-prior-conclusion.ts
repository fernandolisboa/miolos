"use client";

import type { Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord } from "../play/play-record";

/**
 * Whether this device ALREADY held a concluded record for `(game, date)`
 * when the archive screen first rendered on the client (#31, ADR-0053
 * decision 10 layer 2).
 *
 * It is what lets the late-result panel say "you had already finished this
 * day" instead of claiming a late completion this visit did not produce.
 *
 * **Read once and frozen**, which is the whole contract: after the first
 * client render the archive session's own play can conclude the record, and
 * re-reading would turn a fresh archive win into a false "you already had
 * this". The cache below is what freezes it — `getSnapshot` must return a
 * referentially stable value anyway, so the two requirements are the same
 * requirement.
 *
 * **The ordering is safe rather than lucky.** `getSnapshot` runs during the
 * first render, before ANY effect has run — so it cannot see a write by the
 * shared lifecycle, whose mount effect only reads and dispatches `restore`
 * in any case.
 *
 * The server snapshot is `false`, so the pre-hydration paint never claims a
 * prior conclusion. Nothing renders it before hydration anyway: the screens
 * gate the panel on `state.hydrated`.
 */

/**
 * One slot, for the same reason `use-record-snapshot.ts` keeps one: a
 * browser has one `localStorage` and one archive page renders at a time. A
 * key miss costs a re-read, never a wrong answer.
 */
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

/** Nothing to subscribe to: the answer is frozen at the first client read. */
const subscribe = (): (() => void) => () => {};

const serverSnapshot = (): boolean => false;

export function usePriorConclusion(game: Game, date: string): boolean {
  return useSyncExternalStore(
    subscribe,
    useCallback(() => priorSnapshot(game, date), [game, date]),
    serverSnapshot,
  );
}
