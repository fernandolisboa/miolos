import { readFileSync } from "node:fs";
import { join } from "node:path";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { renderTermoFreePoolModule } from "../../scripts/render-termo-free-pool";
import { normalizeWord } from "../../src/normalize";
import { isValidGuess } from "../../src/termo/word-list";
import { TERMO_ANSWERS } from "../../src/termo-answers";
import { drawFreeTermoWord } from "../../src/termo-free";
import { FREE_POOL_CANONICALS } from "../../src/termo-free/pool.generated";
import { propertyRuns } from "../property-runs";

const GAMES = join(import.meta.dirname, "..", "..");
const CONTENT = join(GAMES, "..", "..", "content");

const POOL_COUNT = 2409;
const POOL = FREE_POOL_CANONICALS.split("\n");
const POOL_SET: ReadonlySet<string> = new Set(POOL);
const ANSWER_FORMS: ReadonlySet<string> = new Set(
  TERMO_ANSWERS.map((answer) => answer.normalized),
);

const content = (...path: string[]) =>
  readFileSync(join(CONTENT, ...path), "utf8");

const uint32 = fc.integer({ min: 0, max: 0xffffffff });

describe("the Termo free pool", () => {
  it("pool.generated.ts is byte-identical to the renderer output", () => {
    expect(
      readFileSync(
        join(GAMES, "src", "termo-free", "pool.generated.ts"),
        "utf8",
      ),
      "stale: run `pnpm --filter @miolos/games generate:termo` after editing content/crossword/lexicon.tsv (with generate:crossword) or content/termo/answers.csv",
    ).toBe(
      renderTermoFreePoolModule(
        content("crossword", "lexicon.tsv"),
        content("termo", "validation.txt"),
        content("termo", "answers.csv"),
      ),
    );
  });

  it("holds 2409 guessable five-letter words, unique in normalized form", () => {
    expect(POOL).toHaveLength(POOL_COUNT);
    expect(new Set(POOL.map(normalizeWord)).size).toBe(POOL_COUNT);
    for (const word of POOL) {
      expect(normalizeWord(word), word).toMatch(/^[a-z]{5}$/);
      expect(isValidGuess(word), word).toBe(true);
    }
  });

  it("shares no normalized form with the answer list", () => {
    expect(
      POOL.filter((word) => ANSWER_FORMS.has(normalizeWord(word))),
    ).toEqual([]);
  });

  it("draws deterministically, for every uint32 seed, a pool word that is never an answer", () => {
    fc.assert(
      fc.property(uint32, (seed) => {
        const word = drawFreeTermoWord(seed);
        expect(drawFreeTermoWord(seed)).toBe(word);
        expect(POOL_SET.has(word)).toBe(true);
        expect(ANSWER_FORMS.has(normalizeWord(word))).toBe(false);
      }),
      { numRuns: propertyRuns(2000) },
    );
    for (const seed of [0, 0xffffffff]) {
      expect(POOL_SET.has(drawFreeTermoWord(seed))).toBe(true);
    }
  });
});
