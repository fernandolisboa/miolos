import {
  dailyMinesweeperResponseSchema,
  type DailyMinesweeperResponse,
} from "@miolos/core";
import {
  generateMinesweeperDaily,
  minesweeperField,
  startMinesweeper,
} from "@miolos/games/minesweeper";
import { describe, expect, it } from "vitest";

import {
  buildMinesweeperRecord,
  initMinesweeperDaily,
  minesweeperDailyReducer,
  type MinesweeperDailyState,
} from "../src/minesweeper/daily-state";
import { minesweeperPlayRecordSchema } from "../src/play/play-record";

const DATE = "2026-10-16";

function daily(seed = 7): DailyMinesweeperResponse {
  const generated = generateMinesweeperDaily({ seed, weekday: 5 });
  return dailyMinesweeperResponseSchema.parse({
    game: "minesweeper",
    date: DATE,
    rows: generated.rows,
    columns: generated.columns,
    mines: generated.mines,
    start: generated.start,
  });
}

function hydrated(puzzle = daily()): MinesweeperDailyState {
  const restored = minesweeperDailyReducer(initMinesweeperDaily(puzzle), {
    type: "restore",
    record: undefined,
    now: 1_000,
  });
  return minesweeperDailyReducer(restored, { type: "resume", now: 1_000 });
}

function open(state: MinesweeperDailyState, index: number) {
  return minesweeperDailyReducer(state, {
    type: "activate",
    index,
    now: 2_000,
  });
}

function firstClosed(
  state: MinesweeperDailyState,
  mine: boolean,
  puzzle = daily(),
): number {
  const index = puzzle.mines.findIndex(
    (cell, at) =>
      (cell === 1) === mine &&
      !state.game.open[at] &&
      state.game.marks[at] === null,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

function winning(puzzle = daily()): MinesweeperDailyState {
  let state = hydrated(puzzle);
  puzzle.mines.forEach((cell, index) => {
    if (cell === 0) {
      state = open(state, index);
    }
  });
  return state;
}

describe("the daily Campo Minado plays the published field from its open start (T-WEB-S920)", () => {
  it("starts on the engine's own pre-opened board, playing, with the clock stopped", () => {
    const puzzle = daily();
    const state = initMinesweeperDaily(puzzle);
    const field = minesweeperField(
      puzzle.rows,
      puzzle.columns,
      puzzle.mines.map((cell) => cell === 1),
    );

    expect(state.game).toEqual(startMinesweeper(field, puzzle.start));
    expect(state.game.open[puzzle.start]).toBe(true);
    expect(state.status).toBe("playing");
    expect(state.hydrated).toBe(false);
    expect(state.timer).toEqual({ accumulatedMs: 0, runningSince: null });
  });

  it("runs the clock from hydration, not from the first open", () => {
    const resumed = hydrated();
    const ticked = minesweeperDailyReducer(resumed, {
      type: "tick",
      now: 4_000,
    });

    expect(resumed.timer.runningSince).toBe(1_000);
    expect(resumed.game.open.filter(Boolean).length).toBeGreaterThan(0);
    expect(ticked.now).toBe(4_000);
    expect(ticked.game).toBe(resumed.game);
  });

  it("closes lost on a mine and records the hit", () => {
    const start = hydrated();
    const mine = firstClosed(start, true);
    const lost = open(start, mine);

    expect(lost.status).toBe("lost");
    expect(lost.game.hit).toBe(mine);
    const record = minesweeperPlayRecordSchema.parse(
      buildMinesweeperRecord(lost, 5_000, true),
    );
    expect(record.hit).toBe(mine);
    expect(record.hintsUsed).toBe(0);
    expect(record.concluded).toBe(true);
  });

  it("closes solved once every safe cell is open, recording no hit", () => {
    const won = winning();

    expect(won.status).toBe("solved");
    expect(
      minesweeperPlayRecordSchema.parse(
        buildMinesweeperRecord(won, 5_000, true),
      ).hit,
    ).toBeNull();
  });

  it("leaves no hit on an open record, and flags and question marks in its entries", () => {
    const start = hydrated();
    const mine = firstClosed(start, true);
    const safe = firstClosed(start, false);
    const flagged = minesweeperDailyReducer(start, {
      type: "mark",
      index: mine,
      questionMarks: true,
    });
    const questioned = minesweeperDailyReducer(
      minesweeperDailyReducer(flagged, {
        type: "mark",
        index: safe,
        questionMarks: true,
      }),
      { type: "mark", index: safe, questionMarks: true },
    );
    const record = minesweeperPlayRecordSchema.parse(
      buildMinesweeperRecord(questioned, 5_000, false),
    );

    expect(record.hit).toBeUndefined();
    expect(record.entries[mine]).toBe(2);
    expect(record.entries[safe]).toBe(3);
    expect(record.entries[daily().start]).toBe(1);
  });

  it("restores a saved board, a loss and a win as they were left", () => {
    const puzzle = daily();
    const start = hydrated(puzzle);
    const marked = minesweeperDailyReducer(start, {
      type: "mark",
      index: firstClosed(start, true, puzzle),
      questionMarks: false,
    });
    const lost = open(marked, firstClosed(marked, true, puzzle));

    for (const [left, closed] of [
      [marked, false],
      [lost, true],
      [winning(puzzle), true],
    ] as const) {
      const record = buildMinesweeperRecord(left, 5_000, closed);
      const back = minesweeperDailyReducer(initMinesweeperDaily(puzzle), {
        type: "restore",
        record: minesweeperPlayRecordSchema.parse(
          JSON.parse(JSON.stringify(record)),
        ),
        now: 9_000,
      });

      expect(back.game).toEqual(left.game);
      expect(back.status).toBe(left.status);
      expect(back.hydrated).toBe(true);
      expect(back.timer).toEqual({ accumulatedMs: 4_000, runningSince: null });
    }
  });

  it("ignores moves once the board has closed", () => {
    const start = hydrated();
    const lost = open(start, firstClosed(start, true));
    expect(
      minesweeperDailyReducer(lost, {
        type: "mark",
        index: firstClosed(lost, true),
        questionMarks: false,
      }),
    ).toBe(lost);
    expect(open(lost, firstClosed(lost, false))).toBe(lost);
  });
});
