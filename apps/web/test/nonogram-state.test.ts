import {
  dailyNonogramResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
  type DailyNonogramResponse,
} from "@miolos/core";
import { generateNonogram, type NonogramPuzzle } from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import type {
  BinairoPlayRecord,
  NonogramPlayRecord,
} from "../src/play/play-record";
import { isPictureComplete, solutionMarks } from "../src/nonogram/engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramCellValue,
  type NonogramMark,
  type NonogramPlayAction,
  type NonogramPlayState,
} from "../src/nonogram/state";

const DATE = "2026-08-01";

const MONDAY = generateNonogram(20_260_801, 1);
const SUNDAY = generateNonogram(20_260_801, 7);

function daily(puzzle: NonogramPuzzle): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

function play(
  state: NonogramPlayState,
  ...actions: readonly NonogramPlayAction[]
): NonogramPlayState {
  return actions.reduce(
    (current, action) => nonogramPlayReducer(current, action),
    state,
  );
}

function solutionOf(state: NonogramPlayState): readonly NonogramMark[] {
  if (state.solution === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return state.solution;
}

function firstPictureCell(state: NonogramPlayState): number {
  const index = solutionOf(state).indexOf(1);
  if (index < 0) {
    throw new Error("every motif paints at least one cell");
  }
  return index;
}

function fillOnly(state: NonogramPlayState): NonogramPlayState {
  return solutionOf(state).reduce(
    (current, mark, index) =>
      mark === 1
        ? nonogramPlayReducer(current, {
            type: "mark-cell",
            index,
            press: "tap",
          })
        : current,
    state,
  );
}

const MONDAY_STATE = initNonogramPlayState(daily(MONDAY));
const SUNDAY_STATE = initNonogramPlayState(daily(SUNDAY));

describe("initNonogramPlayState", () => {
  it("is the deterministic server snapshot: an empty board, no caret, 00:00", () => {
    expect(MONDAY_STATE.size).toBe(5);
    expect(MONDAY_STATE.entries).toHaveLength(25);
    expect(MONDAY_STATE.entries.every((cell) => cell === null)).toBe(true);
    expect(MONDAY_STATE.selected).toBeNull();

    expect(MONDAY_STATE.brush).toBe("fill");
    expect(MONDAY_STATE.timer).toEqual({
      accumulatedMs: 0,
      runningSince: null,
    });
    expect(MONDAY_STATE.hint).toEqual({
      used: 0,
      lastIndex: null,
    });
    expect(MONDAY_STATE.status).toBe("playing");
    expect(MONDAY_STATE.hydrated).toBe(false);
    expect(MONDAY_STATE.now).toBe(0);
  });

  it("solves the picture once, from the clues the wire carries", () => {
    expect(MONDAY_STATE.solution).toEqual(solutionMarks(daily(MONDAY).clues));
    expect(SUNDAY_STATE.solution).toHaveLength(225);
  });
});

describe("mark-cell", () => {
  it("applies the brush, and re-applying the same brush clears the cell", () => {
    const painted = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 3,
      press: "tap",
    });
    expect(painted.entries[3]).toBe(1);

    const cleared = play(painted, {
      type: "mark-cell",
      index: 3,
      press: "tap",
    });
    expect(cleared.entries[3]).toBeNull();
  });

  it("writes 0 under the cross brush", () => {
    const crossed = play(
      MONDAY_STATE,
      { type: "set-brush", brush: "cross" },
      { type: "mark-cell", index: 7, press: "tap" },
    );
    expect(crossed.entries[7]).toBe(0);
  });

  it("is a no-op for an index that is not on the board", () => {
    expect(
      play(MONDAY_STATE, { type: "mark-cell", index: -1, press: "tap" }),
    ).toBe(MONDAY_STATE);
    expect(
      play(MONDAY_STATE, { type: "mark-cell", index: 25, press: "tap" }),
    ).toBe(MONDAY_STATE);
  });
});

