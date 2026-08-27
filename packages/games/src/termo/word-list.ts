import { normalizeWord } from "./normalize";
import { ANSWER_CANONICALS, VALIDATION_WORDS } from "./words.generated";

export interface TermoAnswer {
  readonly canonical: string;
  readonly normalized: string;
}

export const TERMO_ANSWERS: readonly TermoAnswer[] =
  /*#__PURE__*/ Object.freeze(
    /*#__PURE__*/ ANSWER_CANONICALS.split("\n").map((canonical) =>
      Object.freeze({ canonical, normalized: normalizeWord(canonical) }),
    ),
  );

export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);

export function isValidGuess(word: string): boolean {
  return VALIDATION_SET.has(normalizeWord(word));
}
