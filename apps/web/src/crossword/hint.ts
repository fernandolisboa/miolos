import { messages } from "../i18n";
import {
  nextHint,
  plainHint,
  type PlainHintReason,
  type Revealed,
} from "../play/grid-hint";
import { hintGivens } from "./grid";
import type { CrosswordCellValue } from "./state";

const copy = messages.games.crossword.play.hint;

export function nextCrosswordHint(
  solution: readonly CrosswordCellValue[],
  entries: readonly CrosswordCellValue[],
): Revealed<CrosswordCellValue, PlainHintReason> | null {
  return plainHint(nextHint(solution, hintGivens(solution), entries));
}

export function crosswordHintExplanation(
  reason: PlainHintReason | null,
): string | null {
  return reason === null ? null : copy.explain[reason.kind];
}
