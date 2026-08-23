import {
  GAMES,
  mergeDayState,
  type DayGameState,
  type DayGameStatus,
  type DayResponse,
  type Game,
} from "@miolos/core";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useDayTruth } from "../day/day-truth";
import { readPlayRecord } from "./play-record";
import { subscribeToPlayRecords } from "./use-record-snapshot";

export type DayStatus = DayGameStatus;

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

const NOTHING_DONE: Readonly<Record<Game, DayEntry>> = {
  termo: PENDING,
  sudoku: PENDING,
  nonogram: PENDING,
  binairo: PENDING,
};

/**
 * The day state for the SERVER's `date` — never a client-computed today
 * (CONTEXT.md "Rollover").
 *
 * `server` is the payload `GET /day` answered with, and `undefined` means
 * NO SERVER TRUTH, FOR ANY REASON — unfetched, in flight, env unset, 401,
 * offline, malformed. In that case this is exactly the local projection.
 *
 * Spelled out game by game rather than folded over `GAMES` so the return
 * type keeps the map TOTAL over `Game`: a key dropped from this literal does
 * not compile, which is what makes a missing tile impossible.
 */
export function readDayState(
  date: string,
  server?: DayResponse,
): Readonly<Record<Game, DayEntry>> {
  return applyDayTruth(
    {
      termo: entryFor("termo", date),
      sudoku: entryFor("sudoku", date),
      nonogram: entryFor("nonogram", date),
      binairo: entryFor("binairo", date),
    },
    date,
    server,
  );
}

/**
 * The merge, and THE DATE PRECONDITION THAT GUARDS IT (ADR-0060 decision 3).
 *
 * THE PAYLOAD IS DISCARDED IN FULL unless `server.date === date`. A payload
 * for another day is not weaker evidence — it is evidence about a DIFFERENT
 * QUESTION, and merging it across the São Paulo rollover would paint
 * yesterday's dones onto today's tiles. The two dates really can disagree:
 * `date` comes off the WEB SERVER's clock (`app/page.tsx`) and the payload's
 * off the DB's, so they differ for seconds across midnight.
 *
 * `date` is resolved once, by the server component, and is frozen for the
 * tab's lifetime; across a real São Paulo midnight on an already-open tab
 * the payload's date moves to D+1 and never returns to D, so no later fetch
 * matches and a cross-device *Feito* that was on screen before midnight
 * reads *Jogar hoje* until the tab navigates or reloads. That tab is showing
 * yesterday either way, and the local reader keeps its own dones, so the
 * direction is still understating and never overstating.
 *
 * The identity of `local` is handed back untouched when the merge changes
 * nothing, so an unchanged payload and unchanged records re-render nothing.
 */
function applyDayTruth(
  local: Readonly<Record<Game, DayEntry>>,
  date: string,
  server: DayResponse | undefined,
): Readonly<Record<Game, DayEntry>> {
  if (server === undefined || server.date !== date) {
    return local;
  }
  const merged = mergeDayState(
    {
      termo: local.termo.status,
      sudoku: local.sudoku.status,
      nonogram: local.nonogram.status,
      binairo: local.binairo.status,
    },
    {
      termo: server.games.termo.status,
      sudoku: server.games.sudoku.status,
      nonogram: server.games.nonogram.status,
      binairo: server.games.binairo.status,
    },
  );
  const next: Readonly<Record<Game, DayEntry>> = {
    termo: entryFromMerge(local.termo, merged.termo, server.games.termo),
    sudoku: entryFromMerge(local.sudoku, merged.sudoku, server.games.sudoku),
    nonogram: entryFromMerge(
      local.nonogram,
      merged.nonogram,
      server.games.nonogram,
    ),
    binairo: entryFromMerge(
      local.binairo,
      merged.binairo,
      server.games.binairo,
    ),
  };
  return GAMES.every((game) => next[game] === local[game]) ? local : next;
}

/**
 * One game's merged entry. `status` is `mergeDayState`'s answer and the
 * duration follows the side that answer came from: the server's wherever it
 * claimed (`claim.status !== "pending"`, the same condition the merge turned
 * on), the local record's where it did not. The local entry is returned by
 * IDENTITY when nothing moved, field for field, so an agreeing payload
 * re-renders nothing.
 */
