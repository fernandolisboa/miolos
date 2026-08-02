import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import { generateNonogram, type NonogramPuzzle } from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import type {
  BinairoPlayRecord,
  NonogramPlayRecord,
} from "../src/play/play-record";
import { solutionMarks } from "../src/nonogram/engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramCellValue,
  type NonogramMark,
  type NonogramPlayAction,
  type NonogramPlayState,
} from "../src/nonogram/state";

// T-WEB-S36 / T-WEB-S37 (plan 020 §19). The reducer is pure — no React, no
// DOM, no clock — so the whole gameplay state machine is covered by plain
// unit tests and the screen stays thin.

const DATE = "2026-08-01";

/** Weekday 1 is the 5×5 class; weekday 7 the 15×15 one, for the edge cases. */
const MONDAY = generateNonogram(20_260_801, 1);
const SUNDAY = generateNonogram(20_260_801, 7);

/** The wire projection, parsed the way the wall builds one — never cast. */
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

/**
 * The recovered picture, narrowed by a throw rather than by a cast: a
 * published daily is line-solvable to the exact bitmap by construction.
 */
function solutionOf(state: NonogramPlayState): readonly NonogramMark[] {
  if (state.solution === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return state.solution;
}

/** The first index the finished picture paints. */
function firstPictureCell(state: NonogramPlayState): number {
  const index = solutionOf(state).indexOf(1);
  if (index < 0) {
    throw new Error("every motif paints at least one cell");
  }
  return index;
}

/** Paint every picture cell with the fill brush, crossing nothing. */
function fillOnly(state: NonogramPlayState): NonogramPlayState {
  return solutionOf(state).reduce(
    (current, mark, index) =>
      mark === 1
        ? nonogramPlayReducer(current, { type: "mark-cell", index })
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
    // `preencher` first (P21): the drag is the primary gesture, so the board
    // may never boot into a mode where a drag does nothing.
    expect(MONDAY_STATE.brush).toBe("fill");
    expect(MONDAY_STATE.timer).toEqual({
      accumulatedMs: 0,
      runningSince: null,
    });
    expect(MONDAY_STATE.hint).toEqual({ free: 1, used: 0, lastIndex: null });
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
    const painted = play(MONDAY_STATE, { type: "mark-cell", index: 3 });
    expect(painted.entries[3]).toBe(1);

    const cleared = play(painted, { type: "mark-cell", index: 3 });
    expect(cleared.entries[3]).toBeNull();
  });

  it("writes 0 under the cross brush and null under the erase brush", () => {
    const crossed = play(
      MONDAY_STATE,
      { type: "set-brush", brush: "cross" },
      { type: "mark-cell", index: 7 },
    );
    expect(crossed.entries[7]).toBe(0);

    // One tap of the erase brush clears a filled cell.
    const erased = play(
      play(MONDAY_STATE, { type: "mark-cell", index: 7 }),
      { type: "set-brush", brush: "erase" },
      { type: "mark-cell", index: 7 },
    );
    expect(erased.entries[7]).toBeNull();
  });

  it("is a no-op for an index that is not on the board", () => {
    expect(play(MONDAY_STATE, { type: "mark-cell", index: -1 })).toBe(
      MONDAY_STATE,
    );
    expect(play(MONDAY_STATE, { type: "mark-cell", index: 25 })).toBe(
      MONDAY_STATE,
    );
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

    // A new object would re-render the board and fire the persist effect for
    // a write that changed nothing.
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

describe("paint-over", () => {
  it("is a plain SET, so a stroke crossing a cell twice leaves it painted", () => {
    const once = play(MONDAY_STATE, { type: "paint-over", index: 9 });
    const twice = play(once, { type: "paint-over", index: 9 });

    expect(once.entries[9]).toBe(1);
    expect(twice.entries[9]).toBe(1);
    // The identity guard (§10.3 divergence 4): a drag dispatches one
    // `paint-over` per `pointermove`, so a re-paint must not allocate a new
    // `entries` array and must not fire the persist effect.
    expect(twice).toBe(once);
  });

  it("overwrites a cross rather than toggling it", () => {
    const crossed = play(
      MONDAY_STATE,
      { type: "set-brush", brush: "cross" },
      { type: "paint-over", index: 9 },
    );
    const repainted = play(
      crossed,
      { type: "set-brush", brush: "fill" },
      { type: "paint-over", index: 9 },
    );

    expect(crossed.entries[9]).toBe(0);
    expect(repainted.entries[9]).toBe(1);
  });

  it("is a no-op off the board", () => {
    expect(play(MONDAY_STATE, { type: "paint-over", index: 999 })).toBe(
      MONDAY_STATE,
    );
  });
});

describe("set-brush", () => {
  it("returns the SAME object when the active brush is pressed again", () => {
    // There is no cycle to fall back to (P21), so pressing `preencher` while
    // it is pressed must do nothing at all.
    expect(play(MONDAY_STATE, { type: "set-brush", brush: "fill" })).toBe(
      MONDAY_STATE,
    );
  });

  it("switches what a tap writes", () => {
    const crossing = play(MONDAY_STATE, { type: "set-brush", brush: "cross" });

    expect(crossing.brush).toBe("cross");
    expect(play(crossing, { type: "mark-cell", index: 1 }).entries[1]).toBe(0);
  });
});

describe("select", () => {
  it("returns the SAME object when the caret does not move", () => {
    // Load-bearing rather than a saving: `onFocus` dispatches `select` while
    // the roving-focus layout effect focuses `selected`, so without the
    // bail-out the two trade a render on every arrow key.
    const selected = play(MONDAY_STATE, { type: "select", index: 6 });

    expect(play(selected, { type: "select", index: 6 })).toBe(selected);
    expect(play(selected, { type: "select", index: 7 })).not.toBe(selected);
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

    // Off the top and off the left: clamped per axis, never rolled over.
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

    // The wrap that clamping forbids: from the last column of row 0, one step
    // right stays on row 0 rather than landing on row 1 column 0.
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
    // `Home` and `End` are a full-width clamped move.
    expect(
      play(rowEnd, { type: "move-selection", rows: 0, columns: -4 }).selected,
    ).toBe(0);
  });
});

describe("status and pendingSync", () => {
  it("flips to solved only when the whole picture is painted, crossing nothing", () => {
    const solution = solutionOf(MONDAY_STATE);
    const pictureCells = solution.filter((mark) => mark === 1).length;
    const partial = solution.reduce<NonogramPlayState>(
      (current, mark, index) =>
        mark === 1 && index !== firstPictureCell(MONDAY_STATE)
          ? nonogramPlayReducer(current, { type: "mark-cell", index })
          : current,
      MONDAY_STATE,
    );

    expect(pictureCells).toBeGreaterThan(1);
    expect(partial.status).toBe("playing");
    expect(partial.pendingSync).toBe(false);

    const solved = nonogramPlayReducer(partial, {
      type: "mark-cell",
      index: firstPictureCell(MONDAY_STATE),
    });

    expect(solved.status).toBe("solved");
    expect(solved.pendingSync).toBe(true);
  });

  it("stays playing while a cell outside the picture is painted", () => {
    const solution = solutionOf(MONDAY_STATE);
    const emptyCell = solution.indexOf(0);
    const overpainted = nonogramPlayReducer(fillOnly(MONDAY_STATE), {
      type: "mark-cell",
      index: emptyCell,
    });

    expect(emptyCell).toBeGreaterThanOrEqual(0);
    expect(overpainted.status).toBe("playing");
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
          { type: "mark-cell", index },
        ),
      MONDAY_STATE,
    );

    // ADR-0032: a cross is the player's notation. Three finishes, one
    // completion predicate.
    expect(fillOnly(MONDAY_STATE).status).toBe("solved");
    expect(crossedThrough.status).toBe("solved");
  });

  it("latches pendingSync once, so unpainting a cell cannot un-queue the day", () => {
    const solved = fillOnly(MONDAY_STATE);
    const undone = nonogramPlayReducer(solved, {
      type: "mark-cell",
      index: firstPictureCell(MONDAY_STATE),
    });

    expect(undone.status).toBe("playing");
    expect(undone.pendingSync).toBe(true);
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
    expect(restored.hint).toEqual({ free: 1, used: 1, lastIndex: null });
    expect(restored.hydrated).toBe(true);
    expect(restored.now).toBe(NOW);
  });

  it("discards a record whose size disagrees with today's board", () => {
    // A 25-cell array reaching `derive` on a 225-cell board would find no
    // unpainted picture cell among the 25 it can see, flip `status` to
    // solved on an empty board and write a completion the queue then POSTs
    // (P16/N11). A discarded record is discarded, NEVER migrated.
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

  it("discards a record whose entries length disagrees with today's board", () => {
    // The schema proves `entries.length === size²` for the record's OWN size;
    // only the reducer compares it against today's. Two walls, both cheap.
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
    // Already acknowledged by the server: restoring must not re-queue it.
    expect(restored.pendingSync).toBe(false);
  });
});
