import {
  nextSudokuStep,
  type SudokuGrid,
  type SudokuStep,
} from "@miolos/games/sudoku";

import { messages } from "../i18n";
import {
  nextHint,
  nextLogicalHint,
  type HintReason,
  type LogicalHint,
} from "../play/grid-hint";
import { mergedGrid, playableGivens } from "./engine";
import type { SudokuCellValue, SudokuDigit } from "./state";

export type SudokuHintReason = HintReason<SudokuStep>;

export type SudokuHint = LogicalHint<SudokuDigit, SudokuStep>;

const copy = messages.games.sudoku.play.hint;

const SIDE = 9;

export function nextSudokuHint(
  solution: readonly SudokuDigit[],
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): SudokuHint | null {
  const first = nextHint(solution, playableGivens(givens), entries);
  return nextLogicalHint(solution, first, () => {
    const step = nextSudokuStep(mergedGrid(givens, entries));
    return step === null
      ? null
      : { index: step.index, value: step.digit, step };
  });
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
