import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import {
  coloredRuns,
  type ColoredNonogramClues,
} from "@miolos/games/colored-nonogram";
import { deriveClues, lineCells } from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import {
  coloredNonogramReducers,
  initColoredNonogramState,
  type ColoredNonogramAction,
  type ColoredNonogramState,
} from "../src/colored-nonogram/state";
import { nextNonogramHint } from "../src/nonogram/hint";
import {
  initNonogramPlayState,
  nonogramReducers,
  type NonogramCellValue,
  type NonogramPlayAction,
  type NonogramPlayState,
} from "../src/nonogram/state";
import { SOLUTION_MISTAKES, withMistakes } from "../src/play/mistakes";
import type { NonogramPlayRecord } from "../src/play/play-record";
import type { UndoAction } from "../src/play/undo";
import type { LineCross } from "../src/settings/settings";

const PICTURE = [".###.", "##.##", "#####", "#...#", "##.##"];
const AMBIGUOUS = [".###.", "#####", "..#..", ".#.#.", "#...#"];
const EMPTY_ROW = ["#####", ".....", "#####", ".....", "#####"];

const ROW_0 = 0;
const COLUMN_0 = 5;
const COLUMN_2 = 7;

function daily(rows: readonly string[]): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: "2026-10-18",
    size: rows.length,
    clues: deriveClues(rows.map((row) => [...row].map((cell) => cell === "#"))),
  });
}

const START = initNonogramPlayState(daily(PICTURE));

type Action = NonogramPlayAction | UndoAction;

function play(
  mode: LineCross,
  state: NonogramPlayState,
  ...actions: readonly Action[]
): NonogramPlayState {
  return actions.reduce(nonogramReducers[mode], state);
}

function fill(index: number): NonogramPlayAction {
  return { type: "mark-cell", index, press: "tap" };
}

function right(index: number): NonogramPlayAction {
  return { type: "mark-cell", index, press: "right" };
}

function claims(state: {
  readonly autoCrossed: ReadonlyMap<number, ReadonlySet<number>>;
}) {
  return Object.fromEntries(
    [...state.autoCrossed].map(([cell, by]) => [cell, [...by].sort()]),
  );
}

function row(state: { readonly entries: readonly unknown[] }, r: number) {
  return state.entries.slice(r * 5, r * 5 + 5);
}

describe("a line whose fills form its clue crosses the rest (T-WEB-S970)", () => {
  it("has the exact solution the tests below lean on", () => {
    expect(START.solution).not.toBeNull();
    expect(initNonogramPlayState(daily(AMBIGUOUS)).solution).toBeNull();
  });

  it("a fill that completes row [3] of 5 crosses its two undecided cells, and one undo restores both", () => {
    const before = play("always", START, fill(1), fill(2));
    const after = play("always", before, fill(3));

    expect(row(after, 0)).toEqual([0, 1, 1, 1, 0]);
    expect(claims(after)).toEqual({ 0: [ROW_0], 4: [ROW_0] });

    const undone = play("always", after, { type: "undo" });
    expect(undone.entries).toEqual(before.entries);
    expect(undone.autoCrossed.size).toBe(0);
  });

  it("a cell a row and a column both claim stays crossed while either still forms its clue", () => {
    const both = play(
      "always",
      START,
      fill(1),
      fill(2),
      fill(3),
      fill(5),
      fill(10),
      fill(15),
      fill(20),
    );
    expect(claims(both)).toEqual({ 0: [ROW_0, COLUMN_0], 4: [ROW_0] });

    const unformed = play("always", both, fill(2));
    expect(row(unformed, 0)).toEqual([0, 1, null, 1, null]);
    expect(claims(unformed)).toEqual({ 0: [COLUMN_0] });
  });

  it("a claimed cell the player changes becomes theirs", () => {
    const formed = play("always", START, fill(1), fill(2), fill(3));
    const cleared = play("always", formed, right(4));
    expect(cleared.entries[4]).toBeNull();
    expect(claims(cleared)).toEqual({ 0: [ROW_0] });

    const crossed = play("always", cleared, right(4), fill(2));
    expect(row(crossed, 0)).toEqual([null, 1, null, 1, 0]);
    expect(crossed.autoCrossed.size).toBe(0);
  });

  it("a line with no runs never claims, even when its last fill is taken back", () => {
    const empty = initNonogramPlayState(daily(EMPTY_ROW));
    const back = play("always", empty, fill(6), fill(6));
    expect(back.entries.every((entry) => entry === null)).toBe(true);
    expect(back.autoCrossed.size).toBe(0);
  });

  it("the solving move crosses nothing", () => {
    const solution = START.solution ?? [];
    const last = solution.lastIndexOf(1);
    const almost = solution.reduce(
      (state, mark, index) =>
        mark === 1 && index !== last ? play("off", state, fill(index)) : state,
      START,
    );
    const solved = play("always", almost, fill(last));
    expect(solved.status).toBe("solved");
    expect(solved.autoCrossed.size).toBe(0);
    expect(solved.entries.filter((entry) => entry === 0)).toHaveLength(0);
  });
});

