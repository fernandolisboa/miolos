import {
  dailyCrosswordResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
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

import { SEVEN_DAILY } from "./crossword-seven";

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
      { type: "type-letter", letter: "c", skipFilled: false },
    );
    expect(state.entries[0]).toBe("c");
    expect(state.selected).toBe(1);
  });

  it("is a no-op while nothing is selected", () => {
    const state = fresh();
    const typed = play(state, {
      type: "type-letter",
      letter: "c",
      skipFilled: false,
    });
    expect(typed).toBe(state);
  });

  it("stops at the entry's end instead of leaving it", () => {
    const state = play(
      fresh(),
      { type: "select", index: 2 },
      { type: "type-letter", letter: "t", skipFilled: false },
    );
    expect(state.entries[2]).toBe("t");
    expect(state.selected).toBe(2);
  });

  it("is a no-op on a block", () => {
    const state = play(fresh(), {
      type: "select",
      index: 3,
    });
    const typed = play(state, {
      type: "type-letter",
      letter: "x",
      skipFilled: false,
    });
    expect(typed).toBe(state);
  });
});

describe("typing with Pular letras já preenchidas (T-WEB-S607)", () => {
  it("moves to the next empty cell, stepping over a filled one", () => {
    const state = play(
      fresh(),
      { type: "select", index: 1 },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c", skipFilled: true },
    );
    expect(state.selected).toBe(2);
  });

  it("overwrites a filled cell it is typed on, then skips forward", () => {
    const state = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "x", skipFilled: false },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c", skipFilled: true },
    );
    expect(state.entries[0]).toBe("c");
    expect(state.selected).toBe(2);
  });

  it("lands on the filled cell when the setting is off", () => {
    const state = play(
      fresh(),
      { type: "select", index: 1 },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c", skipFilled: false },
    );
    expect(state.selected).toBe(1);
  });
});

describe("backspace (T-WEB-S426)", () => {
  it("clears the selected cell when it has a letter", () => {
    const filled = play(
      fresh(),
      { type: "select", index: 0 },
      { type: "type-letter", letter: "c", skipFilled: false },
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
      { type: "type-letter", letter: "c", skipFilled: false },
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
      { type: "type-letter", letter: "c", skipFilled: false },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "type-letter", letter: "t", skipFilled: false },
      { type: "select", index: 5 },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "select", index: 7 },
      { type: "type-letter", letter: "o", skipFilled: false },
    );
    expect(solved.status).toBe("solved");
    expect(solved.pendingSync).toBe(true);
  });

  it("stays playing with a wrong letter", () => {
    const state = play(fresh(), {
      type: "type-letter",
      letter: "x",
      skipFilled: false,
    });
    expect(state.status).toBe("playing");
  });
});

describe("hint (T-WEB-S427)", () => {
  it("fills a letter of the first open pista, stepping over a block before it", () => {
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
    expect(hinted.hint.lastIndex).toBe(2);
    expect(hinted.entries[2]).toBe("t");
    expect(hinted.hint.used).toBe(1);
  });

  it("corrects a wrong letter before filling further", () => {
    const state = play(fresh(), {
      type: "type-letter",
      letter: "x",
      skipFilled: false,
    });
    const hinted = play(
      state,
      { type: "select", index: 0 },
      { type: "use-hint" },
    );
    expect(hinted.hint.lastIndex).toBe(0);
    expect(hinted.entries[0]).toBe("c");
  });
});

describe("the reducer's hints stop at the ceiling (T-WEB-S511c)", () => {
  it("fills a solution letter on each free press", () => {
    let current = fresh();
    for (let press = 1; press <= FREE_HINTS_PER_PUZZLE; press += 1) {
      current = play(current, { type: "use-hint" });

      expect(current.hint.lastIndex).not.toBeNull();
      expect(current.hint.used).toBe(press);
      expect(current.entries[current.hint.lastIndex ?? -1]).toBe(
        current.solution[current.hint.lastIndex ?? -1],
      );
    }
  });

  it("leaves exactly one hint after a restore one short of the ceiling, and the press after it is inert", () => {
    const record: CrosswordPlayRecord = {
      v: 1,
      game: "crossword",
      date: DATE,
      entries: Array<null>(25).fill(null),
      elapsedMs: 0,
      hintsUsed: HINTS_PER_PUZZLE_CEILING - 1,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
    const restored = play(fresh(), { type: "restore", record, now: 1 });
    const last = play(restored, { type: "use-hint" });

    expect(last.hint.used).toBe(HINTS_PER_PUZZLE_CEILING);
    expect(play(last, { type: "use-hint" })).toBe(last);
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

describe("a 7x7 puzzle plays on its own side (T-WEB-S670)", () => {
  const seven = () => initCrosswordPlayState(SEVEN_DAILY);

  it("takes the side from the grid it was given", () => {
    expect(fresh().size).toBe(5);
    expect(seven().size).toBe(7);
    expect(seven().solution).toHaveLength(49);
  });

  it("moves to row 6 and column 6 and clamps at the 7x7 edge", () => {
    const corner = play(
      seven(),
      { type: "select", index: 0 },
      { type: "move-selection", rows: 6, columns: 6 },
    );
    expect(corner.selected).toBe(48);

    expect(
      play(corner, { type: "move-selection", rows: 1, columns: 1 }).selected,
    ).toBe(48);
    expect(
      play(corner, { type: "move-selection", rows: -6, columns: -6 }).selected,
    ).toBe(0);
  });

  it("types down a 7-long entry, a row of 7 cells at a time", () => {
    const typed = play(
      seven(),
      { type: "select-entry", index: 6, direction: "down" },
      { type: "type-letter", letter: "s", skipFilled: false },
    );
    expect(typed.entries[6]).toBe("s");
    expect(typed.selected).toBe(13);
  });

  it("backspaces on an empty cell back along a 7-long down entry", () => {
    const erased = play(
      seven(),
      { type: "select-entry", index: 6, direction: "down" },
      { type: "type-letter", letter: "s", skipFilled: false },
      { type: "type-letter", letter: "a", skipFilled: false },
      { type: "backspace" },
    );
    expect(erased.entries[6]).toBe("s");
    expect(erased.entries[13]).toBeNull();
    expect(erased.entries[20]).toBeNull();
    expect(erased.selected).toBe(13);
  });

  it("toggles direction on cells of row 6 and column 6, and only where the other entry exists", () => {
    const atCorner = play(seven(), {
      type: "select-entry",
      index: 48,
      direction: "down",
    });
    expect(play(atCorner, { type: "toggle-direction" }).direction).toBe(
      "across",
    );

    const lastRow = play(seven(), {
      type: "select-entry",
      index: 42,
      direction: "across",
    });
    expect(play(lastRow, { type: "toggle-direction" }).direction).toBe("down");

    const downOnly = play(seven(), {
      type: "select-entry",
      index: 20,
      direction: "down",
    });
    expect(play(downOnly, { type: "toggle-direction" }).direction).toBe("down");
  });
});