describe("enter-value", () => {
  it("writes the value at the caret and re-entering the same value clears it", () => {
    const selected = play(MONDAY_STATE, { type: "select", index: 4 });

    const filled = play(selected, { type: "enter-value", value: 1 });
    expect(filled.entries[4]).toBe(1);

    const cleared = play(filled, { type: "enter-value", value: 1 });
    expect(cleared.entries[4]).toBeNull();
  });

  it("writes either value WITHOUT touching the brush — the keyboard's own door", () => {
    const crossed = play(
      MONDAY_STATE,
      { type: "select", index: 4 },
      { type: "enter-value", value: 0 },
    );

    expect(crossed.entries[4]).toBe(0);
    expect(crossed.brush).toBe("fill");
  });

  it("is a no-op with no caret", () => {
    expect(play(MONDAY_STATE, { type: "enter-value", value: 1 })).toBe(
      MONDAY_STATE,
    );
  });
});

describe("clear-cell", () => {
  it("returns the SAME state on an already-empty cell", () => {
    const selected = play(MONDAY_STATE, { type: "select", index: 2 });

    expect(play(selected, { type: "clear-cell" })).toBe(selected);
  });

  it("clears a crossed cell as readily as a filled one", () => {
    const crossed = play(
      MONDAY_STATE,
      { type: "select", index: 2 },
      { type: "enter-value", value: 0 },
    );

    expect(play(crossed, { type: "clear-cell" }).entries[2]).toBeNull();
  });
});

describe("a right press writes the opposite mark (T-WEB-S494)", () => {
  it("crosses under the fill brush, and a second right press clears the cross", () => {
    const crossed = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 3,
      press: "right",
    });
    expect(crossed.entries[3]).toBe(0);

    const cleared = play(crossed, {
      type: "mark-cell",
      index: 3,
      press: "right",
    });
    expect(cleared.entries[3]).toBeNull();
  });

  it("fills under the cross brush", () => {
    const filled = play(
      MONDAY_STATE,
      { type: "set-brush", brush: "cross" },
      { type: "mark-cell", index: 3, press: "right" },
    );
    expect(filled.entries[3]).toBe(1);
  });

  it("a left press and a tap use the brush, and a left press on a filled cell clears it", () => {
    const left = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 3,
      press: "left",
    });
    expect(left.entries[3]).toBe(1);
    expect(
      play(left, { type: "mark-cell", index: 3, press: "tap" }).entries[3],
    ).toBeNull();
  });

  it("a right press over a filled cell turns it into a cross", () => {
    const filled = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 3,
      press: "tap",
    });
    expect(
      play(filled, { type: "mark-cell", index: 3, press: "right" }).entries[3],
    ).toBe(0);
  });
});

