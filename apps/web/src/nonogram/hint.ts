import { messages } from "../i18n";
import { nextBinaryHint, plainHint, type Revealed } from "../play/grid-hint";
import type { NonogramCellValue, NonogramMark } from "./state";

export interface NonogramHintReason {
  readonly kind: "correction" | "fill" | "cross";
}

const copy = messages.games.nonogram.play.hint;

export function nextNonogramHint(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Revealed<NonogramMark, NonogramHintReason> | null {
  const hint = plainHint(nextBinaryHint(solution, entries));
  return hint?.reason.kind === "fill" && hint.value === 0
    ? { ...hint, reason: { kind: "cross" } }
    : hint;
}

export function nonogramHintExplanation(
  reason: NonogramHintReason | null,
): string | null {
  return reason === null ? null : copy.explain[reason.kind];
}
