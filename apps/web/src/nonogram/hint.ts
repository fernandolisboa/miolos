import {
  nextNonogramStep,
  type NonogramClues,
  type NonogramLine,
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

export type PictureHintReason<S> = HintReason<S> | { readonly kind: "cross" };

export type NonogramHintReason = PictureHintReason<NonogramStep>;

interface PictureStep<M> {
  readonly index: number;
  readonly value: M;
  readonly line: NonogramLine;
  readonly cells: readonly number[];
}

const copy = messages.games.nonogram.play.hint.explain;

export function nextPictureHint<M extends number, S extends PictureStep<M>>(
  solution: readonly M[],
  entries: readonly (M | null)[],
  findStep: () => S | null,
): Revealed<M, PictureHintReason<S>> | null {
  const hint = nextLogicalHint(
    solution,
    nextBinaryHint(solution, entries),
    () => {
      const step = findStep();
      return step === null
        ? null
        : { index: step.index, value: step.value, step, cells: step.cells };
    },
  );
  return hint?.reason.kind === "fill" && hint.value === 0
    ? { ...hint, reason: { kind: "cross" } }
    : hint;
}

export function nextNonogramHint(
  clues: NonogramClues,
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Revealed<NonogramMark, NonogramHintReason> | null {
  return nextPictureHint(solution, entries, () =>
    nextNonogramStep(clues, entries.map(cellStateOf)),
  );
}

export function pictureHintExplanation<S extends PictureStep<number>>(
  size: number,
  reason: PictureHintReason<S> | null,
  describe: (step: S) => {
    readonly runs: readonly (number | string)[];
    readonly mark: string;
  },
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy[reason.kind];
  }
  const { index, line } = reason.step;
  const { row, column } = toRowColumn(index, size);
  const { runs, mark } = describe(reason.step);
  return copy.step(
    line.kind,
    line.index + 1,
    runs,
    line.kind === "row" ? column : row,
    mark,
  );
}

export function nonogramHintExplanation(
  size: number,
  reason: NonogramHintReason | null,
): string | null {
  return pictureHintExplanation(size, reason, ({ runs, value }) => ({
    runs,
    mark: value === 1 ? copy.filled : copy.crossed,
  }));
}