describe("a stroke (T-WEB-S505)", () => {
  it("is a plain SET, so a stroke crossing a cell twice leaves it painted", () => {
    const started = play(MONDAY_STATE, {
      type: "stroke-start",
      index: 8,
      press: "tap",
    });
    const once = play(started, { type: "paint-over", index: 9 });
    const twice = play(once, { type: "paint-over", index: 9 });

    expect(started.entries[8]).toBe(1);
    expect(once.entries[9]).toBe(1);
    expect(twice).toBe(once);
  });

  it("overwrites a cross rather than toggling it", () => {
    const crossed = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 9,
      press: "right",
    });
    const repainted = play(
      crossed,
      { type: "stroke-start", index: 8, press: "tap" },
      { type: "paint-over", index: 9 },
    );

    expect(crossed.entries[9]).toBe(0);
    expect(repainted.entries[9]).toBe(1);
  });

  it("a right stroke crosses every cell it enters, over a fill", () => {
    const filled = play(MONDAY_STATE, {
      type: "mark-cell",
      index: 9,
      press: "tap",
    });
    const crossed = play(
      filled,
      { type: "stroke-start", index: 8, press: "right" },
      { type: "paint-over", index: 9 },
      { type: "paint-over", index: 10 },
    );

    expect([8, 9, 10].map((index) => crossed.entries[index])).toStrictEqual([
      0, 0, 0,
    ]);
  });

  it("from a filled cell clears the filled cells it enters and leaves the crosses", () => {
    const board = play(
      MONDAY_STATE,
      { type: "mark-cell", index: 8, press: "tap" },
      { type: "mark-cell", index: 9, press: "right" },
      { type: "mark-cell", index: 10, press: "tap" },
    );
    const cleared = play(
      board,
      { type: "stroke-start", index: 8, press: "tap" },
      { type: "paint-over", index: 9 },
      { type: "paint-over", index: 10 },
      { type: "paint-over", index: 11 },
    );

    expect([8, 9, 10, 11].map((index) => cleared.entries[index])).toStrictEqual(
      [null, 0, null, null],
    );
  });

  it("(a) the next stroke replaces a clearing latch, so one starting off the cells does not clear", () => {
    const next = play(
      MONDAY_STATE,
      { type: "mark-cell", index: 8, press: "tap" },
      { type: "mark-cell", index: 10, press: "tap" },
      { type: "stroke-start", index: 8, press: "tap" },
      { type: "stroke-start", index: 9, press: "tap" },
      { type: "paint-over", index: 10 },
    );

    expect([8, 9, 10].map((index) => next.entries[index])).toStrictEqual([
      null,
      1,
      1,
    ]);
  });

  it("a paint-over with no stroke open writes nothing", () => {
    expect(play(MONDAY_STATE, { type: "paint-over", index: 9 })).toBe(
      MONDAY_STATE,
    );
  });

  it("(T-WEB-S502) off the board writes nothing and drops the old latch", () => {
    const latched = play(MONDAY_STATE, {
      type: "stroke-start",
      index: 8,
      press: "tap",
    });
    expect(latched.stroke).not.toBeNull();

    const lost = play(latched, {
      type: "stroke-start",
      index: 999,
      press: "tap",
    });
    const after = play(lost, { type: "paint-over", index: 9 });

    expect(lost.stroke).toBeNull();
    expect(lost.entries).toBe(latched.entries);
    expect(after.entries).toBe(latched.entries);
  });
});

describe("set-brush", () => {
  it("returns the SAME object when the active brush is pressed again", () => {
    expect(play(MONDAY_STATE, { type: "set-brush", brush: "fill" })).toBe(
      MONDAY_STATE,
    );
  });

  it("switches what a tap writes", () => {
    const crossing = play(MONDAY_STATE, { type: "set-brush", brush: "cross" });

    expect(crossing.brush).toBe("cross");
    expect(
      play(crossing, { type: "mark-cell", index: 1, press: "tap" }).entries[1],
    ).toBe(0);
  });
});

describe("select", () => {
  it("returns the SAME object when the caret does not move", () => {
    const selected = play(MONDAY_STATE, { type: "select", index: 6 });

    expect(play(selected, { type: "select", index: 6 })).toBe(selected);
    expect(play(selected, { type: "select", index: 7 })).not.toBe(selected);
  });

  it("refuses an OFF-BOARD index, so the roving tab stop always matches a cell (T-WEB-S71)", () => {
    const selected = play(MONDAY_STATE, { type: "select", index: 6 });
    const cells = MONDAY_STATE.size ** 2;

    for (const index of [-1, cells, cells + 1, Number.NaN]) {
      expect(
        play(selected, { type: "select", index }),
        `select(${index}) escaped the board`,
      ).toBe(selected);
    }

    expect(play(selected, { type: "select", index: 0 }).selected).toBe(0);
    expect(play(selected, { type: "select", index: cells - 1 }).selected).toBe(
      cells - 1,
    );
  });
});

