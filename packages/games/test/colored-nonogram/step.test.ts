import { describe, expect, it } from "vitest";

import { deriveColoredClues } from "../../src/colored-nonogram/clues";
import { nextColoredStep } from "../../src/colored-nonogram/step";
import { COLORED_SIZES, poolIds, variantPuzzle } from "./fixtures";

const clues = deriveColoredClues(3, ["r..", "...", "bbb"].join(""));
const blank = (): (number | null)[] => new Array<number | null>(9).fill(null);

describe("nextColoredStep", () => {
  it("names a tone a later line fixes before a cross an earlier line fixes", () => {
    expect(nextColoredStep(clues, blank())).toEqual({
      index: 6,
      value: 2,
      line: { kind: "row", index: 2 },
      runs: [{ tone: 2, length: 3 }],
      cells: [6, 7, 8],
    });
  });

  it("names a cross when no line fixes a tone", () => {
    const marks = blank();
    marks.splice(6, 3, 2, 2, 2);

    expect(nextColoredStep(clues, marks)).toMatchObject({
      index: 3,
      value: 0,
    });
  });

  it("returns null when a mark contradicts the números", () => {
    const marks = blank();
    marks[6] = 1;

    expect(nextColoredStep(clues, marks)).toBeNull();
  });

  it("always agrees with the solution, step after step, until every pool picture is done", () => {
    for (const id of COLORED_SIZES.flatMap(poolIds)) {
      const { clues: puzzleClues, solution } = variantPuzzle(id);
      const marks = solution.map((): number | null => null);
      for (
        let step = nextColoredStep(puzzleClues, marks);
        step !== null;
        step = nextColoredStep(puzzleClues, marks)
      ) {
        expect(step.value, id).toBe(solution[step.index]);
        marks[step.index] = step.value;
      }
      expect(marks, id).toEqual(solution);
    }
  });
});
