import { describe, expect, it } from "vitest";

import {
  findQueensViolations,
  isValidQueensSolution,
} from "../../src/queens/index";
import { board, queens } from "./fixtures";

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
