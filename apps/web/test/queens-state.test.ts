import {
  dailyQueensResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
  type DailyQueensResponse,
} from "@miolos/core";
import { generateQueens, type QueensPuzzle } from "@miolos/games/queens";
import { describe, expect, it } from "vitest";

import type { QueensPlayRecord } from "../src/play/play-record";
import {
  initQueensPlayState,
  queensPlayReducer,
  type QueensPlayAction,
  type QueensPlayState,
} from "../src/queens/state";

const DATE = "2026-10-12";

function dailyOf(puzzle: Pick<QueensPuzzle, "size" | "regions">) {
  return dailyQueensResponseSchema.parse({
    game: "queens",
    date: DATE,
    size: puzzle.size,
    regions: puzzle.regions,
  });
}

const STRIPES: DailyQueensResponse = dailyOf({
  size: 7,
  regions: Array.from({ length: 49 }, (_unused, index) => {
    const row = Math.floor(index / 7);
    const column = index % 7;
    return (row + 2 * column) % 7;
  }),
});

const PUZZLE = generateQueens({ seed: 20_261_012, weekday: 1 });
const DAILY = dailyOf(PUZZLE);
const SOLUTION = PUZZLE.solution;

function hydrated(daily: DailyQueensResponse): QueensPlayState {
  return queensPlayReducer(initQueensPlayState(daily), {
    type: "restore",
    record: undefined,
    now: 0,
  });
}

function run(
  state: QueensPlayState,
  ...actions: QueensPlayAction[]
): QueensPlayState {
  return actions.reduce(queensPlayReducer, state);
}

const at = (row: number, column: number, size = 7) => row * size + column;

const queensAt = (...cells: number[]): QueensPlayAction[] =>
  cells.flatMap((index) => [
    { type: "select", index },
    { type: "enter-value", value: 1 },
  ]);

const solutionCells = SOLUTION.flatMap((cell, index) =>
  cell === 1 ? [index] : [],
);

describe("the Rainhas reducer (T-WEB-S451)", () => {
  it("cycles a tapped cell empty → marked → queen → empty", () => {
    const tap: QueensPlayAction = { type: "tap", index: 3, press: "tap" };
    const once = run(hydrated(DAILY), tap);
    const twice = run(once, tap);
    const thrice = run(twice, tap);
    expect(once.entries[3]).toBe(0);
    expect(twice.entries[3]).toBe(1);
    expect(thrice.entries[3]).toBeNull();
  });

  it("(T-WEB-S507) places a queen on a right press and removes it on the next, leaving left and tap on the cycle", () => {
    const right: QueensPlayAction = { type: "tap", index: 3, press: "right" };
    const placed = run(hydrated(DAILY), right);
    expect(placed.entries[3]).toBe(1);
    expect(run(placed, right).entries[3]).toBeNull();

    const marked = run(hydrated(DAILY), {
      type: "tap",
      index: 3,
      press: "left",
    });
    expect(marked.entries[3]).toBe(0);
    expect(run(marked, right).entries[3]).toBe(1);
    expect(
      run(marked, { type: "tap", index: 3, press: "tap" }).entries[3],
    ).toBe(1);
  });

  it("crosses only empty cells on a drag, never a queen or an existing mark", () => {
    const start = run(hydrated(DAILY), ...queensAt(4), {
      type: "tap",
      index: 5,
      press: "tap",
    });
    const dragged = run(
      start,
      { type: "cross-over", index: 4 },
      { type: "cross-over", index: 5 },
      { type: "cross-over", index: 6 },
    );
    expect(dragged.entries[4]).toBe(1);
    expect(dragged.entries[5]).toBe(0);
    expect(dragged.entries[6]).toBe(0);
  });

  it("writes the selected cell from the keyboard, and the same value again clears it", () => {
    const queen = run(hydrated(DAILY), ...queensAt(10));
    expect(queen.entries[10]).toBe(1);
    const mark = run(queen, { type: "enter-value", value: 0 });
    expect(mark.entries[10]).toBe(0);
    const cleared = run(mark, { type: "enter-value", value: 0 });
    expect(cleared.entries[10]).toBeNull();
    const erased = run(mark, { type: "clear-cell" });
    expect(erased.entries[10]).toBeNull();
  });

  it("moves the caret and clamps at every edge", () => {
    const corner = run(hydrated(DAILY), { type: "select", index: 0 });
    expect(
      run(corner, { type: "move-selection", rows: -1, columns: -1 }).selected,
    ).toBe(0);
    expect(
      run(corner, { type: "move-selection", rows: 0, columns: 6 }).selected,
    ).toBe(6);
    expect(
      run(corner, { type: "move-selection", rows: 9, columns: 9 }).selected,
    ).toBe(48);
  });

  it("ignores a select or a tap outside the board", () => {
    const start = hydrated(DAILY);
    expect(run(start, { type: "select", index: 49 })).toBe(start);
    expect(run(start, { type: "tap", index: -1, press: "tap" })).toBe(start);
  });

  it("solves when the placement is valid, marks it for sync once, and then freezes the board", () => {
    const solved = run(hydrated(DAILY), ...queensAt(...solutionCells));
    expect(solved.status).toBe("solved");
    expect(solved.pendingSync).toBe(true);
    const frozen = run(solved, {
      type: "tap",
      index: solutionCells[0] ?? 0,
      press: "tap",
    });
    expect(frozen.entries).toEqual(solved.entries);
  });

  it("does not count marks: N queens plus marks on every other cell still solves", () => {
    const marked = run(
      hydrated(DAILY),
      ...SOLUTION.flatMap((cell, index): QueensPlayAction[] =>
        cell === 0 ? [{ type: "tap", index, press: "tap" }] : [],
      ),
      ...queensAt(...solutionCells),
    );
    expect(marked.status).toBe("solved");
  });
});

