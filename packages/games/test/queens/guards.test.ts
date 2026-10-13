import { describe, expect, it } from "vitest";

import type { Weekday } from "../../src/index";
import {
  countQueensSolutions,
  findQueensViolations,
  generateQueens,
  gradeQueens,
  isValidQueensSolution,
  nextQueensStep,
  solveQueens,
  validateQueens,
} from "../../src/queens/index";
import type { QueensBoard } from "../../src/queens/index";
import { board, queens } from "./fixtures";

const FOUR = board("0011 0011 2233 2233");
const NO_QUEENS = queens(".... .... .... ....");

describe("weekday guard", () => {
  it("generateQueens and validateQueens throw RangeError outside 1..7", () => {
    const puzzle = generateQueens({ seed: 1, weekday: 1 });
    for (const bad of [0, 8, 2.5].map((day) => day as Weekday)) {
      expect(() => generateQueens({ seed: 1, weekday: bad })).toThrow(
        RangeError,
      );
      expect(() => validateQueens({ ...puzzle, weekday: bad })).toThrow(
        RangeError,
      );
    }
  });
});

describe("board structure guard", () => {
  const malformed: [string, QueensBoard][] = [
    ["size below 4", { size: 3, regions: [0, 0, 0, 1, 1, 1, 2, 2, 2] }],
    [
      "size above 9",
      {
        size: 10,
        regions: Array.from({ length: 100 }, (_, cell) =>
          Math.floor(cell / 10),
        ),
      },
    ],
    ["non-integer size", { size: 4.5, regions: FOUR.regions }],
    ["regions of the wrong length", { size: 4, regions: [0, 1, 2, 3] }],
    [
      "a region id out of range",
      { size: 4, regions: [...FOUR.regions.slice(1), 4] },
    ],
    [
      "a non-integer region id",
      { size: 4, regions: [...FOUR.regions.slice(1), 1.5] },
    ],
  ];

  it.each(malformed)("every entry point throws RangeError on %s", (_, bad) => {
    expect(() => findQueensViolations(bad, NO_QUEENS)).toThrow(RangeError);
    expect(() => isValidQueensSolution(bad, NO_QUEENS)).toThrow(RangeError);
    expect(() => countQueensSolutions(bad)).toThrow(RangeError);
    expect(() => solveQueens(bad)).toThrow(RangeError);
    expect(() => gradeQueens(bad)).toThrow(RangeError);
    expect(() =>
      nextQueensStep(
        bad,
        bad.regions.map(() => null),
      ),
    ).toThrow(RangeError);
  });

  it("nextQueensStep throws RangeError on entries that do not fit the board", () => {
    expect(() => nextQueensStep(FOUR, [null, 1])).toThrow(RangeError);
    const notEntry = FOUR.regions.map((_, cell) => (cell === 0 ? 2 : null));
    expect(() =>
      nextQueensStep(FOUR, notEntry as readonly (0 | 1 | null)[]),
    ).toThrow(RangeError);
  });

  it("the rules throw RangeError on a queens grid that does not fit the board", () => {
    expect(() => findQueensViolations(FOUR, [0, 1])).toThrow(RangeError);
    const notBinary = NO_QUEENS.map((cell, index) => (index === 0 ? 2 : cell));
    expect(() =>
      findQueensViolations(FOUR, notBinary as readonly (0 | 1)[]),
    ).toThrow(RangeError);
  });

  it("countQueensSolutions throws RangeError on a limit below 1", () => {
    expect(() => countQueensSolutions(FOUR, 0)).toThrow(RangeError);
  });
});
