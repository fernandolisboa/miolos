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

export function nextSudokuHint(
  solution: readonly SudokuDigit[],
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): SudokuHint | null {
  const first = nextHint(solution, playableGivens(givens), entries);
  if (first === null) {
    return null;
  }
  if (first.kind === "fill") {
    const step = nextSudokuStep(mergedGrid(givens, entries));
    const value = step === null ? undefined : solution[step.index];
    if (step !== null && value === step.digit) {
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
  const { digit, unit, after } = reason.step;
  if (after === null) {
    return unit === null
      ? copy.nakedSingle(digit)
      : copy.hiddenSingle(unit, digit);
  }
  const technique = copy.technique[after];
  return unit === null
    ? copy.afterNaked(technique, digit)
    : copy.afterHidden(technique, unit, digit);
}
