import {
  nextSudokuStep,
  type SudokuGrid,
  type SudokuStep,
} from "@miolos/games/sudoku";

import { messages } from "../i18n";
import { nextHint } from "../play/grid-hint";
import { mergedGrid, playableGivens } from "./engine";
import type { SudokuCellValue, SudokuDigit } from "./state";

export type SudokuHintReason =
  | { readonly kind: "correction" | "fill" }
  | { readonly kind: "step"; readonly step: SudokuStep };

export interface SudokuHint {
  readonly index: number;
  readonly value: SudokuDigit;
  readonly reason: SudokuHintReason;
}

const copy = messages.games.sudoku.play.hint;

const SIDE = 9;

export function nextSudokuHint(
  solution: readonly SudokuDigit[],
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): SudokuHint | null {
  const first = nextHint(solution, playableGivens(givens), entries);
  if (first === null) {
    return null;
  }
  const step =
    first.kind === "fill" ? nextSudokuStep(mergedGrid(givens, entries)) : null;
  if (step !== null) {
    const value = solution[step.index];
    if (value === step.digit) {
      return { index: step.index, value, reason: { kind: "step", step } };
    }
  }
  return {
    index: first.index,
    value: first.value,
    reason: { kind: first.kind },
  };
}

export function sudokuHintExplanation(
  reason: SudokuHintReason | null,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, digit, unit, after } = reason.step;
  const cell = {
    row: Math.floor(index / SIDE) + 1,
    column: (index % SIDE) + 1,
  };
  if (after === null) {
    return unit === null
      ? copy.nakedSingle(digit, cell)
      : copy.hiddenSingle(unit.kind, digit, cell);
  }
  const technique = copy.technique[after];
  return unit === null
    ? copy.afterNaked(technique, digit, cell)
    : copy.afterHidden(technique, unit.kind, digit, cell);
}
