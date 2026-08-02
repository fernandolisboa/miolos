import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import {
  generateNonogram,
  solveNonogram,
  type NonogramClues,
  type NonogramPuzzle,
  type Weekday,
} from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import {
  countFilledCells,
  filledTarget,
  isPictureComplete,
  solutionMarks,
  submittedCells,
} from "../src/nonogram/engine";
import type { NonogramCellValue, NonogramMark } from "../src/nonogram/state";

// T-WEB-S35 (plan 020 §19). `engine.ts` is the ONE conversion boundary
// between `@miolos/games/nonogram` and the client's cells (§10.2): the
// engine speaks `NonogramCellState[][]` and `boolean[][]`, the client speaks
// a flat `(0 | 1 | null)[]` where 1 = preenchida, 0 = marcada and null =
// vazia (P11). Everything here is pure — no React, no DOM, no clock.

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const DATE = "2026-08-01";

/**
 * One puzzle per weekday, so every size class (5/8/10/15) is exercised.
 * Pinned in-file so a failure is reproducible from the source alone —
 * never a clock and never a random draw.
 */
const PUZZLES: readonly NonogramPuzzle[] = WEEKDAYS.map((weekday) =>
  generateNonogram(20_260_801, weekday),
);

/** Weekday 1 is the 5×5 class, weekday 7 the 15×15 one (difficulty.ts:31-41). */
const MONDAY = generateNonogram(20_260_801, 1);
const SUNDAY = generateNonogram(20_260_801, 7);

/**
 * The wire projection, parsed rather than cast: `{game, date, size, clues}`
 * is all the client ever sees (ADR-0033), and the engine adapter must work
 * from exactly that.
 */
function daily(puzzle: NonogramPuzzle): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

/** The motif's bitmap, flattened row-major — the picture the clues encode. */
function pictureOf(puzzle: NonogramPuzzle): readonly NonogramMark[] {
  return puzzle.reveal.solution.flatMap((row) =>
    row.map((filled): NonogramMark => (filled ? 1 : 0)),
  );
}

/**
 * The recovered picture, narrowed by a throw rather than by a cast: every
 * published daily is line-solvable to the exact bitmap by construction
 * (ADR-0021 decision 3), so the throw is unreachable and says so.
 */
