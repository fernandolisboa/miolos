import {
  dailyCrosswordResponseSchema,
  type DailyCrosswordResponse,
} from "@miolos/core";
import { describe, expect, it } from "vitest";

import type {
  BinairoPlayRecord,
  CrosswordPlayRecord,
} from "../src/play/play-record";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordPlayAction,
  type CrosswordPlayState,
} from "../src/crossword/state";

const DATE = "2026-08-01";

// row0: c a t # #
// row1: a # o # #
// rows 2-4: all blocks
function daily(): DailyCrosswordResponse {
  return dailyCrosswordResponseSchema.parse({
    game: "crossword",
    date: DATE,
    grid: [
      ["c", "a", "t", null, null],
      ["a", null, "o", null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: [
      {
        number: 1,
        direction: "across",
        row: 0,
        col: 0,
        length: 3,
        clue: "felino",
      },
      {
        number: 1,
        direction: "down",
        row: 0,
        col: 0,
        length: 2,
        clue: "pronome",
      },
      {
        number: 2,
        direction: "down",
        row: 0,
        col: 2,
        length: 2,
        clue: "verbo",
      },
    ],
  });
}

function play(
  state: CrosswordPlayState,
  ...actions: readonly CrosswordPlayAction[]
): CrosswordPlayState {
  return actions.reduce(
    (current, action) => crosswordPlayReducer(current, action),
    state,
  );
}

function fresh(): CrosswordPlayState {
  return initCrosswordPlayState(daily());
}

describe("initial state (T-WEB-S426)", () => {
  it("starts with nothing selected, direction across", () => {
    const state = fresh();
    expect(state.selected).toBeNull();
    expect(state.direction).toBe("across");
    expect(state.status).toBe("playing");
  });
});

describe("select and toggle-direction (T-WEB-S426)", () => {
  it("select moves the caret without changing direction", () => {
    const state = play(fresh(), { type: "select", index: 5 });
    expect(state.selected).toBe(5);
    expect(state.direction).toBe("across");
  });

  it("toggle-direction flips only when the other direction has an entry here", () => {
    const selected = play(fresh(), { type: "select", index: 0 });
    const flipped = play(selected, { type: "toggle-direction" });
    expect(flipped.direction).toBe("down");

    const flippedBack = play(flipped, { type: "toggle-direction" });
    expect(flippedBack.direction).toBe("across");
  });

  it("toggle-direction is a no-op while nothing is selected", () => {
    const toggled = play(fresh(), { type: "toggle-direction" });
    expect(toggled.direction).toBe("across");
  });

  it("toggle-direction is a no-op where the other direction has no entry", () => {
    const state = play(fresh(), { type: "select", index: 1 });
    const toggled = play(state, { type: "toggle-direction" });
    expect(toggled.direction).toBe("across");
  });

  it("select-entry sets both the caret and the direction directly", () => {
    const state = play(fresh(), {
      type: "select-entry",
      index: 2,
      direction: "down",
    });
    expect(state.selected).toBe(2);
    expect(state.direction).toBe("down");
  });
});

describe("typing a letter (T-WEB-S426)", () => {
  it("writes the letter and auto-advances inside the entry", () => {
    const state = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c" },
    );
    expect(state.entries[0]).toBe("c");
    expect(state.selected).toBe(1);
  });

  it("is a no-op while nothing is selected", () => {
    const state = fresh();
    const typed = play(state, { type: "type-letter", letter: "c" });
    expect(typed).toBe(state);
  });

  it("stops at the entry's end instead of leaving it", () => {
    const state = play(
      fresh(),
      { type: "select", index: 2 },
      { type: "type-letter", letter: "t" },
    );
    expect(state.entries[2]).toBe("t");
    expect(state.selected).toBe(2);
  });

  it("is a no-op on a block", () => {
    const state = play(fresh(), {
      type: "select",
      index: 3,
    });
    const typed = play(state, { type: "type-letter", letter: "x" });
    expect(typed).toBe(state);
  });
});

describe("backspace (T-WEB-S426)", () => {
  it("clears the selected cell when it has a letter", () => {
    const filled = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c" },
    );
    const cleared = play(
      filled,
      { type: "select", index: 0 },
      { type: "backspace" },
    );
    expect(cleared.entries[0]).toBeNull();
    expect(cleared.selected).toBe(0);
  });

  it("moves back and clears the previous cell when the current one is already empty", () => {
    const state = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c" },
      { type: "select", index: 1 },
    );
    expect(state.entries[0]).toBe("c");
    const erased = play(state, { type: "backspace" });
    expect(erased.selected).toBe(0);
    expect(erased.entries[0]).toBeNull();
  });

  it("does nothing at the start of the entry", () => {
    const state = play(fresh(), { type: "select", index: 0 });
    const erased = play(state, { type: "backspace" });
    expect(erased).toBe(state);
  });
});

