import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { evaluateGuess, type TileState } from "../../src/termo/evaluate";
import {
  deriveKeyboardState,
  type EvaluatedGuess,
} from "../../src/termo/keyboard";
import { azWord } from "./arbitraries";

const TILE_STATES: readonly TileState[] = ["correct", "present", "absent"];

const PRECEDENCE: Record<TileState, number> = {
  correct: 2,
  present: 1,
  absent: 0,
};

function toEvaluated(guess: string, answer: string): EvaluatedGuess {
  return { guess, tiles: evaluateGuess(guess, answer) };
}

describe("deriveKeyboardState", () => {
  it("never downgrades a key when a guess is appended (monotonic)", () => {
    fc.assert(
      fc.property(
        azWord,
        fc.array(azWord, { minLength: 1, maxLength: 6 }),
        (answer, guesses) => {
          const evaluated = guesses.map((g) => toEvaluated(g, answer));
          for (let n = 1; n < evaluated.length; n += 1) {
            const before = deriveKeyboardState(evaluated.slice(0, n));
            const after = deriveKeyboardState(evaluated.slice(0, n + 1));
            for (const [key, state] of Object.entries(before)) {
              if (state === undefined) {
                continue;
              }
              const next = after[key];
              if (next === undefined) {
                throw new Error(`key ${key} disappeared from the keyboard`);
              }
              expect(PRECEDENCE[next]).toBeGreaterThanOrEqual(
                PRECEDENCE[state],
              );
            }
          }
        },
      ),
    );
  });

  it("keys only letters that appeared in some guess, with valid states", () => {
    fc.assert(
      fc.property(
        azWord,
        fc.array(azWord, { minLength: 0, maxLength: 6 }),
        (answer, guesses) => {
          const evaluated = guesses.map((g) => toEvaluated(g, answer));
          const state = deriveKeyboardState(evaluated);
          const guessed = new Set(guesses.join(""));
          for (const [key, tile] of Object.entries(state)) {
            expect(guessed.has(key)).toBe(true);
            expect(TILE_STATES).toContain(tile);
          }
        },
      ),
    );
  });

  it("keeps correct over a later present, and present over a later absent", () => {
    // answer "cacau": guess "casal" puts c correct at 0; guess "banco" has
    // c only as present (position 3) — the key must stay correct.
    const answer = "cacau";
    const state = deriveKeyboardState([
      toEvaluated("casal", answer),
      toEvaluated("banco", answer),
    ]);
    expect(state["c"]).toBe("correct");
    // "u" present in "usual" (position 0, answer has u at 4), then a guess
    // without u leaves it present; "l" was absent in "casal" and stays absent.
    expect(state["u"]).toBeUndefined();
    const withU = deriveKeyboardState([
      toEvaluated("usual", answer),
      toEvaluated("birra", answer),
    ]);
    expect(withU["u"]).toBe("present");
    expect(withU["l"]).toBe("absent");
  });

  it("leaves untouched letters absent from the map", () => {
    const state = deriveKeyboardState([toEvaluated("cacau", "cacau")]);
    expect(state["z"]).toBeUndefined();
    expect(Object.keys(state).sort()).toEqual(["a", "c", "u"]);
  });

  it("normalizes accented guesses before keying", () => {
    const state = deriveKeyboardState([toEvaluated("caçar", "cacau")]);
    expect(state["c"]).toBe("correct");
    expect(Object.keys(state).every((k) => /^[a-z]$/.test(k))).toBe(true);
  });

  it("returns an empty map for no guesses", () => {
    expect(deriveKeyboardState([])).toEqual({});
  });
});
