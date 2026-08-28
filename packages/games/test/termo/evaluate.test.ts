import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  evaluateGuess,
  WORD_LENGTH,
  type TileState,
} from "../../src/termo/evaluate";
import { normalizeWord } from "../../src/termo/normalize";
import { azWord, ptbrWord } from "./arbitraries";

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
            const letter = normalizedGuess.charAt(i);
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

  it.each([
    ["aaaaa", "cacau", ["absent", "correct", "absent", "correct", "absent"]],

    ["carro", "caçar", ["correct", "correct", "present", "absent", "absent"]],

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
