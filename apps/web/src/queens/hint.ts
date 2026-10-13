import { messages } from "../i18n";
import {
  nextBinaryHint,
  plainHint,
  type PlainHintReason,
  type Revealed,
} from "../play/grid-hint";
import type { QueensCellValue, QueensMark } from "./state";

const copy = messages.games.queens.play.hint;

export function nextQueensHint(
  solution: readonly QueensMark[],
  entries: readonly QueensCellValue[],
): Revealed<QueensMark, PlainHintReason> | null {
  return plainHint(nextBinaryHint(solution, entries));
}

export function queensHintExplanation(
  reason: PlainHintReason | null,
): string | null {
  return reason === null ? null : copy.explain[reason.kind];
}