describe("move-selection", () => {
  it("lands on the first cell from no selection at all", () => {
    expect(
      play(SUNDAY_STATE, { type: "move-selection", rows: -3, columns: 4 })
        .selected,
    ).toBe(0);
  });

  it("clamps at all four edges of the 15×15 board and never wraps", () => {
    const size = 15;
    const topLeft = play(SUNDAY_STATE, { type: "select", index: 0 });
    const bottomRight = play(SUNDAY_STATE, {
      type: "select",
      index: size * size - 1,
    });

    expect(
      play(topLeft, { type: "move-selection", rows: -1, columns: 0 }).selected,
    ).toBe(0);
    expect(
      play(topLeft, { type: "move-selection", rows: 0, columns: -1 }).selected,
    ).toBe(0);
    expect(
      play(bottomRight, { type: "move-selection", rows: 1, columns: 0 })
        .selected,
    ).toBe(size * size - 1);
    expect(
      play(bottomRight, { type: "move-selection", rows: 0, columns: 1 })
        .selected,
    ).toBe(size * size - 1);

    const rowEnd = play(SUNDAY_STATE, { type: "select", index: size - 1 });
    expect(
      play(rowEnd, { type: "move-selection", rows: 0, columns: 1 }).selected,
    ).toBe(size - 1);
  });

  it("reads the size from the STATE, so the 5×5 board clamps at its own edges", () => {
    const rowEnd = play(MONDAY_STATE, { type: "select", index: 4 });

    expect(
      play(rowEnd, { type: "move-selection", rows: 0, columns: 1 }).selected,
    ).toBe(4);
    expect(
      play(rowEnd, { type: "move-selection", rows: 4, columns: 0 }).selected,
    ).toBe(24);

    expect(
      play(rowEnd, { type: "move-selection", rows: 0, columns: -4 }).selected,
    ).toBe(0);
  });

  it("returns the SAME object when the clamp leaves the caret where it was (T-WEB-S67)", () => {
    const topLeft = play(SUNDAY_STATE, { type: "select", index: 0 });

    expect(
      play(topLeft, { type: "move-selection", rows: -1, columns: 0 }),
    ).toBe(topLeft);
    expect(
      play(topLeft, { type: "move-selection", rows: 0, columns: -14 }),
    ).toBe(topLeft);

    expect(
      play(topLeft, { type: "move-selection", rows: 1, columns: 0 }),
    ).not.toBe(topLeft);
  });
});

