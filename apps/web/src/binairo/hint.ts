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
  type HintReason,
  type Revealed,
} from "../play/grid-hint";
import type { CellValue } from "./state";

export type BinairoHintReason = HintReason<BinairoStep>;

const copy = messages.games.binairo.play.hint.explain;

export function nextBinairoHint(
  solution: BinairoSolvedGrid,
  givens: BinairoGrid,
  entries: readonly CellValue[],
): Revealed<0 | 1, BinairoHintReason> | null {
  const hint = nextLogicalHint(
    solution,
    nextHint(solution, givens, entries),
    () => {
      const step = nextBinairoStep(
        givens.map((given, index) => given ?? entries[index] ?? null),
      );
      return step === null
        ? null
        : { index: step.index, value: step.value, step };
    },
  );
  return hint !== null && hint.reason.kind === "step"
    ? { ...hint, spotlight: hint.reason.step.cells }
    : hint;
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
  const { index, value, rule, line, twin, cells } = reason.step;
  const row = Math.floor(index / BINAIRO_SIZE) + 1;
  const column = (index % BINAIRO_SIZE) + 1;
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
      return copy.step.count(line.kind, at, along, value, cells.length / 2);
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
