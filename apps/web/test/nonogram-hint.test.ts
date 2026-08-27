import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import {
  generateNonogram,
  type NonogramPuzzle,
  type Weekday,
} from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import {
  hintKindOf,
  nextNonogramHint,
  solutionMarks,
} from "../src/nonogram/engine";
import { nextHint } from "../src/play/grid-hint";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramCellValue,
  type NonogramMark,
  type NonogramPlayState,
} from "../src/nonogram/state";

const DATE = "2026-08-01";

const SEEDS: readonly number[] = Array.from(
  { length: 40 },
  (_unused, index) => ((index + 1) * 2_654_435_761) >>> 0,
);

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

interface Board {
  readonly puzzle: NonogramPuzzle;
  readonly solution: readonly NonogramMark[];
  readonly empty: readonly NonogramCellValue[];
}

function daily(puzzle: NonogramPuzzle): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

function board(seed: number, weekday: Weekday): Board {
  const puzzle = generateNonogram(seed, weekday);
  const solution = solutionMarks(daily(puzzle).clues);
  if (solution === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return {
    puzzle,
    solution,
    empty: solution.map(() => null),
  };
}

const BOARDS: readonly Board[] = WEEKDAYS.flatMap((weekday) =>
  SEEDS.map((seed) => board(seed, weekday)),
);

function pictureIndices(solution: readonly NonogramMark[]): readonly number[] {
  return solution.flatMap((mark, index) => (mark === 1 ? [index] : []));
}

function halfPainted(
  solution: readonly NonogramMark[],
): readonly NonogramCellValue[] {
  const indices = pictureIndices(solution);
  const painted = new Set(indices.slice(0, Math.floor(indices.length / 2)));
  return solution.map((_mark, index) => (painted.has(index) ? 1 : null));
}

function fullyCrossed(
  solution: readonly NonogramMark[],
): readonly NonogramCellValue[] {
  return solution.map((mark) => (mark === 1 ? null : 0));
}

describe("the encoding tripwire (N9)", () => {
  it("never reads a correctly CROSSED cell as a contradiction, on any of the 280 boards", () => {
    const corrections = BOARDS.filter((current) => {
      const hint = nextNonogramHint(
        current.solution,
        fullyCrossed(current.solution),
      );
      return hint?.kind === "correction";
    });

    expect(BOARDS).toHaveLength(280);
    expect(corrections).toHaveLength(0);
  });

  it("hands a fully-crossed board a FILL on a picture cell", () => {
    for (const current of BOARDS) {
      const hint = nextNonogramHint(
        current.solution,
        fullyCrossed(current.solution),
      );

      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);
    }
  });
});

describe("the corrections", () => {
  it("corrects a wrongly FILLED cell to 0", () => {
    for (const current of BOARDS) {
      const wrong = current.solution.indexOf(0);
      const entries = current.empty.map((cell, index) =>
        index === wrong ? 1 : cell,
      );
      const hint = nextNonogramHint(current.solution, entries);

      expect(wrong).toBeGreaterThanOrEqual(0);
      expect(hint).toEqual({ index: wrong, value: 0, kind: "correction" });
    }
  });

  it("corrects a wrongly CROSSED cell to 1", () => {
    for (const current of BOARDS) {
      const wrong = current.solution.indexOf(1);
      const entries = current.empty.map((cell, index) =>
        index === wrong ? 0 : cell,
      );
      const hint = nextNonogramHint(current.solution, entries);

      expect(wrong).toBeGreaterThanOrEqual(0);
      expect(hint).toEqual({ index: wrong, value: 1, kind: "correction" });
    }
  });

  it("puts a contradiction ahead of an empty cell, deterministically", () => {
    const first = BOARDS[0];
    if (first === undefined) {
      throw new Error("the harness generates 280 boards");
    }
    const wrong = first.solution.lastIndexOf(0);
    const entries = first.empty.map((cell, index) =>
      index === wrong ? 1 : cell,
    );

    expect(nextNonogramHint(first.solution, entries)?.kind).toBe("correction");
    expect(nextNonogramHint(first.solution, entries)).toEqual(
      nextNonogramHint(first.solution, entries),
    );
  });
});

