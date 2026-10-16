import {
  nextSudokuStep,
  type SudokuGrid,
  type SudokuLayout,
  type SudokuStep,
} from "@miolos/games/sudoku";

import { messages } from "../i18n";
import {
  nextHint,
  nextLogicalHint,
  toRowColumn,
  type HintReason,
  type LogicalHint,
} from "../play/grid-hint";
import { asDigit, mergedGrid, playableGivens } from "./engine";
import type { SudokuCellValue, SudokuDigit } from "./state";

export type SudokuHintReason = HintReason<SudokuStep>;

export type SudokuHint = LogicalHint<SudokuDigit, SudokuStep>;

const copy = messages.games.sudoku.play.hint;

export type SudokuUnitName = Parameters<typeof copy.hiddenSingle>[0];

type NamedSudokuStep = Omit<SudokuStep, "unit"> & {
  readonly unit: { readonly kind: SudokuUnitName } | null;
};

const SIDE = 9;

export function nextSudokuHint(
  solution: readonly SudokuDigit[],
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
  layout: SudokuLayout,
): SudokuHint | null {
  const first = nextHint(solution, playableGivens(givens), entries);
  return nextLogicalHint(solution, first, () => {
    const step = nextSudokuStep(mergedGrid(givens, entries), layout);
    const value = step === null ? null : asDigit(step.digit);
    return step === null || value === null
      ? null
      : { index: step.index, value, step, cells: step.cells };
  });
}

export function sudokuHintExplanation(
  reason: HintReason<NamedSudokuStep> | null,
  units?: readonly SudokuUnitName[],
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, digit, unit, after } = reason.step;
  const cell = toRowColumn(index, SIDE);
  if (after === null) {
    return unit === null
      ? copy.nakedSingle(digit, cell, units)
      : copy.hiddenSingle(unit.kind, digit, cell);
  }
  const technique = copy.technique[after];
  return unit === null
    ? copy.afterNaked(technique, digit, cell)
    : copy.afterHidden(technique, unit.kind, digit, cell);
}
