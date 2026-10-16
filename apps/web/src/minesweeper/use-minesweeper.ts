"use client";

import type { MinesweeperLevel } from "@miolos/games/minesweeper";
import { useCallback, useEffect, useReducer, type Dispatch } from "react";

import { pickSeed } from "../free-play/catalog";
import { elapsedMs } from "../play/timer";
import { useSettings } from "../settings/settings";
import {
  initMinesweeper,
  minesLeft,
  minesweeperReducer,
  type MinesweeperMove,
  type MinesweeperPlay,
} from "./state";

export interface MinesweeperDeps {
  readonly pickSeed?: () => number;
}

export interface MinesweeperMoves {
  readonly activate: (index: number) => void;
  readonly chord: (index: number) => void;
  readonly mark: (index: number) => void;
}

export function useMinesweeperMoves(
  dispatch: Dispatch<MinesweeperMove>,
): MinesweeperMoves {
  const { questionMarks } = useSettings().games.minesweeper;
  return {
    activate: useCallback(
      (index) => {
        dispatch({ type: "activate", index, now: Date.now() });
      },
      [dispatch],
    ),
    chord: useCallback(
      (index) => {
        dispatch({ type: "chord", index, now: Date.now() });
      },
      [dispatch],
    ),
    mark: useCallback(
      (index) => {
        dispatch({ type: "mark", index, questionMarks });
      },
      [dispatch, questionMarks],
    ),
  };
}

export interface Minesweeper extends MinesweeperMoves {
  readonly play: MinesweeperPlay;
  readonly elapsedMs: number;
  readonly minesLeft: number;
  readonly newGame: () => void;
  readonly chooseLevel: (level: MinesweeperLevel) => void;
}

export function useMinesweeper(deps?: MinesweeperDeps): Minesweeper {
  const draw = deps?.pickSeed ?? pickSeed;
  const [play, dispatch] = useReducer(minesweeperReducer, null, () =>
    initMinesweeper("beginner", draw(), Date.now()),
  );
  const { level } = play;
  const running = play.timer.runningSince !== null;

  useEffect(() => {
    if (!running) {
      return;
    }
    const interval = setInterval(() => {
      dispatch({ type: "tick", now: Date.now() });
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [running]);

  return {
    play,
    elapsedMs: elapsedMs(play.timer, play.now),
    minesLeft: minesLeft(play.game),
    ...useMinesweeperMoves(dispatch),
    newGame: useCallback(() => {
      dispatch({ type: "new", level, seed: draw(), now: Date.now() });
    }, [level, draw]),
    chooseLevel: useCallback(
      (next) => {
        if (next !== level) {
          dispatch({ type: "new", level: next, seed: draw(), now: Date.now() });
        }
      },
      [level, draw],
    ),
  };
}