describe("conflicts show every rule kind and never flag a mark (T-WEB-S452)", () => {
  const cases = [
    ["a shared row", at(0, 0), at(0, 3)],
    ["a shared column", at(0, 0), at(3, 0)],
    ["a shared region", at(0, 0), at(1, 3)],
    ["a diagonal touch", at(0, 0), at(1, 1)],
  ] as const;

  it.each(cases)("flags both queens on %s", (_kind, a, b) => {
    const state = run(hydrated(STRIPES), ...queensAt(a, b));
    expect([...state.conflicts].sort((x, y) => x - y)).toEqual(
      [a, b].sort((x, y) => x - y),
    );
  });

  it("flags nothing for two queens that break no rule, nor for a mark beside a queen", () => {
    const state = run(
      hydrated(STRIPES),
      ...queensAt(at(0, 0), at(2, 3)),
      { type: "tap", index: at(0, 1), press: "tap" },
      { type: "tap", index: at(1, 1), press: "tap" },
    );
    expect(state.entries[at(1, 1)]).toBe(0);
    expect(state.conflicts.size).toBe(0);
  });

  it("clears a conflict once the offending queen is removed", () => {
    const state = run(hydrated(STRIPES), ...queensAt(at(0, 0), at(0, 3)), {
      type: "clear-cell",
    });
    expect(state.conflicts.size).toBe(0);
  });
});

describe("the Rainhas hint (T-WEB-S453)", () => {
  it("carries the engine's solution from init", () => {
    expect(initQueensPlayState(DAILY).solution).toEqual(SOLUTION);
  });

  it("places a queen on an untouched board and records the hint", () => {
    const hinted = run(hydrated(DAILY), { type: "use-hint" });
    const index = hinted.hint.lastIndex ?? -1;
    expect(SOLUTION[index]).toBe(1);
    expect(hinted.entries[index]).toBe(1);
    expect(hinted.hint.used).toBe(1);
  });

  it("first turns a wrong queen into a mark", () => {
    const wrong = SOLUTION.findIndex((cell) => cell === 0);
    const hinted = run(hydrated(DAILY), ...queensAt(wrong), {
      type: "use-hint",
    });
    expect(hinted.hint.lastIndex).toBe(wrong);
    expect(hinted.entries[wrong]).toBe(0);
  });

  it("first lifts a mark off a queen's cell", () => {
    const queenCell = solutionCells.at(-1) ?? 0;
    const hinted = run(
      hydrated(DAILY),
      { type: "tap", index: queenCell, press: "tap" },
      { type: "use-hint" },
    );
    expect(hinted.hint.lastIndex).toBe(queenCell);
    expect(hinted.entries[queenCell]).toBe(1);
  });

  it("drops the ring when the player rewrites the hinted cell", () => {
    const hinted = run(hydrated(DAILY), { type: "use-hint" });
    const index = hinted.hint.lastIndex ?? -1;
    const rewritten = run(hinted, { type: "tap", index, press: "tap" });
    expect(rewritten.hint.lastIndex).toBeNull();
  });
});

