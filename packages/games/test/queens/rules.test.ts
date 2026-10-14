import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  findQueensViolations,
  isValidQueensSolution,
  queensAttackedCells,
  queensLineCells,
} from "../../src/queens/index";
import { board, queens, randomContiguousMap } from "./fixtures";

const FIVE = board("00111 00111 22233 24433 44433");
const SOLVED = queens("...Q. Q.... ..Q.. ....Q .Q...");

describe("findQueensViolations", () => {
  it("is clean on an empty board and on a solved one", () => {
    expect(
      findQueensViolations(FIVE, queens("..... ..... ..... ..... .....")),
    ).toEqual([]);
    expect(findQueensViolations(FIVE, SOLVED)).toEqual([]);
  });

  it.each([
    ["a row", "Q...Q ..... ..... ..... .....", [0, 4]],
    ["a column", "Q.... ..... ..... ..... Q....", [0, 20]],
    ["a region", "..... ..... ...Q. ..... ....Q", [13, 24]],
    ["a touch on the diagonal", "..... .Q... ..Q.. ..... .....", [6, 12]],
  ])("names both queens sharing %s", (_, spec, expected) => {
    expect(findQueensViolations(FIVE, queens(spec))).toEqual(expected);
  });

  it("names a queen once however many rules it breaks", () => {
    expect(
      findQueensViolations(FIVE, queens("QQ... Q.... ..... ..... .....")),
    ).toEqual([0, 1, 5]);
  });
});

describe("isValidQueensSolution", () => {
  it("accepts exactly N queens with no violation", () => {
    expect(isValidQueensSolution(FIVE, SOLVED)).toBe(true);
  });

  it("rejects a clean placement that is short of N queens", () => {
    const short = SOLVED.map((cell, index) => (index === 24 - 3 ? 0 : cell));
    expect(findQueensViolations(FIVE, short)).toEqual([]);
    expect(isValidQueensSolution(FIVE, short)).toBe(false);
  });

  it("rejects N queens that break a rule", () => {
    expect(
      isValidQueensSolution(FIVE, queens("Q.... ..Q.. ....Q .Q... ...Q.")),
    ).toBe(false);
  });
});

describe("queensLineCells and queensAttackedCells", () => {
  it("names the row, column and region of a cell, the cell included", () => {
    expect([...queensLineCells(FIVE, 13)].sort((a, b) => a - b)).toEqual([
      3, 8, 10, 11, 12, 13, 14, 18, 19, 23, 24,
    ]);
  });

  it("adds the touching cells and leaves the cell out", () => {
    expect(queensAttackedCells(FIVE, 0)).toEqual([
      1, 2, 3, 4, 5, 6, 10, 15, 20,
    ]);
  });

  it("matches the rules on any board and cell", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(7, 8, 9),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.nat(),
        (size, seed, pick) => {
          const map = randomContiguousMap(size, seed);
          const cell = pick % (size * size);
          const row = (at: number) => Math.floor(at / size);
          const column = (at: number) => at % size;
          const sharesLine = (other: number) =>
            row(other) === row(cell) ||
            column(other) === column(cell) ||
            map.regions[other] === map.regions[cell];
          const touches = (other: number) =>
            Math.abs(row(other) - row(cell)) <= 1 &&
            Math.abs(column(other) - column(cell)) <= 1;
          const all = map.regions.map((_region, at) => at);

          expect(new Set(queensLineCells(map, cell))).toEqual(
            new Set(all.filter(sharesLine)),
          );
          expect(queensAttackedCells(map, cell)).toEqual(
            all.filter(
              (other) =>
                other !== cell && (sharesLine(other) || touches(other)),
            ),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