function solutionOf(puzzle: NonogramPuzzle): readonly NonogramMark[] {
  const marks = solutionMarks(daily(puzzle).clues);
  if (marks === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return marks;
}

/** A board where every picture cell is painted and nothing is crossed. */
function fillOnlyBoard(
  solution: readonly NonogramMark[],
): readonly NonogramCellValue[] {
  return solution.map((mark) => (mark === 1 ? 1 : null));
}

describe("solutionMarks", () => {
  it("recovers size² marks from the published clues on every weekday", () => {
    for (const puzzle of PUZZLES) {
      const marks = solutionMarks(daily(puzzle).clues);

      expect(marks).toHaveLength(puzzle.size ** 2);
      // The exact bitmap, not merely a consistent one: ADR-0021 decision 3
      // makes that a binary mechanical gate over every shipped motif.
      expect(marks).toEqual(pictureOf(puzzle));
    }
  });

  it("returns null rather than throwing for malformed clues", () => {
    // `solveNonogram` raises a typed RangeError on jagged clue lists
    // (solve.ts:199-203). The screen may not crash on it: the null branch is
    // DEFINED, not assumed away (landmine 8) — it renders the unavailable
    // card (§10.4).
    const jagged: NonogramClues = { size: 5, rows: [[1]], cols: [] };

    expect(() => solveNonogram(jagged)).toThrow(RangeError);
    expect(solutionMarks(jagged)).toBeNull();
  });

  it("returns null when the clues contradict each other", () => {
    // Two full rows against two one-cell columns: no bitmap satisfies both.
    const contradictory: NonogramClues = {
      size: 2,
      rows: [[2], [2]],
      cols: [[1], [1]],
    };

    expect(solveNonogram(contradictory).status).toBe("contradiction");
    expect(solutionMarks(contradictory)).toBeNull();
  });

  it("returns null when line solving leaves a cell unknown", () => {
    // A 2×2 with one filled cell per line has two solutions, so the line
    // solver stalls with `unknown` cells — and an `unknown` may never be
    // guessed at into a mark.
    const ambiguous: NonogramClues = {
      size: 2,
      rows: [[1], [1]],
      cols: [[1], [1]],
    };

    expect(solveNonogram(ambiguous).status).toBe("stuck");
    expect(solutionMarks(ambiguous)).toBeNull();
  });
});

describe("filledTarget", () => {
  it("sums the row runs and equals the picture's filled count on every weekday", () => {
    for (const puzzle of PUZZLES) {
      const target = filledTarget(daily(puzzle).clues);

      // The readout's denominator comes from the CLUES — public, solve-free,
      // and a number the player can add up themselves (§10.2).
      expect(target).toBe(
        pictureOf(puzzle).filter((mark) => mark === 1).length,
      );
      expect(target).toBeGreaterThan(0);
    }
  });
});

describe("countFilledCells", () => {
  it("counts painted cells only — a cross and an empty cell both count zero", () => {
    // P13/P14: the shared `countFilled` computes the OTHER readout, because
    // `0` is not nullish. This is the whole reason Nonogram has its own.
    expect(countFilledCells([1, 0, null, 1, 0, null])).toBe(2);
    expect(countFilledCells([0, 0, 0, 0])).toBe(0);
    expect(countFilledCells([null, null])).toBe(0);
    expect(countFilledCells([])).toBe(0);
  });
});

describe("isPictureComplete", () => {
  it("is true for a fill-only board — crossing is never required to finish", () => {
    for (const puzzle of PUZZLES) {
      const solution = solutionOf(puzzle);

      expect(isPictureComplete(solution, fillOnlyBoard(solution))).toBe(true);
    }
  });

  it("is true when every empty cell is crossed as well, the same finish either way", () => {
    const solution = solutionOf(MONDAY);
    const crossed: readonly NonogramCellValue[] = solution.map((mark) =>
      mark === 1 ? 1 : 0,
    );

    expect(isPictureComplete(solution, crossed)).toBe(true);
  });

  it("is false while one picture cell is still unpainted", () => {
    for (const puzzle of PUZZLES) {
      const solution = solutionOf(puzzle);
      const firstPicture = solution.indexOf(1);
      const missing = fillOnlyBoard(solution).map((cell, index) =>
        index === firstPicture ? null : cell,
      );

      expect(firstPicture).toBeGreaterThanOrEqual(0);
      expect(isPictureComplete(solution, missing)).toBe(false);
    }
  });

  it("is false when a cell outside the picture is painted", () => {
    const solution = solutionOf(MONDAY);
    const firstEmpty = solution.indexOf(0);
    const overpainted = fillOnlyBoard(solution).map((cell, index) =>
      index === firstEmpty ? 1 : cell,
    );

    expect(firstEmpty).toBeGreaterThanOrEqual(0);
    expect(isPictureComplete(solution, overpainted)).toBe(false);
  });

  it("fails closed on a short entries array, because it iterates the SOLUTION", () => {
    expect(isPictureComplete(solutionOf(SUNDAY), [])).toBe(false);
  });
});

describe("submittedCells", () => {
  it("maps a cross and an empty cell alike to 0, so all three finishes post the same body", () => {
    // ADR-0032: a cross is the player's notation and never crosses the wire.
    expect(submittedCells([1, 0, null, 1], 4)).toEqual([1, 0, 0, 1]);
  });

  it("returns null when the board is not exactly the expected cell count", () => {
    // The only place that can prove the array's length before the record is
    // built — the completion contract accepts one of four lengths, so a
    // wrong one would be a 422 the queue then settles as rejected.
    expect(submittedCells([1, 0, null], 4)).toBeNull();
    expect(submittedCells([1, 0, null, 1, 1], 4)).toBeNull();
  });

  it("produces the picture itself for a finished board on every weekday", () => {
    for (const puzzle of PUZZLES) {
      const solution = solutionOf(puzzle);

      expect(submittedCells(fillOnlyBoard(solution), puzzle.size ** 2)).toEqual(
        [...solution],
      );
    }
  });
});
