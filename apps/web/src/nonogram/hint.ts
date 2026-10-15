import {
  nextNonogramStep,
  type NonogramClues,
  type NonogramStep,
} from "@miolos/games/nonogram";

import { messages } from "../i18n";
import {
  nextBinaryHint,
  nextLogicalHint,
  toRowColumn,
  type HintReason,
  type Revealed,
} from "../play/grid-hint";
import { cellStateOf } from "./engine";
import type { NonogramCellValue, NonogramMark } from "./state";

export type NonogramHintReason =
  HintReason<NonogramStep> | { readonly kind: "cross" };

const copy = messages.games.nonogram.play.hint.explain;

export function nextNonogramHint(
  clues: NonogramClues,
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Revealed<NonogramMark, NonogramHintReason> | null {
  const hint = nextLogicalHint(
    solution,
    nextBinaryHint(solution, entries),
    () => {
      const step = nextNonogramStep(clues, entries.map(cellStateOf));
      return step === null
        ? null
        : { index: step.index, value: step.value, step, cells: step.cells };
    },
  );
  return hint?.reason.kind === "fill" && hint.value === 0
    ? { ...hint, reason: { kind: "cross" } }
    : hint;
}

export function nonogramHintExplanation(
  size: number,
  reason: NonogramHintReason | null,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, value, line, runs } = reason.step;
  const { row, column } = toRowColumn(index, size);
  return copy.step(
    line.kind,
    line.index + 1,
    runs,
    line.kind === "row" ? column : row,
    value,
  );
}
