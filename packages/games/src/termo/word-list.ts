import { normalizeWord } from "../normalize";
import { PROFANITY_GUESSES } from "./profanity.generated";
import { VALIDATION_WORDS } from "./words.generated";

export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);

export function isValidGuess(word: string): boolean {
  return VALIDATION_SET.has(normalizeWord(word));
}

export function isProfanityForm(word: string): boolean {
  return PROFANITY_GUESSES.split("\n").includes(normalizeWord(word));
}
