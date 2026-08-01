import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { normalizeWord } from "../../src/termo/normalize";
import { azWord, ptbrWord } from "./arbitraries";

const anyString = fc.string();
const graphemeString = fc.string({ unit: "grapheme" });

describe("normalizeWord", () => {
  it("is idempotent over arbitrary strings", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        expect(normalizeWord(normalizeWord(s))).toBe(normalizeWord(s));
      }),
    );
    fc.assert(
      fc.property(graphemeString, (s) => {
        expect(normalizeWord(normalizeWord(s))).toBe(normalizeWord(s));
      }),
    );
  });

  it("produces no combining marks over arbitrary strings", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        expect(/\p{Mn}/u.test(normalizeWord(s))).toBe(false);
      }),
    );
    fc.assert(
      fc.property(graphemeString, (s) => {
        expect(/\p{Mn}/u.test(normalizeWord(s))).toBe(false);
      }),
    );
  });

  it("produces no uppercase over pt-BR and a-z words and their uppercased variants", () => {
    for (const word of [ptbrWord, azWord]) {
      fc.assert(
        fc.property(word, (s) => {
          expect(/\p{Lu}/u.test(normalizeWord(s))).toBe(false);
          expect(/\p{Lu}/u.test(normalizeWord(s.toUpperCase()))).toBe(false);
        }),
      );
    }
  });

  it("preserves length over pt-BR words (every char maps 1 to 1)", () => {
    fc.assert(
      fc.property(ptbrWord, (s) => {
        expect(normalizeWord(s)).toHaveLength(s.length);
      }),
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        expect(normalizeWord(s)).toBe(normalizeWord(s));
      }),
    );
  });

  it.each([
    ["ç", "c"],
    ["ação", "acao"],
    ["sábia", "sabia"],
    ["então", "entao"],
    ["MUITO", "muito"],
    ["sabia", "sabia"],
    ["", ""],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeWord(input)).toBe(expected);
  });
});
