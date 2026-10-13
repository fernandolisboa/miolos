import {
  nextQueensStep,
  type QueensBoard,
  type QueensStep,
} from "@miolos/games/queens";

import { messages } from "../i18n";
import {
  nextBinaryHint,
  nextLogicalHint,
  toRowColumn,
  type HintReason,
  type LogicalHint,
} from "../play/grid-hint";
import type { QueensCellValue, QueensMark } from "./state";

export type QueensHintReason = HintReason<QueensStep>;

const copy = messages.games.queens.play.hint.explain;

export function nextQueensHint(
  board: QueensBoard,
  solution: readonly QueensMark[],
  entries: readonly QueensCellValue[],
): LogicalHint<QueensMark, QueensStep> | null {
  return nextLogicalHint(solution, nextBinaryHint(solution, entries), () => {
    const step = nextQueensStep(board, entries);
    return step === null
      ? null
      : { index: step.index, value: 1, step, cells: step.cells };
  });
}

export function queensHintExplanation(
  size: number,
  reason: QueensHintReason | null,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, unit, after } = reason.step;
  const { row, column } = toRowColumn(index, size);
  return copy.step(unit.kind, unit.index + 1, row, column, after);
}
