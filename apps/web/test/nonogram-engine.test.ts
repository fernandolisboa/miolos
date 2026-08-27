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

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const DATE = "2026-08-01";

const PUZZLES: readonly NonogramPuzzle[] = WEEKDAYS.map((weekday) =>
  generateNonogram(20_260_801, weekday),
);

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

function pictureOf(puzzle: NonogramPuzzle): readonly NonogramMark[] {
  return puzzle.reveal.solution.flatMap((row) =>
    row.map((filled): NonogramMark => (filled ? 1 : 0)),
  );
}

function solutionOf(puzzle: NonogramPuzzle): readonly NonogramMark[] {
  const marks = solutionMarks(daily(puzzle).clues);
  if (marks === null) {
    throw new Error(
      "a published daily is line-solvable to the exact bitmap by construction",
    );
  }
  return marks;
}

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

      expect(marks).toEqual(pictureOf(puzzle));
    }
  });

  it("returns null rather than throwing for malformed clues", () => {
    const jagged: NonogramClues = { size: 5, rows: [[1]], cols: [] };

    expect(() => solveNonogram(jagged)).toThrow(RangeError);
    expect(solutionMarks(jagged)).toBeNull();
  });

  it("returns null when the clues contradict each other", () => {
    const contradictory: NonogramClues = {
      size: 2,
      rows: [[2], [2]],
      cols: [[1], [1]],
    };

    expect(solveNonogram(contradictory).status).toBe("contradiction");
    expect(solutionMarks(contradictory)).toBeNull();
  });

  it("returns null when line solving leaves a cell unknown", () => {
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

      expect(target).toBe(
        pictureOf(puzzle).filter((mark) => mark === 1).length,
      );
      expect(target).toBeGreaterThan(0);
    }
  });
});

describe("countFilledCells", () => {
  it("counts painted cells only — a cross and an empty cell both count zero", () => {
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
    expect(submittedCells([1, 0, null, 1], 4)).toEqual([1, 0, 0, 1]);
  });

  it("returns null when the board is not exactly the expected cell count", () => {
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
