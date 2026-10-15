import { normalizeWord } from "../normalize";
import { VALIDATION_WORDS } from "./words.generated";

export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);

export function isValidGuess(word: string): boolean {
  return VALIDATION_SET.has(normalizeWord(word));
}