describe("the reducer's hints stop at the ceiling (T-WEB-S511e)", () => {
  const hint: QueensPlayAction = { type: "use-hint" };

  it("places a solution queen on each free press", () => {
    let current = hydrated(DAILY);
    for (let press = 1; press <= FREE_HINTS_PER_PUZZLE; press += 1) {
      current = run(current, hint);
      const index = current.hint.lastIndex ?? -1;

      expect(current.hint.lastIndex).not.toBeNull();
      expect(current.hint.used).toBe(press);
      expect(current.entries[index]).toBe(SOLUTION[index]);
    }
  });

  it("leaves exactly one hint after a restore one short of the ceiling, and the press after it is inert", () => {
    const restored = queensPlayReducer(initQueensPlayState(DAILY), {
      type: "restore",
      record: {
        v: 1,
        game: "queens",
        date: DATE,
        size: PUZZLE.size,
        entries: Array.from({ length: PUZZLE.size ** 2 }, () => null),
        elapsedMs: 0,
        hintsUsed: HINTS_PER_PUZZLE_CEILING - 1,
        concluded: false,
        pendingSync: false,
        syncOutcome: "pending",
      },
      now: 1,
    });
    const last = run(restored, hint);

    expect(last.hint.used).toBe(HINTS_PER_PUZZLE_CEILING);
    expect(run(last, hint)).toBe(last);
  });
});

describe("restoring a Rainhas board (T-WEB-S454)", () => {
  function record(overrides: Partial<QueensPlayRecord>): QueensPlayRecord {
    return {
      v: 1,
      game: "queens",
      date: DATE,
      size: 7,
      entries: Array.from({ length: 49 }, () => null),
      elapsedMs: 42_000,
      hintsUsed: 1,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
      ...overrides,
    };
  }

  it("restores entries, the clock, the hint count and the conflicts", () => {
    const entries = Array.from({ length: 49 }, (): 0 | 1 | null => null);
    entries[at(0, 0)] = 1;
    entries[at(1, 1)] = 1;
    entries[at(4, 4)] = 0;
    const restored = queensPlayReducer(initQueensPlayState(STRIPES), {
      type: "restore",
      record: record({ entries }),
      now: 5,
    });
    expect(restored.hydrated).toBe(true);
    expect(restored.entries).toEqual(entries);
    expect(restored.timer.accumulatedMs).toBe(42_000);
    expect(restored.hint.used).toBe(1);
    expect([...restored.conflicts].sort((x, y) => x - y)).toEqual([
      at(0, 0),
      at(1, 1),
    ]);
  });

  it("ignores a record for another size and starts clean", () => {
    const restored = queensPlayReducer(initQueensPlayState(STRIPES), {
      type: "restore",
      record: record({
        size: 8,
        entries: Array.from({ length: 64 }, () => 1 as const),
      }),
      now: 5,
    });
    expect(restored.hydrated).toBe(true);
    expect(restored.entries.every((entry) => entry === null)).toBe(true);
    expect(restored.hint.used).toBe(0);
  });

  it("restores a solved board as solved", () => {
    const restored = queensPlayReducer(initQueensPlayState(DAILY), {
      type: "restore",
      record: record({ entries: [...SOLUTION], concluded: true }),
      now: 5,
    });
    expect(restored.status).toBe("solved");
  });
});
