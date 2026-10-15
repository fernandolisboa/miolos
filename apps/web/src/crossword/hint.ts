import { messages } from "../i18n";
import {
  nextHint,
  nextLogicalHint,
  toRowColumn,
  type HintReason,
  type LogicalHint,
} from "../play/grid-hint";
import {
  activeEntry,
  entryAt,
  entryCells,
  hintGivens,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import type { CrosswordCellValue } from "./state";

export interface CrosswordStep {
  readonly clue: CrosswordClue;
  readonly crossing: CrosswordClue | null;
  readonly index: number;
}

export type CrosswordHintReason = HintReason<CrosswordStep>;

export type CrosswordHint = LogicalHint<CrosswordCellValue, CrosswordStep>;

const copy = messages.games.crossword.play;

export function nextCrosswordHint(
  solution: readonly CrosswordCellValue[],
  clues: readonly CrosswordClue[],
  entries: readonly CrosswordCellValue[],
  selected: number | null,
  direction: CrosswordDirection,
  size: number,
): CrosswordHint | null {
  const first = nextHint(solution, hintGivens(solution), entries);
  return nextLogicalHint(solution, first, () => {
    const isOpen = (index: number) =>
      (solution[index] ?? null) !== null && entries[index] === null;
    const hasOpen = (clue: CrosswordClue) =>
      entryCells(clue, size).some(isOpen);
    const active =
      selected === null
        ? undefined
        : activeEntry(clues, selected, direction, size);
    const clue =
      active !== undefined && hasOpen(active) ? active : clues.find(hasOpen);
    if (clue === undefined) {
      return null;
    }
    const crossingOf = (index: number) => {
      const other = entryAt(
        clues,
        index,
        clue.direction === "across" ? "down" : "across",
        size,
      );
      return other !== undefined &&
        entryCells(other, size).some((at) => at !== index && isOpen(at))
        ? other
        : null;
    };
    const open = entryCells(clue, size).filter(isOpen);
    const index = open.find((at) => crossingOf(at) !== null) ?? open[0];
    const value = index === undefined ? undefined : solution[index];
    return index === undefined || value === undefined
      ? null
      : {
          index,
          value,
          step: { clue, crossing: crossingOf(index), index },
          cells: [],
        };
  });
}

export function crosswordHintExplanation(
  reason: CrosswordHintReason | null,
  size: number,
): string | null {
  if (reason === null) {
    return null;
  }
  if (reason.kind !== "step") {
    return copy.hint.explain[reason.kind];
  }
  const { clue, crossing, index } = reason.step;
  const { row, column } = toRowColumn(index, size);
  return copy.hint.explain.step(
    copy.clueLabel(clue.number, clue.direction),
    crossing === null
      ? null
      : copy.clueLabel(crossing.number, crossing.direction),
    row,
    column,
  );
}
