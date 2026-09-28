import { CROSSWORD_LEXICON } from "./lexicon.generated";
import { deriveSlots, slotCells } from "./slots";
import { CROSSWORD_SIZE } from "./templates";
import type {
  CrosswordEntry,
  CrosswordGrid,
  CrosswordPuzzle,
  CrosswordRejectionReason,
  CrosswordSlot,
  CrosswordValidationResult,
} from "./types";

const MIN_ENTRY_LENGTH = 3;

function isWellShaped(grid: CrosswordGrid): boolean {
  return (
    grid.length === CROSSWORD_SIZE &&
    grid.every(
      (row) =>
        row.length === CROSSWORD_SIZE &&
        row.every((cell) => cell === null || /^[a-z]$/.test(cell)),
    )
  );
}

function sameSlot(slot: CrosswordSlot, entry: CrosswordEntry | undefined) {
  return (
    entry !== undefined &&
    entry.number === slot.number &&
    entry.direction === slot.direction &&
    entry.row === slot.row &&
    entry.col === slot.col &&
    entry.normalized.length === slot.length
  );
}

function isWhite(grid: CrosswordGrid, row: number, col: number): boolean {
  return typeof grid[row]?.[col] === "string";
}

function hasUncheckedCell(grid: CrosswordGrid): boolean {
  return grid.some((cells, row) =>
    cells.some(
      (cell, col) =>
        cell !== null &&
        !(
          (isWhite(grid, row, col - 1) || isWhite(grid, row, col + 1)) &&
          (isWhite(grid, row - 1, col) || isWhite(grid, row + 1, col))
        ),
    ),
  );
}

function spellsEntry(grid: CrosswordGrid, entry: CrosswordEntry): boolean {
  return slotCells(entry, entry.normalized.length).every(
    ([row, col], k) => grid[row]?.[col] === entry.normalized[k],
  );
}

function isLexiconRow(entry: CrosswordEntry): boolean {
  return CROSSWORD_LEXICON.some(
    (row) =>
      row.normalized === entry.normalized &&
      row.canonical === entry.canonical &&
      row.clue === entry.clue,
  );
}

export function validateCrossword(
  puzzle: CrosswordPuzzle,
): CrosswordValidationResult {
  const { grid, entries } = puzzle;
  if (!isWellShaped(grid)) {
    return { ok: false, failures: ["grid-shape"] };
  }
  const failures: CrosswordRejectionReason[] = [];
  const slots = deriveSlots(
    grid.map((row) => row.map((cell) => cell === null)),
  );

  if (
    entries.length !== slots.length ||
    !slots.every((slot, index) => sameSlot(slot, entries[index]))
  ) {
    failures.push("entries-mismatch");
  }
  if (slots.some((slot) => slot.length < MIN_ENTRY_LENGTH)) {
    failures.push("entry-too-short");
  }
  if (hasUncheckedCell(grid)) {
    failures.push("unchecked-cell");
  }
  if (!entries.every((entry) => spellsEntry(grid, entry))) {
    failures.push("letters-mismatch");
  }
  if (!entries.every(isLexiconRow)) {
    failures.push("not-in-lexicon");
  }
  if (
    new Set(entries.map((entry) => entry.normalized)).size !== entries.length
  ) {
    failures.push("duplicate-word");
  }
  return { ok: failures.length === 0, failures };
}
