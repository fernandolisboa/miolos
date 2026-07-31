import { normalizeWord } from "./normalize";
import { ANSWER_CANONICALS, VALIDATION_WORDS } from "./words.generated";

export interface TermoAnswer {
  readonly canonical: string;
  readonly normalized: string;
}

/**
 * The 400 answers, in answers.csv row order. ORDER IS CONTRACTUAL: #27's
 * server-side seeded choice (ADR-0010) indexes into this array; reordering
 * is a breaking change and the word-list harness pins it. The normalized
 * form is derived here by normalizeWord — the single normalization function
 * is the only path from canonical to normalized in the runtime.
 */
export const TERMO_ANSWERS: readonly TermoAnswer[] = Object.freeze(
  ANSWER_CANONICALS.split("\n").map((canonical) =>
    Object.freeze({ canonical, normalized: normalizeWord(canonical) }),
  ),
);

/** The accepted-guess normalized words, sorted, unique. */
export const TERMO_VALIDATION_WORDS: readonly string[] = Object.freeze(
  VALIDATION_WORDS.split("\n"),
);

const VALIDATION_SET: ReadonlySet<string> = new Set(TERMO_VALIDATION_WORDS);

/**
 * normalizeWord(word) ∈ validation set. The only guess-acceptance predicate
 * (the "não está na lista" gate).
 */
export function isValidGuess(word: string): boolean {
  return VALIDATION_SET.has(normalizeWord(word));
}
