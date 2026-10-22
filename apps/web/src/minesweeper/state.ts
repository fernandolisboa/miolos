import {
  chordMinesweeper,
  cycleMinesweeperMark,
  newMinesweeperGame,
  openMinesweeperCell,
  type MinesweeperLevel,
  type MinesweeperSize,
  type MinesweeperState,
} from "@miolos/games/minesweeper";

import { applyTimerAction, type TimerState } from "../play/timer";

export type MinesweeperFreeLevel = MinesweeperLevel | "custom";

export interface MinesweeperDeal {
  readonly level: MinesweeperFreeLevel;
  readonly size: MinesweeperSize;
  readonly seed: number;
  readonly best: number | null;
}

export interface MinesweeperPlay {
  readonly level: MinesweeperFreeLevel;
  readonly seed: number;
  readonly best: number | null;
  readonly game: MinesweeperState;
  readonly timer: TimerState;
  readonly now: number;
}

export type MinesweeperMove =
  | { readonly type: "activate"; readonly index: number; readonly now: number }
  | { readonly type: "chord"; readonly index: number; readonly now: number }
  | {
      readonly type: "mark";
      readonly index: number;
      readonly questionMarks: boolean;
    };

export type MinesweeperAction =
  | MinesweeperMove
  | { readonly type: "tick"; readonly now: number }
  | ({ readonly type: "new"; readonly now: number } & MinesweeperDeal);

const STOPPED: TimerState = { accumulatedMs: 0, runningSince: null };

export function initMinesweeper(
  { level, size, seed, best }: MinesweeperDeal,
  now: number,
): MinesweeperPlay {
  return {
    level,
    seed,
    best,
    game: newMinesweeperGame(size, seed),
    timer: STOPPED,
    now,
  };
}

export function moveMinesweeper(
  game: MinesweeperState,
  move: MinesweeperMove,
): MinesweeperState {
  switch (move.type) {
    case "activate":
      return game.open[move.index]
        ? chordMinesweeper(game, move.index)
        : openMinesweeperCell(game, move.index);
    case "chord":
      return chordMinesweeper(game, move.index);
    case "mark":
      return cycleMinesweeperMark(game, move.index, move.questionMarks);
  }
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
    case "chord":
      return moved(play, moveMinesweeper(play.game, action), action.now);
    case "mark":
      return { ...play, game: moveMinesweeper(play.game, action) };
    case "tick":
      return { ...play, now: action.now };
    case "new":
      return initMinesweeper(action, action.now);
  }
}
