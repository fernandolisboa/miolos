import { messages } from "../i18n";
import {
  nextHint,
  plainHint,
  type PlainHintReason,
  type Revealed,
} from "../play/grid-hint";
import type { BinairoGrid, BinairoSolvedGrid } from "@miolos/games/binairo";
import type { CellValue } from "./state";

const copy = messages.games.binairo.play.hint;

export function nextBinairoHint(
  solution: BinairoSolvedGrid,
  givens: BinairoGrid,
  entries: readonly CellValue[],
): Revealed<0 | 1, PlainHintReason> | null {
  return plainHint(nextHint(solution, givens, entries));
}

export function binairoHintExplanation(
  reason: PlainHintReason | null,
): string | null {
  return reason === null ? null : copy.explain[reason.kind];
}
