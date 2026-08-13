import { describe, expect, it } from "vitest";

import { normalizeWord } from "../../src/termo/normalize";
import {
  isValidGuess,
  TERMO_ANSWERS,
  TERMO_VALIDATION_WORDS,
} from "../../src/termo/word-list";

/**
 * The word-list markers `apps/web/scripts/route-client-js.mjs` greps the built
 * client chunks for, pinned on THIS side of the wall — the sibling of
 * `test/nonogram/bundle-markers.test.ts`, and here for the same reason.
 *
 * WHAT THE GREPS PROVE. `word-list.ts` carries two `/*#__PURE__*\/`
 * annotations (ADR-0045 decision 5) so that a client importing `isValidGuess`
 * — which #27 ships, because "não está na lista" must be instant and offline
 * — does NOT drag `TERMO_ANSWERS` along with it. The annotations are
 * invisible to typecheck, to lint and to the whole test suite, and ADR-0045's
 * measurement E4 proves they are fragile to their own placement: annotating
 * only the outer `Object.freeze` left the full 2.8 KB in the bundle. A string
 * grep over the built chunks is the only instrument that can see the
 * difference, and it needs markers that discriminate between the two lists
 * inside one generated module.
 *
 * WHY THESE FIVE. `content/termo/validation.txt` is US-ASCII and
 * `answers.csv` carries 49 accented canonicals, so an accented canonical can
 * only have come from `ANSWER_CANONICALS` — it is a clean discriminator. The
 * three below are the FORBIDDEN markers. `zurro` and `abaco` are the positive
 * controls: they are validation words that MUST ship with `isValidGuess`, so
 * if the scan ever stops reaching the chunk that carries the word list, the
 * three negatives cannot pass by finding nothing.
 *
 * MINIFICATION IS WHY THEY ARE STRING LITERALS AND NOT IDENTIFIERS. The
 * built chunks rename every binding, so `TERMO_ANSWERS` is not greppable in
 * them; the word lists are `"\n"`-joined string constants and survive
 * verbatim, which is what makes this measurable at all.
 *
 * THE CONSUMER, BY NAME: `apps/web/scripts/route-client-js.mjs` hard-codes
 * `então`, `mamãe` and `época` in `FORBIDDEN_EVERYWHERE` (every chunk,
 * free-play chunks included — since #28 the scan is route-scoped, ADR-0047)
 * and `zurro` in `EXPECTED_DAILY_SCOPE` plus `FORBIDDEN_FREE_PLAY_SCOPE`
 * (expected in `/termo`'s chunks, forbidden in every `/modo-livre*` route's
 * first-load set). A
 * grep for a word that no longer exists in the shipped list passes trivially,
 * and nothing on the web side can notice — the script holds no link back to
 * this package. WHEN THIS REDS, pick a replacement that the shipped list
 * actually carries and update BOTH this file and the script. Never relax the
 * assertion here.
 */
const FORBIDDEN_MARKERS: readonly string[] = ["então", "mamãe", "época"];

/** The positive controls, from the other list. Both must be validation words. */
const EXPECTED_MARKERS: readonly string[] = ["zurro", "abaco"];

const CANONICALS = new Set(TERMO_ANSWERS.map((answer) => answer.canonical));
const VALIDATION = new Set(TERMO_VALIDATION_WORDS);

describe("the client-bundle tripwire's word-list markers", () => {
  it("still resolve as answer canonicals, so the negatives are not vacuous", () => {
    for (const marker of FORBIDDEN_MARKERS) {
      expect(
        CANONICALS.has(marker),
        `\`${marker}\` no longer spells an answer: update this file AND \`FORBIDDEN\` in apps/web/scripts/route-client-js.mjs`,
      ).toBe(true);
    }
  });

  it("are accented, which is the whole discriminator", () => {
    // An ASCII marker would also match the validation list, and the grep
    // would then prove nothing about which list shipped. `normalizeWord`
    // strips the diacritic, so a marker that survives it unchanged is ASCII.
    for (const marker of FORBIDDEN_MARKERS) {
      expect(normalizeWord(marker), `${marker} carries no accent`).not.toBe(
        marker,
      );
    }
  });

  it("appear in NO form the validation list would ship", () => {
    // The accented spelling exists only in the answer list; the normalized
    // one may legitimately be a validation word, and that is fine — the grep
    // is for the accented literal, so only that one has to be absent.
    for (const marker of FORBIDDEN_MARKERS) {
      expect(
        VALIDATION.has(marker),
        `\`${marker}\` is now a validation word, so its absence from the bundle would be a FALSE negative: replace it here AND in apps/web/scripts/route-client-js.mjs`,
      ).toBe(false);
    }
  });

  it("keep their positive controls in the list that must ship", () => {
    for (const marker of EXPECTED_MARKERS) {
      expect(
        VALIDATION.has(marker),
        `\`${marker}\` is no longer a validation word: update this file AND \`EXPECTED\` in apps/web/scripts/route-client-js.mjs`,
      ).toBe(true);
      // Through the shipped predicate too, which is the symbol the client
      // actually imports and therefore the one that keeps the chunk alive.
      expect(isValidGuess(marker)).toBe(true);
      // ASCII, so their presence in a chunk says nothing about the answers.
      expect(normalizeWord(marker)).toBe(marker);
    }
  });
});
