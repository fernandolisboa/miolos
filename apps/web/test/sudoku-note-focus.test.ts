import { describe, expect, it } from "vitest";

import { noteFocus } from "../src/sudoku/notes";
import type { SudokuDigit } from "../src/sudoku/state";

const BLANK: readonly number[] = Array.from({ length: 81 }, () => 0);
const SELECTED = 40;

const withValue = (index: number, digit: SudokuDigit) =>
  BLANK.map((cell, at) => (at === index ? digit : cell));

describe("the note highlight follows the selected value, else the locked digit (T-WEB-S932)", () => {
  it("takes the selected cell's digit, given or entered, over the locked one", () => {
    expect(noteFocus(withValue(SELECTED, 2), SELECTED, 7)).toBe(2);
    expect(noteFocus(withValue(SELECTED, 2), SELECTED, null)).toBe(2);
  });

  it("falls back to the locked digit on an empty selected cell or with nothing selected", () => {
    expect(noteFocus(BLANK, SELECTED, 7)).toBe(7);
    expect(noteFocus(BLANK, null, 7)).toBe(7);
  });

  it("has nothing to follow with an empty selection and no locked digit", () => {
    expect(noteFocus(BLANK, SELECTED, null)).toBeNull();
    expect(noteFocus(withValue(SELECTED, 2), null, null)).toBeNull();
  });
});
