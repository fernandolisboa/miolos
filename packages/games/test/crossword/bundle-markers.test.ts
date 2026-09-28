import { describe, expect, it } from "vitest";

import { CROSSWORD_LEXICON } from "../../src/crossword/lexicon.generated";

const LEXICON_MARKER = "Calculadora de bolinhas";

describe("the client-bundle tripwire's crossword lexicon marker", () => {
  it("is the clue of exactly one lexicon entry, so its absence from a bundle is not vacuous", () => {
    expect(
      CROSSWORD_LEXICON.filter((entry) => entry.clue === LEXICON_MARKER),
      `\`${LEXICON_MARKER}\` no longer clues one lexicon entry: update this file AND \`LEXICON_MARKER\` in apps/web/scripts/route-client-js.mjs`,
    ).toHaveLength(1);
  });
});
