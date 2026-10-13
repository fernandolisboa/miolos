import {
  BINAIRO_SIZE,
  nextBinairoStep,
  type BinairoGrid,
  type BinairoSolvedGrid,
  type BinairoStep,
} from "@miolos/games/binairo";

import { messages } from "../i18n";
import {
  nextHint,
  nextLogicalHint,
  toRowColumn,
  type HintReason,
  type LogicalHint,
} from "../play/grid-hint";
import { mergeGrid } from "./engine";
import type { CellValue } from "./state";

export type BinairoHintReason = HintReason<BinairoStep>;

const copy = messages.games.binairo.play.hint.explain;

export function nextBinairoHint(
  solution: BinairoSolvedGrid,
  givens: BinairoGrid,
  entries: readonly CellValue[],
): LogicalHint<0 | 1, BinairoStep> | null {
  return nextLogicalHint(solution, nextHint(solution, givens, entries), () => {
    const step = nextBinairoStep(mergeGrid(givens, entries));
    return step === null
      ? null
      : { index: step.index, value: step.value, step, cells: step.cells };
  });
}

export function binairoHintExplanation(
  reason: BinairoHintReason | null,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, value, rule, line, twin } = reason.step;
  const { row, column } = toRowColumn(index, BINAIRO_SIZE);
  if (rule === "lookahead" || line === null) {
    return copy.step.lookahead(row, column, value);
  }
  const at = line.index + 1;
  const along = line.kind === "row" ? column : row;
  switch (rule) {
    case "pair":
    case "gap":
      return copy.step[rule](line.kind, at, along, value);
    case "count":
      return copy.step.count(line.kind, at, along, value, BINAIRO_SIZE / 2);
    case "duplicate":
      return copy.step.duplicate(
        line.kind,
        at,
        along,
        value,
        (twin ?? line.index) + 1,
      );
  }
}
