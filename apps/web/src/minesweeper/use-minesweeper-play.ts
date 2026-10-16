import type { DailyMinesweeperResponse } from "@miolos/core";
import { useReducer } from "react";

import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  buildMinesweeperRecord,
  initMinesweeperDaily,
  minesweeperDailyReducer,
  type MinesweeperDailyState,
} from "./daily-state";
import { minesLeft } from "./state";
import { useMinesweeperMoves, type MinesweeperMoves } from "./use-minesweeper";

export interface MinesweeperDailyPlay extends MinesweeperMoves {
  readonly state: MinesweeperDailyState;
  readonly elapsed: number;
  readonly minesLeft: number;
}

export function useMinesweeperPlay(
  daily: DailyMinesweeperResponse,
  remotelyClaimed = false,
): MinesweeperDailyPlay {
  const [state, dispatch] = useReducer(
    minesweeperDailyReducer,
    daily,
    initMinesweeperDaily,
  );

  usePlayLifecycle({
    game: "minesweeper",
    state,
    reduce: minesweeperDailyReducer,
    dispatch,
    buildRecord: buildMinesweeperRecord,
    remotelyClaimed,
    persistDeps: [state.game],
  });

  return {
    state,
    elapsed: elapsedMs(state.timer, state.now),
    minesLeft: minesLeft(state.game),
    ...useMinesweeperMoves(dispatch),
  };
}