describe("move-selection (T-WEB-S426)", () => {
  it("lands on cell 0 the first time, with nothing yet selected", () => {
    const state = play(fresh(), {
      type: "move-selection",
      rows: 0,
      columns: 1,
    });
    expect(state.selected).toBe(0);
  });

  it("moves the caret and clamps at the grid edges", () => {
    const start = play(fresh(), { type: "select", index: 0 });
    const right = play(start, { type: "move-selection", rows: 0, columns: 1 });
    expect(right.selected).toBe(1);

    const clampedTop = play(start, {
      type: "move-selection",
      rows: -5,
      columns: 0,
    });
    expect(clampedTop.selected).toBe(0);

    const clampedRight = play(start, {
      type: "move-selection",
      rows: 0,
      columns: 99,
    });
    expect(clampedRight.selected).toBe(4);
  });
});

describe("completion (T-WEB-S426)", () => {
  it("is solved once every white cell matches, and marks pendingSync exactly on that transition", () => {
    const solved = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c" },
      { type: "type-letter", letter: "a" },
      { type: "type-letter", letter: "t" },
      { type: "select", index: 5 },
      { type: "type-letter", letter: "a" },
      { type: "select", index: 7 },
      { type: "type-letter", letter: "o" },
    );
    expect(solved.status).toBe("solved");
    expect(solved.pendingSync).toBe(true);
  });

  it("stays playing with a wrong letter", () => {
    const state = play(fresh(), { type: "type-letter", letter: "x" });
    expect(state.status).toBe("playing");
  });
});

describe("hint (T-WEB-S427)", () => {
  it("fills the first empty white cell, row-major, skipping a block before it", () => {
    // Row0's blocks sit AFTER its letters here, so use a grid whose first
    // row-major cell is a block to prove the hint steps over it.
    const withLeadingBlock = dailyCrosswordResponseSchema.parse({
      game: "crossword",
      date: DATE,
      grid: [
        [null, "a", "t", null, null],
        [null, null, "o", null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ],
      clues: [
        {
          number: 1,
          direction: "across",
          row: 0,
          col: 1,
          length: 2,
          clue: "verbo",
        },
        {
          number: 2,
          direction: "down",
          row: 0,
          col: 2,
          length: 2,
          clue: "verbo2",
        },
      ],
    });
    const state = initCrosswordPlayState(withLeadingBlock);
    const hinted = play(state, { type: "use-hint" });
    expect(hinted.hint.lastIndex).toBe(1);
    expect(hinted.entries[1]).toBe("a");
    expect(hinted.hint.used).toBe(1);
  });

  it("corrects a wrong letter before filling further", () => {
    const state = play(fresh(), { type: "type-letter", letter: "x" });
    const hinted = play(
      state,
      { type: "select", index: 0 },
      { type: "use-hint" },
    );
    expect(hinted.hint.lastIndex).toBe(0);
    expect(hinted.entries[0]).toBe("c");
  });

  it("is spent after the one free use", () => {
    const once = play(fresh(), { type: "use-hint" });
    const twice = play(
      once,
      { type: "select", index: 5 },
      { type: "use-hint" },
    );
    expect(twice.hint.used).toBe(1);
    expect(twice.entries[5]).toBeNull();
  });
});

describe("restore (T-WEB-S428)", () => {
  it("hydrates from a matching stored record", () => {
    const record: CrosswordPlayRecord = {
      v: 1,
      game: "crossword",
      date: DATE,
      entries: [
        "c",
        "a",
        "t",
        null,
        null,
        "a",
        null,
        "o",
        null,
        null,
        ...Array<null>(15).fill(null),
      ],
      elapsedMs: 12_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    };
    const state = play(fresh(), { type: "restore", record, now: 1000 });
    expect(state.hydrated).toBe(true);
    expect(state.status).toBe("solved");
    expect(state.timer.accumulatedMs).toBe(12_000);
    expect(state.hint.used).toBe(1);
    expect(state.pendingSync).toBe(false);
  });

  it("hydrates blank when there is no stored record, or it belongs to another game", () => {
    const noRecord = play(fresh(), {
      type: "restore",
      record: undefined,
      now: 1000,
    });
    expect(noRecord.hydrated).toBe(true);
    expect(noRecord.entries.every((entry) => entry === null)).toBe(true);

    const binairoRecord: BinairoPlayRecord = {
      v: 1,
      game: "binairo",
      date: DATE,
      entries: Array<null>(64).fill(null),
      elapsedMs: 12_000,
      hintsUsed: 1,
      concluded: false,
      pendingSync: true,
      syncOutcome: "pending",
    };
    const otherGame = play(fresh(), {
      type: "restore",
      record: binairoRecord,
      now: 1000,
    });
    expect(otherGame.hydrated).toBe(true);
    expect(otherGame.timer.accumulatedMs).toBe(0);
    expect(otherGame.hint.used).toBe(0);
    expect(otherGame.pendingSync).toBe(false);
  });
});
