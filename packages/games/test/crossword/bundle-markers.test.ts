import { describe, expect, it } from "vitest";

import { CROSSWORD_LEXICON } from "../../src/crossword/lexicon.generated";

const FORBIDDEN_LEXICON_MARKER = "Calculadora de bolinhas";

describe("the client-bundle tripwire's crossword lexicon marker", () => {
  it("is the clue of exactly one lexicon entry, so its absence from a bundle is not vacuous", () => {
    expect(
      CROSSWORD_LEXICON.filter(
        (entry) => entry.clue === FORBIDDEN_LEXICON_MARKER,
      ),
      `\`${FORBIDDEN_LEXICON_MARKER}\` no longer clues one lexicon entry: update this file AND \`FORBIDDEN_EVERYWHERE\` in apps/web/scripts/route-client-js.mjs`,
    ).toHaveLength(1);
  });
});
