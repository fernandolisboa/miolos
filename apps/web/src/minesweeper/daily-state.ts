import type { DailyMinesweeperResponse } from "@miolos/core";
import type { MinesweeperState } from "@miolos/games/minesweeper";

import {
  recordHeader,
  type MinesweeperPlayRecord,
  type PlayRecord,
} from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { LifecycleAction, PlayCore } from "../play/types";
import { entriesOf, gameOfRecord, startedGame } from "./daily-record";
import { moveMinesweeper, type MinesweeperMove } from "./state";

export interface MinesweeperDailyState extends PlayCore {
  readonly game: MinesweeperState;
}

export type MinesweeperDailyAction = LifecycleAction | MinesweeperMove;

export function initMinesweeperDaily(
  daily: DailyMinesweeperResponse,
): MinesweeperDailyState {
  return {
    date: daily.date,
    game: startedGame(daily),
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
  const game = gameOfRecord(state.game, record);
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

export function buildMinesweeperRecord(
  state: MinesweeperDailyState,
  now: number,
  closed: boolean,
): MinesweeperPlayRecord {
  return {
    ...recordHeader(state, now, closed, 0),
    game: "minesweeper",
    entries: entriesOf(state.game),
    hit: closed ? state.game.hit : undefined,
  };
}
