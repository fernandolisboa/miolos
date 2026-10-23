import { normalizeWord } from "../normalize";
import { PROFANITY_GUESSES } from "./profanity.generated";
import { VALIDATION_WORDS } from "./words.generated";

export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);

export function isValidGuess(word: string, acceptsProfanity: boolean): boolean {
  const normalized = normalizeWord(word);
  return (
    VALIDATION_SET.has(normalized) ||
    (acceptsProfanity && PROFANITY_GUESSES.split("\n").includes(normalized))
  );
}
