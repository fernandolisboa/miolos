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

  readonly elapsedMs: number | undefined;
}

const PENDING: DayEntry = { status: "pending", elapsedMs: undefined };

const NOTHING_DONE: Readonly<Record<Game, DayEntry>> = {
  termo: PENDING,
  sudoku: PENDING,
  nonogram: PENDING,
  binairo: PENDING,
};

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

  const truth = useDayTruth();
  return useMemo(() => applyDayTruth(local, date, truth), [local, date, truth]);
}

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

export { refreshDayTruth as refreshServerDay } from "../day/day-truth";

function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  if (record.game === "termo") {
    return record.outcome === "lost"
      ? { status: "played", elapsedMs: undefined }
      : { status: "completed", elapsedMs: undefined };
  }
  return { status: "completed", elapsedMs: record.elapsedMs };
}

const serverDayState = (): Readonly<Record<Game, DayEntry>> => NOTHING_DONE;

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