describe("status and pendingSync", () => {
  it("flips to solved only when the whole picture is painted, crossing nothing", () => {
    const solution = solutionOf(MONDAY_STATE);
    const pictureCells = solution.filter((mark) => mark === 1).length;
    const partial = solution.reduce<NonogramPlayState>(
      (current, mark, index) =>
        mark === 1 && index !== firstPictureCell(MONDAY_STATE)
          ? nonogramPlayReducer(current, {
              type: "mark-cell",
              index,
              press: "tap",
            })
          : current,
      MONDAY_STATE,
    );

    expect(pictureCells).toBeGreaterThan(1);
    expect(partial.status).toBe("playing");
    expect(partial.pendingSync).toBe(false);

    const solved = nonogramPlayReducer(partial, {
      type: "mark-cell",
      index: firstPictureCell(MONDAY_STATE),
      press: "tap",
    });

    expect(solved.status).toBe("solved");
    expect(solved.pendingSync).toBe(true);
  });

  it("stays playing while a cell outside the picture is painted", () => {
    const solution = solutionOf(MONDAY_STATE);
    const emptyCell = solution.indexOf(0);
    const overpainted = fillOnly(
      nonogramPlayReducer(MONDAY_STATE, {
        type: "mark-cell",
        index: emptyCell,
        press: "tap",
      }),
    );

    expect(emptyCell).toBeGreaterThanOrEqual(0);
    expect(overpainted.status).toBe("playing");

    expect(
      solution.every(
        (mark, index) => mark === 0 || overpainted.entries[index] === 1,
      ),
    ).toBe(true);
    expect(overpainted.entries[emptyCell]).toBe(1);
  });

  it("finishes identically whether the empty cells are crossed or left alone", () => {
    const solution = solutionOf(MONDAY_STATE);
    const crossedThrough = solution.reduce<NonogramPlayState>(
      (current, mark, index) =>
        nonogramPlayReducer(
          nonogramPlayReducer(current, {
            type: "set-brush",
            brush: mark === 1 ? "fill" : "cross",
          }),
          { type: "mark-cell", index, press: "tap" },
        ),
      MONDAY_STATE,
    );

    expect(fillOnly(MONDAY_STATE).status).toBe("solved");
    expect(crossedThrough.status).toBe("solved");
  });

  it("takes NO entry once the picture closes, so a closed board cannot reopen (T-WEB-S69)", () => {
    const solved = fillOnly(MONDAY_STATE);
    const outside = solutionOf(MONDAY_STATE).indexOf(0);
    expect(solved.status).toBe("solved");
    expect(outside).toBeGreaterThanOrEqual(0);

    for (const action of [
      {
        type: "mark-cell",
        index: firstPictureCell(MONDAY_STATE),
        press: "tap",
      },
      { type: "stroke-start", index: outside, press: "tap" },
      { type: "enter-value", value: 0 },
      { type: "clear-cell" },
    ] as const satisfies readonly NonogramPlayAction[]) {
      expect(
        nonogramPlayReducer(
          play(solved, {
            type: "select",
            index: firstPictureCell(MONDAY_STATE),
          }),
          action,
        ).status,
        `${action.type} reopened a closed board`,
      ).toBe("solved");
    }

    expect(
      nonogramPlayReducer(solved, {
        type: "stroke-start",
        index: outside,
        press: "tap",
      }).entries,
    ).toBe(solved.entries);

    expect(solved.pendingSync).toBe(true);
  });

  it("keeps the clock frozen once the board closes, whatever lands after (T-WEB-S70)", () => {
    const running = play(fillOnly(MONDAY_STATE), { type: "resume", now: 0 });
    const outside = solutionOf(MONDAY_STATE).indexOf(0);
    const after = play(
      running,
      { type: "stroke-start", index: outside, press: "tap" },
      { type: "pause", now: 10_000 },
    );

    expect(after.status).toBe("solved");
    expect(after.timer.runningSince).toBeNull();
    expect(after.timer.accumulatedMs).toBe(10_000);

    expect(
      after.status !== "playing" && after.timer.runningSince === null,
    ).toBe(true);
  });
});

