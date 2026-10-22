"use client";

import {
  MINESWEEPER_LEVELS,
  type MinesweeperSize,
} from "@miolos/games/minesweeper";
import { useCallback, useEffect, useReducer } from "react";

import {
  initMinesweeper,
  minesLeft,
  minesweeperReducer,
  type MinesweeperDeal,
  type MinesweeperFreeLevel,
  type MinesweeperPlay,
} from "../minesweeper/state";
import {
  useMinesweeperMoves,
  type MinesweeperMoves,
} from "../minesweeper/use-minesweeper";
import { elapsedMs } from "../play/timer";
import { pickSeed } from "./catalog";
import {
  bestTimeAfter,
  readBestTime,
  readCustomSize,
  saveBestTime,
  saveCustomSize,
} from "./minesweeper-store";

export interface MinesweeperDeps {
  readonly pickSeed?: () => number;
}

export interface BestTime {
  readonly best: number | null;
  readonly isNew: boolean;
}

export interface FreeMinesweeper extends MinesweeperMoves {
  readonly play: MinesweeperPlay;
  readonly elapsedMs: number;
  readonly minesLeft: number;
  readonly bestTime: BestTime | null;
  readonly newGame: () => void;
  readonly chooseLevel: (level: MinesweeperFreeLevel) => void;
  readonly playCustom: (size: MinesweeperSize) => void;
}

function deal(
  level: MinesweeperFreeLevel,
  seed: number,
  size?: MinesweeperSize,
): MinesweeperDeal {
  if (level === "custom") {
    return { level, seed, size: size ?? readCustomSize(), best: null };
  }
  return {
    level,
    seed,
    size: MINESWEEPER_LEVELS[level],
    best: readBestTime(level),
  };
}

export function useFreeMinesweeper(deps?: MinesweeperDeps): FreeMinesweeper {
  const draw = deps?.pickSeed ?? pickSeed;
  const [play, dispatch] = useReducer(minesweeperReducer, null, () =>
    initMinesweeper(deal("beginner", draw()), Date.now()),
  );
  const { level, game } = play;
  const running = play.timer.runningSince !== null;
  const elapsed = elapsedMs(play.timer, play.now);
  const won = game.status === "won" ? Math.floor(elapsed / 1000) : null;

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

  useEffect(() => {
    if (won !== null && level !== "custom") {
      saveBestTime(level, won);
    }
  }, [won, level]);

  return {
    play,
    elapsedMs: elapsed,
    minesLeft: minesLeft(game),
    bestTime: level === "custom" ? null : bestTimeAfter(play.best, won),
    ...useMinesweeperMoves(dispatch),
    newGame: useCallback(() => {
      dispatch({
        type: "new",
        ...deal(level, draw(), game.size),
        now: Date.now(),
      });
    }, [level, draw, game.size]),
    chooseLevel: useCallback(
      (next) => {
        if (next !== level) {
          dispatch({ type: "new", ...deal(next, draw()), now: Date.now() });
        }
      },
      [level, draw],
    ),
    playCustom: useCallback(
      (size) => {
        saveCustomSize(size);
        dispatch({
          type: "new",
          ...deal("custom", draw(), size),
          now: Date.now(),
        });
      },
      [draw],
    ),
  };
}
