import { describe, expect, it } from "vitest";

import { generateQueens, gradeQueens } from "../../src/queens/index";
import { board, queens, randomContiguousMap } from "./fixtures";

const PINNED_SEED = 297;

const PINNED = [
  {
    weekday: 1,
    regions: "0000112 0030111 3431111 3331111 3351111 3331111 3331161",
    solution: "......Q ...Q... .Q..... ....Q.. ..Q.... Q...... .....Q.",
    grade: { solved: true, maxTier: 1, advancedSteps: 0 },
  },
  {
    weekday: 4,
    regions:
      "01111111 01111211 00312211 03322211 33222411 33522467 53525666 55555666",
    solution:
      "...Q.... Q....... ....Q... .Q...... .....Q.. .......Q ..Q..... ......Q.",
    grade: { solved: true, maxTier: 2, advancedSteps: 6 },
  },
  {
    weekday: 7,
    regions:
      "000000011 222001111 222201133 242555555 244555555 667755555 677755855 677775555 666777555",
    solution:
      "...Q..... .....Q... .......Q. Q........ ..Q...... ........Q ......Q.. ....Q.... .Q.......",
    grade: { solved: true, maxTier: 3, advancedSteps: 11 },
  },
] as const;

const RANDOM_MAP_GRADES =
  "x25 x10 x22 x21 x24 x21 x212 x10 x10 x10 x37 x32 x22 x312 x10 x23 s23 x310 x37 x310 x27 x35 x24 x10 " +
  "x22 x24 x27 x10 x10 x38 x21 x27 x10 x24 x23 x22 x23 x35 x24 x34 x10 x313 x10 x22 x21 x10 x22 x25 " +
  "x10 x29 x310 x313 x22 x10 x39 x314 x22 x10 x34 x22 x10 x21 x35 x21 s23 x21 x10 x38 x21 x10 x310 x10 " +
  "x21 x314 x10 x213 x23 x10 x10 x21 x311 x310 x21 x21 x24 x10 x37 x10 x24 x21 x34 x33 x10 x21 x24 x22";

describe("pinned Rainhas generation and grading", () => {
  it.each(PINNED)(
    "generates and grades the literal weekday $weekday puzzle for a fixed seed",
    ({ weekday, regions, solution, grade }) => {
      const puzzle = generateQueens({ seed: PINNED_SEED, weekday });

      expect(puzzle.regions).toEqual(board(regions).regions);
      expect(puzzle.solution).toEqual(queens(solution));
      expect(puzzle.advancedSteps).toBe(grade.advancedSteps);
      expect(gradeQueens(puzzle)).toEqual(grade);
    },
  );

  it("grades 96 random maps, N = 6..9, to the literal solved/tier/steps signature", () => {
    const signature = Array.from({ length: 96 }, (_, seed) => {
      const { solved, maxTier, advancedSteps } = gradeQueens(
        randomContiguousMap(6 + (seed % 4), seed),
      );
      return `${solved ? "s" : "x"}${maxTier}${advancedSteps}`;
    });

    expect(signature.join(" ")).toBe(RANDOM_MAP_GRADES);
  });
});
