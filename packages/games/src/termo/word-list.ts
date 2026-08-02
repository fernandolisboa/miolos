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
 *
 * BOTH `/*#__PURE__*\/` ANNOTATIONS ARE LOAD-BEARING AND NEITHER IS TIDINESS
 * (ADR-0045 decision 5). This module and the validation dictionary are one
 * generated file, and `apps/web` imports `isValidGuess` from it on purpose —
 * "não está na lista" has to be instant and offline. Without these, the live
 * `TERMO_ANSWERS` binding drags the 400-word answer pool into `/termo`'s
 * client bundle: 2.8 KB raw / 1.8 KB gzip nothing on the client reads, plus
 * 400 `Object.freeze` allocations and 400 `normalizeWord` calls at module
 * init on the ritual's route, and a second channel for a fact
 * `packages/core/src/contracts/daily-content.ts`'s termo row exists to
 * withhold. The reason is cost and strip-table integrity; it is explicitly
 * NOT confidentiality, which ADR-0027:125-131 forecloses.
 *
 * THE OUTER ONE ALONE DOES NOT WORK — measured, not reasoned (ADR-0045's
 * experiment E4): annotating only `Object.freeze(` leaves the unannotated
 * `ANSWER_CANONICALS.split("\n")` inside it keeping the binding alive, at the
 * full 2.8 KB. The two together shake it out completely.
 *
 * NOTHING CHANGES SERVER-SIDE. `apps/api`'s daily draw imports
 * `TERMO_ANSWERS` (ADR-0040), so the binding stays live there; a `#__PURE__`
 * annotation only permits elimination where nothing reads it.
 *
 * A COMMENT IS NOT A MECHANISM, so these ship with two gates — three accented
 * canonicals in `apps/web/scripts/route-client-js.mjs`'s `FORBIDDEN` with
 * `zurro` in its `EXPECTED` as the positive control, and
 * `test/termo/bundle-markers.test.ts` pinning all four from this side.
 * Deleting an annotation "for tidiness" reds the first; renaming a marker
 * reds the second.
 */
export const TERMO_ANSWERS: readonly TermoAnswer[] =
  /*#__PURE__*/ Object.freeze(
    /*#__PURE__*/ ANSWER_CANONICALS.split("\n").map((canonical) =>
      Object.freeze({ canonical, normalized: normalizeWord(canonical) }),
    ),
  );

/**
 * The accepted-guess normalized words, sorted, unique.
 *
 * The annotations here and on `VALIDATION_SET` change nothing today —
 * `isValidGuess` keeps both alive wherever it is imported, which on the
 * client is the whole point — and ship for symmetry, so a future consumer
 * importing only `TERMO_ANSWERS` gets the mirror benefit.
 */
export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);

/**
 * normalizeWord(word) ∈ validation set. The only guess-acceptance predicate
 * (the "não está na lista" gate).
 */
export function isValidGuess(word: string): boolean {
  return VALIDATION_SET.has(normalizeWord(word));
}