describe("restore (T-WEB-S37)", () => {
  const NOW = 1_754_000_000_000;

  function nonogramRecord(
    overrides: Partial<NonogramPlayRecord> = {},
  ): NonogramPlayRecord {
    return {
      v: 1,
      game: "nonogram",
      date: DATE,
      size: 5,
      entries: Array.from({ length: 25 }, () => null),
      elapsedMs: 61_000,
      hintsUsed: 1,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
      ...overrides,
    };
  }

  it("restores a record that agrees with today's board", () => {
    const entries: readonly NonogramCellValue[] = Array.from(
      { length: 25 },
      (_unused, index) => (index === 3 ? 1 : index === 4 ? 0 : null),
    );
    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: nonogramRecord({ entries: [...entries] }),
      now: NOW,
    });

    expect(restored.entries).toEqual(entries);
    expect(restored.timer).toEqual({
      accumulatedMs: 61_000,
      runningSince: null,
    });
    expect(restored.hint).toEqual({
      used: 1,
      lastIndex: null,
    });
    expect(restored.hydrated).toBe(true);
    expect(restored.now).toBe(NOW);
  });

  it("discards a record whose size disagrees with today's board", () => {
    const restored = play(SUNDAY_STATE, {
      type: "restore",
      record: nonogramRecord(),
      now: NOW,
    });

    expect(restored.entries).toEqual(SUNDAY_STATE.entries);
    expect(restored.status).toBe("playing");
    expect(restored.timer).toEqual({ accumulatedMs: 0, runningSince: null });
    expect(restored.hint.used).toBe(0);
    expect(restored.hydrated).toBe(true);
    expect(restored.now).toBe(NOW);
  });

  it("discards a LONGER record that would otherwise read as a false win", () => {
    const monday = solutionOf(MONDAY_STATE);
    const entries: NonogramCellValue[] = Array.from(
      { length: 225 },
      (_unused, index) => (index < 25 ? (monday[index] ?? null) : null),
    );

    expect(isPictureComplete(monday, entries)).toBe(true);

    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: nonogramRecord({ size: 15, entries }),
      now: NOW,
    });

    expect(restored.entries).toEqual(MONDAY_STATE.entries);
    expect(restored.status).toBe("playing");
    expect(restored.pendingSync).toBe(false);
    expect(restored.hydrated).toBe(true);
  });

  it("discards a record whose entries length disagrees with today's board", () => {
    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: nonogramRecord({
        entries: Array.from({ length: 64 }, () => null),
      }),
      now: NOW,
    });

    expect(restored.entries).toEqual(MONDAY_STATE.entries);
    expect(restored.hydrated).toBe(true);
  });

  it("discards a foreign-game record", () => {
    const binairo: BinairoPlayRecord = {
      v: 1,
      game: "binairo",
      date: DATE,
      entries: Array.from({ length: 64 }, () => null),
      elapsedMs: 61_000,
      hintsUsed: 0,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: binairo,
      now: NOW,
    });

    expect(restored.entries).toEqual(MONDAY_STATE.entries);
    expect(restored.hydrated).toBe(true);
  });

  it("hydrates on a missing record too, so the screen always leaves the skeleton", () => {
    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: undefined,
      now: NOW,
    });

    expect(restored.hydrated).toBe(true);
    expect(restored.now).toBe(NOW);
  });

  it("carries a concluded record's pendingSync through rather than recomputing it", () => {
    const solution = solutionOf(MONDAY_STATE);
    const restored = play(MONDAY_STATE, {
      type: "restore",
      record: nonogramRecord({
        entries: solution.map((mark) => (mark === 1 ? 1 : null)),
        concluded: true,
        pendingSync: false,
        syncOutcome: "recorded",
      }),
      now: NOW,
    });

    expect(restored.status).toBe("solved");

    expect(restored.pendingSync).toBe(false);
  });
});

describe("the reducer's hints stop at the ceiling (T-WEB-S511d)", () => {
  it("writes a solution mark on each free press", () => {
    const solution = solutionOf(MONDAY_STATE);
    let current = MONDAY_STATE;
    for (let press = 1; press <= FREE_HINTS_PER_PUZZLE; press += 1) {
      current = play(current, { type: "use-hint" });
      const index = current.hint.lastIndex ?? -1;

      expect(current.hint.lastIndex).not.toBeNull();
      expect(current.hint.used).toBe(press);
      expect(current.entries[index]).toBe(solution[index]);
    }
  });

  it("leaves exactly one hint after a restore one short of the ceiling, and the press after it is inert", () => {
    const record: NonogramPlayRecord = {
      v: 1,
      game: "nonogram",
      date: DATE,
      size: 5,
      entries: Array.from({ length: 25 }, () => null),
      elapsedMs: 0,
      hintsUsed: HINTS_PER_PUZZLE_CEILING - 1,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
    const restored = play(MONDAY_STATE, { type: "restore", record, now: 1 });
    const last = play(restored, { type: "use-hint" });

    expect(last.hint.used).toBe(HINTS_PER_PUZZLE_CEILING);
    expect(play(last, { type: "use-hint" })).toBe(last);
  });
});
