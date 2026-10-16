import type { DailyMinesweeperResponse } from "@miolos/core";
import {
  minesweeperField,
  startMinesweeper,
  type MinesweeperMark,
  type MinesweeperState,
} from "@miolos/games/minesweeper";

import {
  recordHeader,
  type MinesweeperPlayRecord,
  type PlayRecord,
} from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { LifecycleAction, PlayCore } from "../play/types";
import { moveMinesweeper, type MinesweeperMove } from "./state";

export interface MinesweeperDailyState extends PlayCore {
  readonly game: MinesweeperState;
}

export type MinesweeperDailyAction = LifecycleAction | MinesweeperMove;

type Entry = MinesweeperPlayRecord["entries"][number];

const MARK_OF: Readonly<Record<Entry, MinesweeperMark>> = {
  0: null,
  1: null,
  2: "flag",
  3: "question",
};

export function initMinesweeperDaily(
  daily: DailyMinesweeperResponse,
): MinesweeperDailyState {
  const field = minesweeperField(
    daily.rows,
    daily.columns,
    daily.mines.map((cell) => cell === 1),
  );
  return {
    date: daily.date,
    game: startMinesweeper(field, daily.start),
    timer: { accumulatedMs: 0, runningSince: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

function statusOf(game: MinesweeperState): PlayCore["status"] {
  switch (game.status) {
    case "won":
      return "solved";
    case "lost":
      return "lost";
    default:
      return "playing";
  }
}

function restored(
  state: MinesweeperDailyState,
  record: PlayRecord | undefined,
  now: number,
): MinesweeperDailyState {
  if (record?.game !== "minesweeper") {
    return { ...state, now, hydrated: true };
  }
  const hit = record.hit ?? null;
  const game: MinesweeperState = {
    ...state.game,
    open: record.entries.map((entry) => entry === 1),
    marks: record.entries.map((entry) => MARK_OF[entry]),
    status: hit !== null ? "lost" : record.concluded ? "won" : "playing",
    hit,
  };
  return {
    ...state,
    game,
    status: statusOf(game),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

export function minesweeperDailyReducer(
  state: MinesweeperDailyState,
  action: MinesweeperDailyAction,
): MinesweeperDailyState {
  switch (action.type) {
    case "restore":
      return restored(state, action.record, action.now);
    case "tick":
    case "pause":
    case "resume":
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };
    default: {
      const game = moveMinesweeper(state.game, action);
      if (game === state.game) {
        return state;
      }
      const status = statusOf(game);
      return {
        ...state,
        game,
        status,
        pendingSync: status === "playing" ? state.pendingSync : true,
      };
    }
  }
}

function entryOf(game: MinesweeperState, index: number): Entry {
  if (game.open[index]) {
    return 1;
  }
  switch (game.marks[index]) {
    case "flag":
      return 2;
    case "question":
      return 3;
    default:
      return 0;
  }
}

export function buildMinesweeperRecord(
  state: MinesweeperDailyState,
  now: number,
  closed: boolean,
): MinesweeperPlayRecord {
  return {
    ...recordHeader(state, now, closed, 0),
    game: "minesweeper",
    entries: state.game.open.map((_open, index) => entryOf(state.game, index)),
    hit: closed ? state.game.hit : undefined,
  };
}