describe("the second pass (P17)", () => {
  it("is REQUIRED: the plain fill branch returns a cross on 239 of the 280 fresh boards", () => {
    const crosses = BOARDS.filter((current) => {
      const plain = nextHint<NonogramMark>(
        current.solution,
        current.solution.map(() => null),
        current.empty,
      );
      return plain?.value === 0;
    });

    expect(crosses).toHaveLength(239);
  });

  it("lands on a picture cell on every fresh board", () => {
    for (const current of BOARDS) {
      const hint = nextNonogramHint(current.solution, current.empty);

      expect(hint?.kind).toBe("fill");
      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);
    }
  });

  it("lands on an UNDECIDED picture cell on every half-painted board", () => {
    for (const current of BOARDS) {
      const entries = halfPainted(current.solution);
      const hint = nextNonogramHint(current.solution, entries);

      expect(hint?.kind).toBe("fill");
      expect(hint?.value).toBe(1);
      expect(current.solution[hint?.index ?? -1]).toBe(1);

      expect(entries[hint?.index ?? -1]).toBeNull();
    }
  });

  it("returns null only once EVERY cell is decided and correct", () => {
    for (const current of BOARDS) {
      const decided = current.solution.map((mark) => mark);

      expect(nextNonogramHint(current.solution, decided)).toBeNull();
    }
  });

  it("falls back to pass 1's cross exactly where `use-hint` has already refused", () => {
    for (const current of BOARDS) {
      const painted = current.solution.map((mark) => (mark === 1 ? 1 : null));
      const hint = nextNonogramHint(current.solution, painted);

      expect(hint?.value).toBe(0);
      expect(hintKindOf(hint ?? { index: 0, value: 1, kind: "fill" })).toBe(
        "cross",
      );
    }
  });
});

describe("hintKindOf", () => {
  it("separates a correction, a fill and a cross", () => {
    expect(hintKindOf({ index: 0, value: 1, kind: "correction" })).toBe(
      "correction",
    );
    expect(hintKindOf({ index: 0, value: 0, kind: "correction" })).toBe(
      "correction",
    );
    expect(hintKindOf({ index: 0, value: 1, kind: "fill" })).toBe("fill");
    expect(hintKindOf({ index: 0, value: 0, kind: "fill" })).toBe("cross");
  });
});

describe("the reducer's accounting", () => {
  const STATE: NonogramPlayState = initNonogramPlayState(
    daily(generateNonogram(20_260_801, 1)),
  );

  function solutionOf(state: NonogramPlayState): readonly NonogramMark[] {
    if (state.solution === null) {
      throw new Error("a published daily solves by construction");
    }
    return state.solution;
  }

  it("reveals one cell, spends the free hint and leaves the caret alone", () => {
    const selected = nonogramPlayReducer(STATE, { type: "select", index: 24 });
    const hinted = nonogramPlayReducer(selected, { type: "use-hint" });

    expect(hinted.hint.used).toBe(1);
    expect(hinted.hint.lastIndex).not.toBeNull();
    expect(hinted.entries[hinted.hint.lastIndex ?? -1]).toBe(1);

    expect(hinted.selected).toBe(24);

    expect(nonogramPlayReducer(hinted, { type: "use-hint" })).toBe(hinted);
    expect(hinted.hint.free).toBe(1);
  });

  it("drops the ring when the player writes the hinted cell again (T-WEB-S58)", () => {
    const hinted = nonogramPlayReducer(STATE, { type: "use-hint" });
    const index = hinted.hint.lastIndex ?? -1;
    expect(hinted.entries[index]).toBe(1);

    const cleared = nonogramPlayReducer(hinted, { type: "mark-cell", index });
    expect(cleared.entries[index]).toBeNull();
    expect(cleared.hint.lastIndex).toBeNull();

    expect(cleared.hint).toEqual({ free: 1, used: 1, lastIndex: null });

    const selected = nonogramPlayReducer(hinted, { type: "select", index });
    const overridden = nonogramPlayReducer(selected, {
      type: "enter-value",
      value: 0,
    });
    expect(overridden.entries[index]).toBe(0);
    expect(overridden.hint.lastIndex).toBeNull();

    const elsewhere = nonogramPlayReducer(hinted, {
      type: "mark-cell",
      index: index === 0 ? 1 : 0,
    });
    expect(elsewhere.hint.lastIndex).toBe(index);
  });

  it("is a no-op once the board is closed", () => {
    const solved = solutionOf(STATE).reduce<NonogramPlayState>(
      (current, mark, index) =>
        mark === 1
          ? nonogramPlayReducer(current, { type: "mark-cell", index })
          : current,
      STATE,
    );

    expect(solved.status).toBe("solved");
    expect(nonogramPlayReducer(solved, { type: "use-hint" })).toBe(solved);
  });
});
