import { sudokuPeers, type SudokuLayout } from "@miolos/games/sudoku";

import { DIGITS } from "./engine";
import type { SudokuDigit } from "./state";

export const NO_NOTES: readonly number[] = Array.from({ length: 81 }, () => 0);

const bitOf = (digit: number): number => 1 << (digit - 1);

export function hasNote(notes: readonly number[]): boolean {
  return notes.some((mask) => mask !== 0);
}

const NONE: readonly SudokuDigit[] = [];

export function noteDigits(mask: number): readonly SudokuDigit[] {
  return mask === 0
    ? NONE
    : DIGITS.filter((digit) => (mask & bitOf(digit)) !== 0);
}

function withMask(
  notes: readonly number[],
  index: number,
  next: (mask: number) => number,
): readonly number[] {
  const mask = notes[index] ?? 0;
  const changed = next(mask);
  return changed === mask
    ? notes
    : notes.map((current, at) => (at === index ? changed : current));
}

export function toggleNote(
  notes: readonly number[],
  index: number,
  digit: SudokuDigit,
): readonly number[] {
  return withMask(notes, index, (mask) => mask ^ bitOf(digit));
}

export function clearNotes(
  notes: readonly number[],
  index: number,
): readonly number[] {
  return withMask(notes, index, () => 0);
}

export function withoutPeerNote(
  notes: readonly number[],
  index: number,
  digit: SudokuDigit,
  layout: SudokuLayout,
): readonly number[] {
  const peers = new Set(sudokuPeers(index, layout));
  return notes.some((mask, at) => peers.has(at) && (mask & bitOf(digit)) !== 0)
    ? notes.map((mask, at) => (peers.has(at) ? mask & ~bitOf(digit) : mask))
    : notes;
}
