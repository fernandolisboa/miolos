import { describe, expect, it } from "vitest";

import { buildLexiconIndex, fillSlots } from "../../src/crossword/fill";
import { deriveSlots } from "../../src/crossword/slots";
import { toBlocks } from "../../src/crossword/templates";
import type { CrosswordLexiconEntry } from "../../src/crossword/types";
import { createSeededRandom } from "../../src/random";

function lexiconOf(words: readonly string[]): CrosswordLexiconEntry[] {
  return words.map((word) => ({
    normalized: word,
    canonical: word,
    clue: `Pista de ${word}`,
  }));
}

const twoByThree = deriveSlots(toBlocks(["...", "..."]));
const threeByThree = deriveSlots(toBlocks(["...", "...", "..."]));

function fill(
  slots: typeof twoByThree,
  words: readonly string[],
  seed: number,
  budget = 1_000,
): string[] | null {
  const result = fillSlots(
    slots,
    buildLexiconIndex(lexiconOf(words)),
    createSeededRandom(seed),
    budget,
  );
  return result === null ? null : result.map((entry) => entry.normalized);
}

describe("fillSlots", () => {
  it("finds the one fill a lexicon admits, from any seed", () => {
    const words = ["mar", "ela", "mal", "me", "al", "ra", "ou"];
    for (let seed = 0; seed < 20; seed += 1) {
      expect(fill(twoByThree, words, seed)).toEqual([
        "mar",
        "ela",
        "me",
        "al",
        "ra",
      ]);
    }
  });

  it("returns the lexicon entries themselves, clue included", () => {
    const lexicon = lexiconOf(["mar", "ela", "me", "al", "ra"]);
    const result = fillSlots(
      twoByThree,
      buildLexiconIndex(lexicon),
      createSeededRandom(0),
      1_000,
    );
    expect(result?.[0]).toBe(lexicon[0]);
  });

  it("returns null when no fill exists", () => {
    expect(fill(twoByThree, ["mar", "ela", "me", "al"], 0)).toBeNull();
    expect(fill(twoByThree, ["me", "al", "ra"], 0)).toBeNull();
  });

  it("returns null when the node budget runs out before a fill", () => {
    expect(fill(twoByThree, ["mar", "ela", "me", "al", "ra"], 0, 1)).toBeNull();
    expect(fill(twoByThree, ["mar", "ela", "me", "al", "ra"], 0, 6)).toEqual([
      "mar",
      "ela",
      "me",
      "al",
      "ra",
    ]);
  });

  it("never repeats a word: a lexicon that only forms a symmetric word square cannot fill", () => {
    expect(fill(threeByThree, ["abc", "bde", "cef"], 0)).toBeNull();
    expect(
      fill(threeByThree, ["abc", "bde", "cef", "abx", "bdy", "cez", "xyz"], 0),
    ).not.toBeNull();
  });

  it("is deterministic for a seed", () => {
    const words = ["abc", "bde", "cef", "abx", "bdy", "cez", "xyz", "fgh"];
    expect(fill(threeByThree, words, 7)).toEqual(fill(threeByThree, words, 7));
  });

  it("rejects a lexicon word outside a-z", () => {
    expect(() => buildLexiconIndex(lexiconOf(["maç"]))).toThrow(RangeError);
  });
});
