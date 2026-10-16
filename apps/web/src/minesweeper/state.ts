import {
  MINESWEEPER_LEVELS,
  chordMinesweeper,
  cycleMinesweeperMark,
  newMinesweeperGame,
  openMinesweeperCell,
  type MinesweeperLevel,
  type MinesweeperState,
} from "@miolos/games/minesweeper";

import { applyTimerAction, type TimerState } from "../play/timer";

export interface MinesweeperPlay {
  readonly level: MinesweeperLevel;
  readonly seed: number;
  readonly game: MinesweeperState;
  readonly timer: TimerState;
  readonly now: number;
}

export type MinesweeperAction =
  | { readonly type: "activate"; readonly index: number; readonly now: number }
  | { readonly type: "chord"; readonly index: number; readonly now: number }
  | {
      readonly type: "mark";
      readonly index: number;
      readonly questionMarks: boolean;
    }
  | { readonly type: "tick"; readonly now: number }
  | {
      readonly type: "new";
      readonly level: MinesweeperLevel;
      readonly seed: number;
      readonly now: number;
    };

const STOPPED: TimerState = { accumulatedMs: 0, runningSince: null };

export function initMinesweeper(
  level: MinesweeperLevel,
  seed: number,
  now: number,
): MinesweeperPlay {
  return {
    level,
    seed,
    game: newMinesweeperGame(MINESWEEPER_LEVELS[level], seed),
    timer: STOPPED,
    now,
  };
}

export function minesLeft(game: MinesweeperState): number {
  const flags = game.marks.filter((mark) => mark === "flag").length;
  return game.size.mines - flags;
}

function moved(
  play: MinesweeperPlay,
  game: MinesweeperState,
  now: number,
): MinesweeperPlay {
  if (game === play.game) {
    return { ...play, now };
  }
  if (game.status === "won" || game.status === "lost") {
    return {
      ...play,
      game,
      timer: applyTimerAction(play.timer, { type: "pause", now }),
      now,
    };
  }
  if (play.game.status === "ready" && game.status !== "ready") {
    return {
      ...play,
      game,
      timer: { accumulatedMs: 0, runningSince: now },
      now,
    };
  }
  return { ...play, game, now };
}

export function minesweeperReducer(
  play: MinesweeperPlay,
  action: MinesweeperAction,
): MinesweeperPlay {
  switch (action.type) {
    case "activate":
      return moved(
        play,
        play.game.open[action.index]
          ? chordMinesweeper(play.game, action.index)
          : openMinesweeperCell(play.game, action.index),
        action.now,
      );
    case "chord":
      return moved(play, chordMinesweeper(play.game, action.index), action.now);
    case "mark":
      return {
        ...play,
        game: cycleMinesweeperMark(
          play.game,
          action.index,
          action.questionMarks,
        ),
      };
    case "tick":
      return { ...play, now: action.now };
    case "new":
      return initMinesweeper(action.level, action.seed, action.now);
  }
}