function entryFromMerge(
  local: DayEntry,
  status: DayStatus,
  claim: DayGameState,
): DayEntry {
  const elapsedMs =
    claim.status === "pending"
      ? local.elapsedMs
      : status === "completed"
        ? claim.elapsedMs
        : undefined;
  return status === local.status && elapsedMs === local.elapsedMs
    ? local
    : { status, elapsedMs };
}

export function completedCount(
  state: Readonly<Record<Game, DayEntry>>,
): number {
  return Object.values(state).filter((entry) => entry.status === "completed")
    .length;
}

export function useDayState(date: string): Readonly<Record<Game, DayEntry>> {
  const local = useSyncExternalStore(
    subscribeToPlayRecords,
    useCallback(() => dayStateSnapshot(date), [date]),
    serverDayState,
  );
  // NO ARGUMENT, deliberately (see `day/day-truth.ts`): one module-level
  // slot serves one "today" payload, and the date filter lives below where
  // the rendered day is already a parameter.
  const truth = useDayTruth();
  return useMemo(() => applyDayTruth(local, date, truth), [local, date, truth]);
}

/**
 * The SERVER's claim about one game of the rendered day. A payload for
 * another day is evidence about a different question, and `pending` is the
 * ABSENCE of a claim rather than a denial, so both answer `undefined`
 * (ADR-0060 decision 3).
 */
export function useServerDayClaim(
  date: string,
  game: Game,
): DayGameState | undefined {
  const truth = useDayTruth();
  if (truth === undefined || truth.date !== date) {
    return undefined;
  }
  const claim = truth.games[game];
  return claim.status === "pending" ? undefined : claim;
}

/**
 * Re-exported rather than imported at the call site: ADR-0060 consequence (d)
 * makes this module the single importer of `src/day/**`, pinned by
 * `T-WEB-S244`.
 */
export { refreshDayTruth as refreshServerDay } from "../day/day-truth";

/**
 * `outcome` is READ rather than derived from the tiles because this module is
 * on every daily route's client graph and must never import a game engine — see the
 * import note in `play-record.ts`. The derivation keeps exactly one
 * definition, in the Termo reducer's `restore`. The honest consequence is
 * ADR-0044 consequence (f): a hand-edited `{concluded: true, outcome: "won"}`
 * on a six-loss board yields `completed` on THIS DEVICE. It is device-local,
 * self-inflicted, and never reaches the wire — the completion body carries
 * the guess words and no verdict.
 */
function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  if (record.game === "termo") {
    // A won Termo publishes no duration either: the number includes every
    // per-guess round trip, which ADR-0045 decision 4 declines to publish.
    return record.outcome === "lost"
      ? { status: "played", elapsedMs: undefined }
      : { status: "completed", elapsedMs: undefined };
  }
  return { status: "completed", elapsedMs: record.elapsedMs };
}

/**
 * The REACT SSR snapshot — "the server" here is the rendering server, not the
 * API, which is why the API's answer is spelled `dayTruth`
 * (`src/day/day-truth.ts`) and this is not.
 */
const serverDayState = (): Readonly<Record<Game, DayEntry>> => NOTHING_DONE;

/**
 * A cache for the reason every `getSnapshot` needs one: it must return a
 * referentially stable value or `useSyncExternalStore` loops forever, and
 * `readDayState` builds a fresh object on every call. Keyed on the date,
 * because that is this projection's whole key — it already spans every game.
 *
 * A SINGLE DATE-KEYED SLOT, where `use-record-snapshot.ts` keys a
 * staleness-swept `Map` (see ADR-0056): two day-states for different dates in
 * one session would evict each other, which is unreachable today because the
 * hub renders one date. A surface that mounts two owes the same repair here.
 */
let cachedDayState:
  | { readonly date: string; readonly state: Readonly<Record<Game, DayEntry>> }
  | undefined;

function dayStateSnapshot(date: string): Readonly<Record<Game, DayEntry>> {
  // ONE ARGUMENT on purpose: this is the record store's snapshot, so it is
  // the LOCAL projection only. `useDayState` merges the payload in
  // afterwards, which keeps this cache keyed on the records alone and out of
  // the payload's refresh cycle.
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
      previous[game].status === next[game].status &&
      previous[game].elapsedMs === next[game].elapsedMs,
  );
}
