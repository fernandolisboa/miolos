import {
  sudokuPeers,
  type SudokuGrid,
  type SudokuLayout,
} from "@miolos/games/sudoku";

import { asDigit } from "./engine";
import { hasNoteDigit } from "./notes";
import type { SudokuDigit } from "./state";

export type CellHighlight = "unit" | "same-digit" | "note-digit";

export function noteFocus(
  grid: SudokuGrid,
  selected: number | null,
  locked: SudokuDigit | null,
): SudokuDigit | null {
  return (selected === null ? null : asDigit(grid[selected])) ?? locked;
}

export function selectionHighlights(
  grid: SudokuGrid,
  notes: readonly number[],
  selected: number | null,
  locked: SudokuDigit | null,
  layout: SudokuLayout,
): ReadonlyMap<number, CellHighlight> {
  const highlights = new Map<number, CellHighlight>();
  const digit = selected === null ? null : asDigit(grid[selected]);
  const noted = noteFocus(grid, selected, locked);
  const reach = new Set(
    selected === null ? [] : [selected, ...sudokuPeers(selected, layout)],
  );
  for (const [index, cell] of grid.entries()) {
    if (digit !== null && cell === digit) {
      highlights.set(index, "same-digit");
    } else if (
      noted !== null &&
      asDigit(cell) === null &&
      hasNoteDigit(notes[index] ?? 0, noted)
    ) {
      highlights.set(index, "note-digit");
    } else if (reach.has(index)) {
      highlights.set(index, "unit");
    }
  }
  return highlights;
}

export function spotlightHighlights(
  cells: readonly number[],
): ReadonlyMap<number, CellHighlight> {
  return new Map(cells.map((index) => [index, "unit"]));
}
