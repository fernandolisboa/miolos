import { CLASSIC_LAYOUT, sudokuPeers } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { noteFocus, selectionHighlights } from "../src/sudoku/highlights";
import { NO_NOTES, toggleNote } from "../src/sudoku/notes";
import type { SudokuDigit } from "../src/sudoku/state";

const BLANK: readonly number[] = Array.from({ length: 81 }, () => 0);

const withValue = (index: number, digit: SudokuDigit) =>
  BLANK.map((cell, at) => (at === index ? digit : cell));

function notesOf(
  ...cells: readonly (readonly [number, SudokuDigit])[]
): readonly number[] {
  return cells.reduce(
    (notes, [index, digit]) => toggleNote(notes, index, digit),
    NO_NOTES,
  );
}

const far = (from: number) =>
  BLANK.findIndex(
    (_cell, index) =>
      index !== from && !sudokuPeers(from, CLASSIC_LAYOUT).includes(index),
  );

describe("notes holding the focus digit get their own lighter highlight (T-WEB-S932)", () => {
  const SELECTED = 40;
  const AWAY = far(SELECTED);
  const PEER = sudokuPeers(SELECTED, CLASSIC_LAYOUT)[0] ?? 0;

  it("marks an empty cell whose notes hold the selected cell's digit, and no other note", () => {
    const grid = withValue(SELECTED, 5);
    const notes = notesOf([AWAY, 5], [AWAY, 2], [AWAY + 1, 3]);
    const highlights = selectionHighlights(
      grid,
      notes,
      SELECTED,
      null,
      CLASSIC_LAYOUT,
    );
    expect(highlights.get(AWAY)).toBe("note-digit");
    expect(highlights.has(AWAY + 1)).toBe(false);
    expect(highlights.get(SELECTED)).toBe("same-digit");
  });

  it("ranks same-digit over note-digit over the unit tint", () => {
    const grid = withValue(SELECTED, 5).map((cell, at) =>
      at === AWAY ? 5 : cell,
    );
    const notes = notesOf([AWAY, 5], [PEER, 5]);
    const highlights = selectionHighlights(
      grid,
      notes,
      SELECTED,
      null,
      CLASSIC_LAYOUT,
    );
    expect(highlights.get(AWAY)).toBe("same-digit");
    expect(highlights.get(PEER)).toBe("note-digit");
  });

  it("follows the fixed digit when the selected cell is empty or nothing is selected", () => {
    const notes = notesOf([AWAY, 7]);
    expect(
      selectionHighlights(BLANK, notes, SELECTED, 7, CLASSIC_LAYOUT).get(AWAY),
    ).toBe("note-digit");
    const unselected = selectionHighlights(
      BLANK,
      notes,
      null,
      7,
      CLASSIC_LAYOUT,
    );
    expect([...unselected]).toEqual([[AWAY, "note-digit"]]);
    expect(noteFocus(withValue(SELECTED, 2), SELECTED, 7)).toBe(2);
  });

  it("leaves the same-digit highlight on the selected cell's digit, never the fixed one", () => {
    const grid = withValue(AWAY, 7);
    const highlights = selectionHighlights(
      grid,
      NO_NOTES,
      SELECTED,
      7,
      CLASSIC_LAYOUT,
    );
    expect(highlights.has(AWAY)).toBe(false);
  });

  it("marks no note with nothing to follow", () => {
    const notes = notesOf([AWAY, 7]);
    expect(
      selectionHighlights(BLANK, notes, SELECTED, null, CLASSIC_LAYOUT).has(
        AWAY,
      ),
    ).toBe(false);
    expect(
      selectionHighlights(BLANK, notes, null, null, CLASSIC_LAYOUT).size,
    ).toBe(0);
  });
});
