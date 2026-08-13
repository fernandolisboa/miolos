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
 * (ADR-0031 consequence (b)). #19 did NOT replace `readDayState`'s body:
 * ADR-0048 amends ADR-0031 decision 5 and defers the server day-truth
 * payload — and this body's replacement — to its own issue (#83). This
 * reader stays the day-state source and the offline fallback the
 * conclusion needs.
 */
import { GAMES, type Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord } from "./play-record";
import { subscribeToPlayRecords } from "./use-record-snapshot";

/**
 * CONTEXT.md's verbs, minus the one a local reader cannot see: a LATE
 * completion is an archive fact the server owns (#31), so this reader has
 * three states, not four.
 *
 * `played` exists because ADR-0008 decision 3 makes a lost Termo *played* and
 * never *completed*: it counts for neither streak nor Dia Perfeito, and it is
 * still visibly finished for the day.
 *
 * MONOTONE SAFETY IS PRESERVED, and the check is worth writing down because
 * ADR-0031 decision 2 is what makes this reader shippable at all. Absence
 * still reads `pending`, so the cold profile, the second device and
 * `impeccable detect` are unchanged. `played` is a WEAKER claim than
 * `completed`, not a stronger one: it publishes no time and enters no count.
 * It drives a chip, a tile shape and a CTA target — the affordances ADR-0031
 * decision 6 permits — and never an entitlement.
 *
 * AN ENUM RATHER THAN A SECOND FLAG, deliberately. A `closed` boolean beside
 * `concluded` would fail SAFE: a consumer that forgot it would read pending.
 * This fails CLOSED: `DayEntry.concluded` ceases to exist, so every consumer
 * is a red typecheck and each one has to decide. That is the same choice
 * `sync.ts`'s `const unhandled: never` and this file's spelled-out
 * `Record<Game, DayEntry>` literal already make.
 */
export type DayStatus = "pending" | "completed" | "played";

export interface DayEntry {
  readonly status: DayStatus;
  /**
   * Only ever set on a `completed` entry, and not on every one of those. A
   * part-played board carries a real `elapsedMs` too, and publishing that as
   * the day's result would put a time on a game nobody finished — which is
   * exactly what a lost Termo is. A WON Termo carries none either: its
   * elapsed time includes every per-guess round trip (ADR-0045 decision 4),
   * so the number is meaningless for that game and is never published. Both
   * consumers therefore branch on `status` and never on this field's
   * presence.
   */
  readonly elapsedMs: number | undefined;
}

const PENDING: DayEntry = { status: "pending", elapsedMs: undefined };

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
 * It is NOT an exhaustiveness tripwire, and calling it one would promise a
 * safety net nobody has: `GAMES` has carried all four games since day one
 * (packages/core/src/game.ts), so #23, #25 and #27 each added no key here.
 * The member they do have to add is `playRecordSchema`'s — that union is
 * where the compile error waits (finding
 * `day-state-exhaustiveness-tripwire-cannot-fire-for-25-27`).
 *
 * What #27 DID change is everything else in this file (ADR-0044 consequence
 * (c)): the entry type, the reader, the counter and the comparator. The map
 * itself is untouched, exactly as the finding above predicted.
 */
export function readDayState(date: string): Readonly<Record<Game, DayEntry>> {
  return {
    termo: entryFor("termo", date),
    sudoku: entryFor("sudoku", date),
    nonogram: entryFor("nonogram", date),
    binairo: entryFor("binairo", date),
  };
}

/**
 * How many of the day's games this device has COMPLETED — never merely
 * played. A lost Termo does not enter "X de 4 concluídos" (ADR-0008
 * decision 4: *"A day containing a lost Termo is not perfect, whatever else
 * happened"*).
 */
export function completedCount(
  state: Readonly<Record<Game, DayEntry>>,
): number {
  return Object.values(state).filter((entry) => entry.status === "completed")
    .length;
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

/**
 * The file's first per-game branch, and it is the narrowest one that can
 * express ADR-0008 decision 3. It is NOT a widening of `readDayState`'s map,
 * which stays total over `Game` and gains no key.
 *
 * `outcome` is READ rather than derived from the tiles because this module is
 * on every route's client graph and must never import a game engine — see the
 * import note in `play-record.ts`. The derivation keeps exactly one
 * definition, in the Termo reducer's `restore`. The honest consequence is
 * ADR-0044 consequence (f): a hand-edited `{concluded: true, outcome: "won"}`
 * on a six-loss board yields `completed` on THIS DEVICE. It is device-local,
 * self-inflicted, and never reaches the wire — the completion body carries
 * the guess words and no verdict.
 *
 * ZERO BEHAVIOUR CHANGE FOR THE THREE SHIPPED GAMES: this returns
 * `"completed"` with the record's `elapsedMs` wherever it returned
 * `concluded: true`, and `"pending"` wherever it returned `PENDING`. The
 * `elapsedMs: undefined` arm is reached only by a termo record.
 */
function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  if (record.game === "termo") {
    // A won Termo publishes no duration either (plan 022 §15.3): the number
    // includes every per-guess round trip and both ADR-0043 and ADR-0045
    // call it meaningless for this game. #29 replaces it with `em 4/6`.
    return record.outcome === "lost"
      ? { status: "played", elapsedMs: undefined }
      : { status: "completed", elapsedMs: undefined };
  }
  return { status: "completed", elapsedMs: record.elapsedMs };
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
      // `status`, not a duration: a won and a lost Termo both carry
      // `elapsedMs: undefined`, so comparing the duration alone would hand
      // every reader a cached `completed` for the rest of the session.
      previous[game].status === next[game].status &&
      previous[game].elapsedMs === next[game].elapsedMs,
  );
}
