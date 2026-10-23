import {
  layMines,
  MINESWEEPER_LEVELS,
  type MinesweeperLevel,
} from "@miolos/games/minesweeper";
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

function fresh(level: MinesweeperLevel = "beginner", seed = SEED) {
  return initMinesweeper(
    { level, size: MINESWEEPER_LEVELS[level], seed, best: null },
    T0,
  );
}

function open(play: MinesweeperPlay, index: number, now: number) {
  return minesweeperReducer(play, { type: "activate", index, now });
}

function firstMineAfter(first: number): number {
  const { mines } = layMines({
    seed: SEED,
    size: MINESWEEPER_LEVELS.beginner,
    safe: [first],
  });
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
    const { mines } = layMines({
      seed: SEED,
      size: MINESWEEPER_LEVELS.beginner,
      safe: [40],
    });
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

  it("opens the neighbours of an open number whose mines are all flagged, and loses on a wrong flag", () => {
    const opened = open(fresh(), 40, T0);
    const { counts, mines } = opened.game.field ?? { counts: [], mines: [] };
    const around = (index: number) =>
      [-10, -9, -8, -1, 1, 8, 9, 10]
        .map((step) => index + step)
        .filter(
          (cell) =>
            cell >= 0 && cell < 81 && Math.abs((cell % 9) - (index % 9)) <= 1,
        );
    const number = opened.game.open.findIndex(
      (isOpen, index) =>
        isOpen &&
        (counts[index] ?? 0) > 0 &&
        around(index).some((cell) => !opened.game.open[cell] && !mines[cell]),
    );
    expect(number).toBeGreaterThanOrEqual(0);
    const flag = (play: MinesweeperPlay, cells: readonly number[]) =>
      cells.reduce(
        (acc, index) =>
          minesweeperReducer(acc, {
            type: "mark",
            index,
            questionMarks: false,
          }),
        play,
      );
    const neighbours = around(number);
    const safe = neighbours.filter(
      (cell) => !opened.game.open[cell] && !mines[cell],
    );
    const dangerous = neighbours.filter((cell) => mines[cell]);

    const right = minesweeperReducer(flag(opened, dangerous), {
      type: "activate",
      index: number,
      now: T0 + 1,
    });
    expect(safe.every((cell) => right.game.open[cell])).toBe(true);
    expect(right.game.status).not.toBe("lost");

    const wrongFlags = [safe[0] ?? 0, ...dangerous.slice(1)];
    const wrong = minesweeperReducer(flag(opened, wrongFlags), {
      type: "activate",
      index: number,
      now: T0 + 1,
    });
    expect(wrong.game.status).toBe("lost");
    expect(wrong.timer.runningSince).toBeNull();
  });

  it("a first open that clears the whole board wins with the clock never started", () => {
    const won = minesweeperReducer(fresh("beginner", 66_614), {
      type: "activate",
      index: 0,
      now: T0 + 3000,
    });

    expect(won.game.status).toBe("won");
    expect(won.timer.runningSince).toBeNull();
    expect(elapsedMs(won.timer, T0 + 99_000)).toBe(0);
  });

  it("a new game takes the level and seed given, and a stopped clock", () => {
    const played = open(fresh(), 40, T0);
    const next = minesweeperReducer(played, {
      type: "new",
      level: "expert",
      size: MINESWEEPER_LEVELS.expert,
      seed: 7,
      best: null,
      now: T0 + 5000,
    });

    expect(next.level).toBe("expert");
    expect(next.seed).toBe(7);
    expect(next.game.status).toBe("ready");
    expect(elapsedMs(next.timer, T0 + 99_000)).toBe(0);
    expect(minesLeft(next.game)).toBe(99);
  });
});

describe("a deal carries its size and the level's best time, and moves keep them (T-WEB-S1043)", () => {
  it("deals a custom size with no best time, and a level with the best it was given", () => {
    const custom = initMinesweeper(
      {
        level: "custom",
        size: { rows: 24, columns: 30, mines: 667 },
        seed: SEED,
        best: null,
      },
      T0,
    );
    expect(custom.level).toBe("custom");
    expect(custom.game.size).toEqual({ rows: 24, columns: 30, mines: 667 });
    expect(custom.game.open).toHaveLength(720);
    expect(minesLeft(custom.game)).toBe(667);

    const next = minesweeperReducer(custom, {
      type: "new",
      level: "beginner",
      size: MINESWEEPER_LEVELS.beginner,
      seed: 3,
      best: 42,
      now: T0 + 1,
    });
    expect(next.best).toBe(42);
    expect(next.game.size).toEqual(MINESWEEPER_LEVELS.beginner);
  });

  it("keeps the best through moves, ticks, marks and the end of the game", () => {
    let play = initMinesweeper(
      {
        level: "beginner",
        size: MINESWEEPER_LEVELS.beginner,
        seed: SEED,
        best: 30,
      },
      T0,
    );
    play = open(play, 40, T0 + 1);
    play = minesweeperReducer(play, { type: "tick", now: T0 + 1000 });
    play = minesweeperReducer(play, {
      type: "mark",
      index: 0,
      questionMarks: false,
    });
    play = open(play, firstMineAfter(40), T0 + 2000);

    expect(play.game.status).toBe("lost");
    expect(play.best).toBe(30);
  });
});