describe("restore and Recomeçar measure no transition (T-WEB-S971)", () => {
  function record(entries: readonly NonogramCellValue[]): NonogramPlayRecord {
    return {
      v: 1,
      game: "nonogram",
      date: "2026-10-18",
      size: 5,
      entries: [...entries],
      elapsedMs: 0,
      hintsUsed: 0,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
  }

  it("a restored board keeps its formed lines uncrossed and owns none of its ✕", () => {
    const formed = play("always", START, fill(1), fill(2), fill(3));
    const restored = play("always", START, {
      type: "restore",
      record: record(formed.entries),
      now: 1,
    });
    expect(row(restored, 0)).toEqual([0, 1, 1, 1, 0]);
    expect(restored.autoCrossed.size).toBe(0);
    expect(formed.autoCrossed.size).toBeGreaterThan(0);
    expect(
      play("always", formed, {
        type: "restore",
        record: record(formed.entries),
        now: 1,
      }).autoCrossed.size,
    ).toBe(0);

    const unformed = play("always", restored, fill(2));
    expect(row(unformed, 0)).toEqual([0, 1, null, 1, 0]);

    const bare = play("always", START, {
      type: "restore",
      record: record(
        START.entries.map((_, at) => (at < 4 && at > 0 ? 1 : null)),
      ),
      now: 1,
    });
    expect(row(play("always", bare, fill(12)), 0)).toEqual([
      null,
      1,
      1,
      1,
      null,
    ]);
  });

  it("Recomeçar clears the claims with the board", () => {
    const formed = play("always", START, fill(1), fill(2), fill(3));
    const reset = play("always", formed, { type: "reset" });
    expect(reset.entries.every((entry) => entry === null)).toBe(true);
    expect(reset.autoCrossed.size).toBe(0);
  });
});

describe("the setting picks what a formed line does (T-WEB-S972)", () => {
  it("off crosses nothing new and still releases what it finds", () => {
    expect(row(play("off", START, fill(1), fill(2), fill(3)), 0)).toEqual([
      null,
      1,
      1,
      1,
      null,
    ]);

    const formed = play("always", START, fill(1), fill(2), fill(3));
    const released = play("off", formed, fill(2));
    expect(row(released, 0)).toEqual([null, 1, null, 1, null]);
    expect(released.autoCrossed.size).toBe(0);
  });

  it("switching it on crosses no line that already forms its clue", () => {
    const formed = play("off", START, fill(1), fill(2), fill(3));
    const next = play("always", formed, fill(12));
    expect(row(next, 0)).toEqual([null, 1, 1, 1, null]);
    expect(claims(next)).toEqual({
      7: [COLUMN_2],
      17: [COLUMN_2],
      22: [COLUMN_2],
    });
  });

  it("correct crosses only a line whose fills match the solution, and never without one", () => {
    expect(row(play("correct", START, fill(1), fill(2), fill(3)), 0)).toEqual([
      0, 1, 1, 1, 0,
    ]);
    expect(row(play("always", START, fill(0), fill(1), fill(2)), 0)).toEqual([
      1, 1, 1, 0, 0,
    ]);
    expect(row(play("correct", START, fill(0), fill(1), fill(2)), 0)).toEqual([
      1,
      1,
      1,
      null,
      null,
    ]);

    const ambiguous = initNonogramPlayState(daily(AMBIGUOUS));
    expect(
      row(play("correct", ambiguous, fill(1), fill(2), fill(3)), 0),
    ).toEqual([null, 1, 1, 1, null]);
  });

  it("flag crosses as always does", () => {
    expect(nonogramReducers.flag).toBe(nonogramReducers.always);
  });
});

describe("undo and the mistake limit see a move and its ✕ as one (T-WEB-S973)", () => {
  it("a drag that completes a row is one undo step", () => {
    const dragged = play(
      "always",
      START,
      { type: "stroke-start", index: 1, press: "tap" },
      { type: "paint-over", index: 2 },
      { type: "paint-over", index: 3 },
    );
    expect(row(dragged, 0)).toEqual([0, 1, 1, 1, 0]);
    expect(dragged.history.steps).toHaveLength(1);

    const undone = play("always", dragged, { type: "undo" });
    expect(undone.entries).toEqual(START.entries);
    expect(undone.autoCrossed.size).toBe(0);
  });

  it("an automatic ✕ on a picture cell is never a mistake", () => {
    const limited = withMistakes(
      nonogramReducers.always,
      SOLUTION_MISTAKES,
      true,
    );
    const after = [fill(0), fill(1), fill(2)].reduce(limited, START);
    expect(row(after, 0)).toEqual([1, 1, 1, 0, 0]);
    expect(START.solution?.[3]).toBe(1);
    expect(after.mistakes.cells).toEqual([0]);
  });
});

describe("Cores crosses a line whose tones form its clue (T-WEB-S974)", () => {
  const TONES = [
    [0, 1, 1, 2, 0],
    [1, 1, 0, 2, 2],
    [1, 0, 0, 0, 2],
    [1, 1, 1, 2, 2],
    [0, 0, 1, 0, 0],
  ].flat();
  const runs = lineCells(5).map(({ cells }) =>
    coloredRuns(cells.map((cell) => TONES[cell] ?? 0)),
  );
  const clues: ColoredNonogramClues = {
    size: 5,
    palette: ["r", "b"],
    rows: runs.slice(0, 5),
    cols: runs.slice(5),
  };
  const fresh = initColoredNonogramState({
    date: "2026-10-18",
    clues,
    solution: TONES,
  });

  function paint(
    state: ColoredNonogramState,
    ...actions: readonly (ColoredNonogramAction | UndoAction)[]
  ): ColoredNonogramState {
    return actions.reduce(coloredNonogramReducers.always, state);
  }

  const tone = (value: number): ColoredNonogramAction => ({
    type: "set-tone",
    tone: value,
  });
  const tap = (index: number): ColoredNonogramAction => ({
    type: "mark-cell",
    index,
    press: "tap",
  });

  it("the right tones in order cross the rest, and one undo takes both back", () => {
    const before = paint(fresh, tone(1), tap(1), tap(2), tone(2));
    const after = paint(before, tap(3));
    expect(row(after, 0)).toEqual([0, 1, 1, 2, 0]);

    const undone = paint(after, { type: "undo" });
    expect(row(undone, 0)).toEqual([null, 1, 1, null, null]);
    expect(undone.autoCrossed.size).toBe(0);
  });

  it("the right lengths in the wrong tone cross nothing", () => {
    const wrong = paint(fresh, tone(2), tap(1), tap(2), tone(1), tap(3));
    expect(row(wrong, 0)).toEqual([null, 2, 2, 1, null]);
    expect(wrong.autoCrossed.size).toBe(0);
  });
});

describe("the Nonogram hint corrects a wrong fill before a wrong ✕ (T-WEB-S975)", () => {
  const solution = START.solution ?? [];

  it("fixes the fill first, wherever the ✕ is", () => {
    const entries = START.entries.map((_, at): NonogramCellValue =>
      at === 1 ? 0 : at === 7 ? 1 : null,
    );
    expect(nextNonogramHint(START.clues, solution, entries)).toMatchObject({
      index: 7,
      value: 0,
      reason: { kind: "correction" },
    });
  });

  it("then the wrong ✕", () => {
    const entries = START.entries.map((_, at): NonogramCellValue =>
      at === 1 ? 0 : null,
    );
    expect(nextNonogramHint(START.clues, solution, entries)).toMatchObject({
      index: 1,
      value: 1,
      reason: { kind: "correction" },
    });
  });
});
