import { describe, expect, it } from "vitest";

import * as root from "../../src/index";
import { WEEKDAYS } from "../../src/index";
import {
  SUDOKU_TIER_CRITERIA,
  SUDOKU_WEEKDAY_CRITERIA,
  sudokuCriteriaForWeekday,
  type Weekday,
} from "../../src/sudoku/index";

describe("SUDOKU_WEEKDAY_CRITERIA", () => {
  it("is keyed by exactly the ISO weekdays 1-7", () => {
    expect(
      Object.keys(SUDOKU_WEEKDAY_CRITERIA)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([...WEEKDAYS]);
  });

  it("ramps Monday (1, easiest) to Sunday (7, hardest): tiers 1,2,2,3,3,4,5", () => {
    const tiers = WEEKDAYS.map((w) => SUDOKU_WEEKDAY_CRITERIA[w].tier);
    expect(tiers).toEqual([1, 2, 2, 3, 3, 4, 5]);
    for (let i = 1; i < tiers.length; i += 1) {
      expect(tiers[i]!).toBeGreaterThanOrEqual(tiers[i - 1]!);
    }
    expect(SUDOKU_WEEKDAY_CRITERIA[1].tier).toBe(1);
    expect(SUDOKU_WEEKDAY_CRITERIA[7].tier).toBe(5);
  });

  it("maps every weekday to the canonical tier criteria object", () => {
    expect(SUDOKU_WEEKDAY_CRITERIA[1]).toBe(SUDOKU_TIER_CRITERIA[1]);
    expect(SUDOKU_WEEKDAY_CRITERIA[2]).toBe(SUDOKU_TIER_CRITERIA[2]);
    expect(SUDOKU_WEEKDAY_CRITERIA[3]).toBe(SUDOKU_TIER_CRITERIA[2]);
    expect(SUDOKU_WEEKDAY_CRITERIA[4]).toBe(SUDOKU_TIER_CRITERIA[3]);
    expect(SUDOKU_WEEKDAY_CRITERIA[5]).toBe(SUDOKU_TIER_CRITERIA[3]);
    expect(SUDOKU_WEEKDAY_CRITERIA[6]).toBe(SUDOKU_TIER_CRITERIA[4]);
    expect(SUDOKU_WEEKDAY_CRITERIA[7]).toBe(SUDOKU_TIER_CRITERIA[5]);
  });

  it("keeps every clue band within 17 <= min <= max <= 81", () => {
    const entries = [
      ...Object.values(SUDOKU_TIER_CRITERIA),
      ...Object.values(SUDOKU_WEEKDAY_CRITERIA),
    ];
    for (const criteria of entries) {
      expect(criteria.minClues).toBeGreaterThanOrEqual(17);
      expect(criteria.maxClues).toBeGreaterThanOrEqual(criteria.minClues);
      expect(criteria.maxClues).toBeLessThanOrEqual(81);
    }
  });

  it("sudokuCriteriaForWeekday validates its input (getDay() 0 rejects)", () => {
    expect(sudokuCriteriaForWeekday(1)).toBe(SUDOKU_TIER_CRITERIA[1]);
    expect(sudokuCriteriaForWeekday(7)).toBe(SUDOKU_TIER_CRITERIA[5]);
    expect(() => sudokuCriteriaForWeekday(0 as Weekday)).toThrow(RangeError);
    expect(() => sudokuCriteriaForWeekday(8 as Weekday)).toThrow(RangeError);
    expect(() => sudokuCriteriaForWeekday(1.5 as Weekday)).toThrow(RangeError);
  });
});

describe("root barrel stays substrate-only (code-splitting guard)", () => {
  it("re-exports the weekday substrate but no game module", () => {
    expect("WEEKDAYS" in root).toBe(true);
    expect("generateSudoku" in root).toBe(false);
  });
});
