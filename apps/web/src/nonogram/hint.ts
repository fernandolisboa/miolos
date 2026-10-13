import {
  nextNonogramStep,
  type NonogramCellState,
  type NonogramClues,
  type NonogramStep,
} from "@miolos/games/nonogram";

import { messages } from "../i18n";
import {
  nextBinaryHint,
  nextLogicalHint,
  type HintReason,
  type Revealed,
} from "../play/grid-hint";
import type { NonogramCellValue, NonogramMark } from "./state";

export type NonogramHintReason =
  HintReason<NonogramStep> | { readonly kind: "cross" };

const copy = messages.games.nonogram.play.hint.explain;

function stateOf(entry: NonogramCellValue): NonogramCellState {
  return entry === null ? "unknown" : entry === 1 ? "filled" : "empty";
}

export function nextNonogramHint(
  clues: NonogramClues,
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Revealed<NonogramMark, NonogramHintReason> | null {
  const hint = nextLogicalHint(
    solution,
    nextBinaryHint(solution, entries),
    () => {
      const step = nextNonogramStep(clues, entries.map(stateOf));
      return step === null
        ? null
        : { index: step.index, value: step.value, step };
    },
  );
  if (hint === null) {
    return null;
  }
  if (hint.reason.kind === "step") {
    return { ...hint, spotlight: hint.reason.step.cells };
  }
  return hint.reason.kind === "fill" && hint.value === 0
    ? { ...hint, reason: { kind: "cross" } }
    : hint;
}

export function nonogramHintExplanation(
  reason: NonogramHintReason | null,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, value, line, runs, cells } = reason.step;
  return copy.step(
    line.kind,
    line.index + 1,
    runs,
    cells.indexOf(index) + 1,
    value,
  );
}
