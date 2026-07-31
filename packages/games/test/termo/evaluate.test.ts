import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  evaluateGuess,
  WORD_LENGTH,
  type TileState,
} from "../../src/termo/evaluate";
import { normalizeWord } from "../../src/termo/normalize";

const PTBR_ALPHABET = "abcdefghijklmnopqrstuvwxyzáéíóúâêôãõàç";
const AZ_ALPHABET = "abcdefghijklmnopqrstuvwxyz";

const ptbrWord = fc.string({
  unit: fc.constantFrom(...PTBR_ALPHABET),
  minLength: 5,
  maxLength: 5,
});
const azWord = fc.string({
  unit: fc.constantFrom(...AZ_ALPHABET),
  minLength: 5,
  maxLength: 5,
});

const TILE_STATES: readonly TileState[] = ["correct", "present", "absent"];

function countLetters(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of word) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

describe("evaluateGuess", () => {
  it("marks a guess equal to the answer all-correct", () => {
    for (const word of [azWord, ptbrWord]) {
      fc.assert(
        fc.property(word, (w) => {
          expect(evaluateGuess(w, w)).toEqual([
            "correct",
            "correct",
            "correct",
            "correct",
            "correct",
          ]);
        }),
      );
    }
  });

  it("always returns a 5-tuple of valid tile states", () => {
    fc.assert(
      fc.property(azWord, azWord, (guess, answer) => {
        const tiles = evaluateGuess(guess, answer);
        expect(tiles).toHaveLength(WORD_LENGTH);
        for (const tile of tiles) {
          expect(TILE_STATES).toContain(tile);
        }
      }),
    );
  });

  it("conserves letter counts: marks per letter never exceed its count in the answer", () => {
    fc.assert(
      fc.property(azWord, azWord, (guess, answer) => {
        const tiles = evaluateGuess(guess, answer);
        const answerCounts = countLetters(normalizeWord(answer));
        const normalizedGuess = normalizeWord(guess);
        const marked = new Map<string, number>();
        for (let i = 0; i < WORD_LENGTH; i += 1) {
          if (tiles[i] !== "absent") {
            const letter = normalizedGuess[i] as string;
            marked.set(letter, (marked.get(letter) ?? 0) + 1);
          }
        }
        for (const [letter, count] of marked) {
          expect(count).toBeLessThanOrEqual(answerCounts.get(letter) ?? 0);
        }
      }),
    );
  });

  it("is accent-insensitive: evaluating pre-normalized inputs gives the same result", () => {
    fc.assert(
      fc.property(ptbrWord, ptbrWord, (guess, answer) => {
        expect(evaluateGuess(guess, answer)).toEqual(
          evaluateGuess(normalizeWord(guess), normalizeWord(answer)),
        );
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(azWord, azWord, (guess, answer) => {
        expect(evaluateGuess(guess, answer)).toEqual(
          evaluateGuess(guess, answer),
        );
      }),
    );
  });

  // Hand-verified double-letter fixtures (plan §7.2): each tuple was worked
  // through the two-pass algorithm by hand before becoming an expectation.
  it.each([
    // Surplus doubles vs fewer in answer: pass 1 consumes positions 1 and 3,
    // the 'a' count is exhausted for positions 0, 2, 4.
    ["aaaaa", "cacau", ["absent", "correct", "absent", "correct", "absent"]],
    // Accent-insensitive with letter-count exhaustion: caçar → cacar, only
    // one 'r' remains after pass 1 consumes nothing for 'r'.
    ["carro", "caçar", ["correct", "correct", "present", "absent", "absent"]],
    // Exact beats earlier present: pass-1 consumption at positions 0 and 3
    // happens before pass 2 walks left-to-right.
    ["aarrr", "arara", ["correct", "present", "present", "correct", "absent"]],
    ["arara", "arara", ["correct", "correct", "correct", "correct", "correct"]],
  ])("evaluates guess %j against answer %j", (guess, answer, expected) => {
    expect(evaluateGuess(guess, answer)).toEqual(expected);
  });

  it.each([
    ["abcd", "cacau"],
    ["cacau", "abacus"],
    ["abc1d", "cacau"],
  ])("throws RangeError for malformed input %j / %j", (guess, answer) => {
    expect(() => evaluateGuess(guess, answer)).toThrow(RangeError);
  });
});
