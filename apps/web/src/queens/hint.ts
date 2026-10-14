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
  wrongCells,
  type Hint,
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
  const first =
    wrongQueen(solution, entries) ?? nextBinaryHint(solution, entries);
  return nextLogicalHint(solution, first, () => {
    const step = nextQueensStep(board, entries);
    return step === null
      ? null
      : { index: step.index, value: 1, step, cells: step.cells };
  });
}

function wrongQueen(
  solution: readonly QueensMark[],
  entries: readonly QueensCellValue[],
): Hint<QueensMark> | null {
  const index = [...wrongCells(solution, null, entries)].find(
    (cell) => entries[cell] === 1,
  );
  return index === undefined ? null : { index, value: 0, kind: "correction" };
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
