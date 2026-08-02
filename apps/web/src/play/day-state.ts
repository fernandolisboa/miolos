/**
 * What THIS DEVICE knows about a given day (ADR-0031, plan 018 §11.2).
 *
 * Device state, not user state: it is read from the local play records, so
 * it does NOT widen ADR-0014's direct-read scope — nothing here is a
 * user-specific fragment fetched from a server on a public page.
 *
 * MONOTONE-SAFE BY CONSTRUCTION, and that is the whole point: a concluded
 * record proves this device solved that game on that date; absence proves
 * nothing and reads as pending — which is also the cold-profile default,
 * also what `impeccable detect` always scans, and also what a second device
 * sees. A false `pending` is invisible to the player; a false `done` would
 * not be. It can therefore never back a streak, a medal or a statistic
 * (ADR-0031 consequence (b)); #19 replaces `readDayState`'s BODY with the
 * server payload and its callers do not change, keeping this reader as the
 * offline fallback the conclusion needs.
 */
import { GAMES, type Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord } from "./play-record";
import { subscribeToPlayRecords } from "./use-record-snapshot";

export interface DayEntry {
  readonly concluded: boolean;
  /**
   * Only ever set on a concluded entry. A part-played board carries a real
   * `elapsedMs` too, and publishing that as the day's result would put a
   * time on a game nobody finished.
   */
  readonly elapsedMs: number | undefined;
}

const PENDING: DayEntry = { concluded: false, elapsedMs: undefined };

/**
 * Every game reads pending. It is both the honest cold-profile answer and
 * the pre-hydration one (below), so the first paint of the hub and of the
 * conclusion's day card is a legitimate value rather than a placeholder.
 */
const NOTHING_DONE: Readonly<Record<Game, DayEntry>> = {
  termo: PENDING,
  sudoku: PENDING,
  nonogram: PENDING,
  binairo: PENDING,
};

/**
 * This device's day state for the SERVER's `date` — never a client-computed
 * today (CONTEXT.md "Rollover").
 *
 * Spelled out game by game rather than folded over `GAMES` so the return
 * type keeps the map TOTAL over `Game`: a key dropped from this literal does
 * not compile, which is what makes a missing tile impossible.
 *
 * It is NOT a tripwire for #27, and calling it one would promise a
 * safety net nobody has: `GAMES` has carried all four games since day one
 * (packages/core/src/game.ts), so that ticket adds no key here and nothing
 * in this file can go red for it — as #23 and #25 already demonstrated. `entryFor` is game-generic and already
 * serves them. The member they do have to add is `playRecordSchema`'s — that
 * union is where the compile error waits (finding
 * `day-state-exhaustiveness-tripwire-cannot-fire-for-25-27`).
 */
export function readDayState(date: string): Readonly<Record<Game, DayEntry>> {
  return {
    termo: entryFor("termo", date),
    sudoku: entryFor("sudoku", date),
    nonogram: entryFor("nonogram", date),
    binairo: entryFor("binairo", date),
  };
}

/** How many of the day's games this device has finished. */
export function doneCount(state: Readonly<Record<Game, DayEntry>>): number {
  return Object.values(state).filter((entry) => entry.concluded).length;
}

/**
 * `readDayState`, subscribed to the same store the record snapshot polls
 * (plan 018 §11.2) — one mechanism, so a completion settled by `sync.ts`
 * cannot reach one reader and not the other.
 *
 * The server snapshot is `NOTHING_DONE`, which is what makes the
 * pre-hydration paint free AND correct: React renders both the server
 * markup and the hydrating client render from `getServerSnapshot`, so the
 * two agree by construction and the store is consulted only afterwards.
 * Hydration can then only ever ADD a done tile — the monotone direction.
 *
 * `localStorage` IS read during render, inside `getSnapshot`, which is the
 * store contract and not an accident; what never happens is a read from a
 * component body or an effect racing the paint (plan 017 D28). No component
 * reads the clock either — a duration comes from the record.
 */
export function useDayState(date: string): Readonly<Record<Game, DayEntry>> {
  return useSyncExternalStore(
    subscribeToPlayRecords,
    useCallback(() => dayStateSnapshot(date), [date]),
    serverDayState,
  );
}

function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  return { concluded: true, elapsedMs: record.elapsedMs };
}

const serverDayState = (): Readonly<Record<Game, DayEntry>> => NOTHING_DONE;

/**
 * The same cache `use-record-snapshot.ts` keeps, for the same reason:
 * `getSnapshot` must return a referentially stable value or
 * `useSyncExternalStore` loops forever, and `readDayState` builds a fresh
 * object on every call. Keyed on the date, because that is this
 * projection's whole key — it already spans every game.
 */
let cachedDayState:
  | { readonly date: string; readonly state: Readonly<Record<Game, DayEntry>> }
  | undefined;

function dayStateSnapshot(date: string): Readonly<Record<Game, DayEntry>> {
  const next = readDayState(date);
  const cached = cachedDayState;
  if (cached?.date === date && sameDayState(cached.state, next)) {
    return cached.state;
  }
  cachedDayState = { date, state: next };
  return next;
}

/**
 * Iterated over `GAMES` rather than `Object.entries`, which widens its keys
 * to `string` and would need a cast to read them back out of a
 * `Record<Game, …>`.
 */
function sameDayState(
  previous: Readonly<Record<Game, DayEntry>>,
  next: Readonly<Record<Game, DayEntry>>,
): boolean {
  return GAMES.every(
    (game) =>
      previous[game].concluded === next[game].concluded &&
      previous[game].elapsedMs === next[game].elapsedMs,
  );
}
