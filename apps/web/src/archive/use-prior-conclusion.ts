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
 * **Read once per MOUNT and frozen**, which is the whole contract: after the
 * first client render the archive session's own play can conclude the record,
 * and re-reading would turn a fresh archive win into a false "you already had
 * this". The cache below is what freezes it — `getSnapshot` must return a
 * referentially stable value anyway, so the two requirements are the same
 * requirement — and its teardown is what stops the freeze from outliving the
 * mount and answering a LATER visit with an earlier one's verdict.
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
 * browser has one `localStorage` and one archive page renders at a time.
 *
 * **The slot is scoped to the MOUNT, not to the module**, and that is the
 * whole correctness of it (#31 step-6 finding F4). The hazard here is a key
 * HIT, never a key miss: the natural archive loop is one tap each way — the
 * play screen's back link goes to the day page, whose card links straight
 * back — so a module-lifetime cache keyed `(game, date)` would answer the
 * SECOND mount with the FIRST mount's frozen `false`, and the panel would
 * render "this visit registered a late completion" on a visit that had
 * already concluded the day. `subscribe`'s teardown drops the slot, so
 * "frozen" means frozen for the life of one mount, which is what the
 * contract above says and what the freeze is for.
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

/**
 * Nothing to subscribe to: the answer is frozen for the life of the mount.
 * The teardown is not a formality — it is what bounds "frozen" to this mount
 * rather than to this module (see the cache note above).
 */
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
