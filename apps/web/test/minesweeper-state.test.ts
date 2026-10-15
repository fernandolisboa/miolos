import { layMines, MINESWEEPER_LEVELS } from "@miolos/games/minesweeper";
import { describe, expect, it } from "vitest";

import {
  initMinesweeper,
  minesLeft,
  minesweeperReducer,
  type MinesweeperPlay,
} from "../src/minesweeper/state";
import { elapsedMs } from "../src/play/timer";

const SEED = 20_261_015;
const T0 = 1_000_000;

function fresh(level: "beginner" | "intermediate" | "expert" = "beginner") {
  return initMinesweeper(level, SEED, T0);
}

function open(play: MinesweeperPlay, index: number, now: number) {
  return minesweeperReducer(play, { type: "activate", index, now });
}

function firstMineAfter(first: number): number {
  const { mines } = layMines({ seed: SEED, level: "beginner", safe: first });
  return mines.findIndex(Boolean);
}

describe("the clock starts at the first open, stops at the end, and the counter is mines minus flags (T-WEB-S886)", () => {
  it("starts ready, with the clock stopped at zero and every mine still to find", () => {
    const play = fresh();

    expect(play.game.status).toBe("ready");
    expect(elapsedMs(play.timer, play.now + 5000)).toBe(0);
    expect(minesLeft(play.game)).toBe(MINESWEEPER_LEVELS.beginner.mines);
  });

  it("does not start on a flag, but does on the first open", () => {
    const flagged = minesweeperReducer(fresh(), {
      type: "mark",
      index: 3,
      questionMarks: false,
    });
    expect(flagged.timer.runningSince).toBeNull();
    expect(minesLeft(flagged.game)).toBe(9);

    const opened = open(flagged, 40, T0 + 10);
    expect(opened.game.status).toBe("playing");
    expect(opened.timer.runningSince).toBe(T0 + 10);
    expect(elapsedMs(opened.timer, T0 + 10 + 4000)).toBe(4000);
  });

  it("counts down below zero when the player flags too many", () => {
    let play = fresh();
    for (let index = 0; index < 11; index += 1) {
      play = minesweeperReducer(play, {
        type: "mark",
        index,
        questionMarks: false,
      });
    }
    expect(minesLeft(play.game)).toBe(-1);
  });

  it("a tick moves the clock's now, and nothing else", () => {
    const opened = open(fresh(), 40, T0);
    const ticked = minesweeperReducer(opened, { type: "tick", now: T0 + 3000 });

    expect(ticked.game).toBe(opened.game);
    expect(elapsedMs(ticked.timer, ticked.now)).toBe(3000);
  });

  it("a move that changes nothing keeps the same state, so a re-click renders nothing", () => {
    const opened = open(fresh(), 40, T0);
    expect(open(opened, 40, T0 + 50)).toEqual({ ...opened, now: T0 + 50 });
    expect(open(opened, 40, T0 + 50).game).toBe(opened.game);
  });

  it("freezes the clock at a loss and ignores later ticks", () => {
    const mine = firstMineAfter(40);
    const lost = open(open(fresh(), 40, T0), mine, T0 + 7000);

    expect(lost.game.status).toBe("lost");
    expect(lost.timer.runningSince).toBeNull();
    const later = minesweeperReducer(lost, { type: "tick", now: T0 + 90_000 });
    expect(elapsedMs(later.timer, later.now)).toBe(7000);
  });

  it("freezes the clock at a win", () => {
    let play = open(fresh(), 40, T0);
    const { mines } = layMines({ seed: SEED, level: "beginner", safe: 40 });
    mines.forEach((isMine, index) => {
      if (!isMine) {
        play = open(play, index, T0 + 12_000);
      }
    });

    expect(play.game.status).toBe("won");
    expect(play.timer.runningSince).toBeNull();
    expect(elapsedMs(play.timer, T0 + 99_000)).toBe(12_000);
    expect(minesLeft(play.game)).toBe(0);
  });

  it("chords on an open number through the same activation", () => {
    const opened = open(fresh(), 40, T0);
    const field = opened.game.field;
    const number = opened.game.open.findIndex(
      (isOpen, index) => isOpen && (field?.counts[index] ?? 0) > 0,
    );
    expect(number).toBeGreaterThanOrEqual(0);

    const chorded = minesweeperReducer(opened, {
      type: "chord",
      index: number,
      now: T0 + 1,
    });
    expect(chorded.game).toBe(opened.game);
  });

  it("a new game takes the level and seed given, and a stopped clock", () => {
    const played = open(fresh(), 40, T0);
    const next = minesweeperReducer(played, {
      type: "new",
      level: "expert",
      seed: 7,
      now: T0 + 5000,
    });

    expect(next.game.level).toBe("expert");
    expect(next.game.seed).toBe(7);
    expect(next.game.status).toBe("ready");
    expect(elapsedMs(next.timer, T0 + 99_000)).toBe(0);
    expect(minesLeft(next.game)).toBe(99);
  });
});
