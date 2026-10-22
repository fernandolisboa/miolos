import type { DailyMinesweeperResponse } from "@miolos/core";
import type { MinesweeperState } from "@miolos/games/minesweeper";

import {
  recordHeader,
  type MinesweeperPlayRecord,
  type PlayRecord,
} from "../play/play-record";
import { freshCore, hydratedAt, restoredFrom, timed } from "../play/play-core";
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
    ...freshCore(daily.date),
    game: startedGame(daily),
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
    return hydratedAt(state, now);
  }
  const game = gameOfRecord(state.game, record);
  return { ...restoredFrom(state, record, now), game, status: statusOf(game) };
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
      return timed(state, action);
    default: {
      const game = moveMinesweeper(state.game, action);
      if (game === state.game) {
        return state;
      }
      return { ...state, game, status: statusOf(game) };
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
