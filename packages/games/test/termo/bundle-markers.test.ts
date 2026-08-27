import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeWord } from "../../src/termo/normalize";
import {
  isValidGuess,
  TERMO_ANSWERS,
  TERMO_VALIDATION_WORDS,
} from "../../src/termo/word-list";

const FORBIDDEN_MARKERS: readonly string[] = ["então", "mamãe", "época"];

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
    for (const marker of FORBIDDEN_MARKERS) {
      expect(normalizeWord(marker), `${marker} carries no accent`).not.toBe(
        marker,
      );
    }
  });

  it("appear in NO form the validation list would ship", () => {
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

      expect(isValidGuess(marker)).toBe(true);

      expect(normalizeWord(marker)).toBe(marker);
    }
  });
});

describe("the tree-shaking annotations that keep bundles honest", () => {
  it("survive in word-list.ts: four /*#__PURE__*/, one per top-level initialiser", () => {
    const source = readFileSync(
      join(import.meta.dirname, "..", "..", "src", "termo", "word-list.ts"),
      "utf8",
    );
    expect(source.match(/\/\*#__PURE__\*\//g)).toHaveLength(4);
    for (const initialiser of [
      "Object.freeze(\n",
      "ANSWER_CANONICALS.split",
      "Object.freeze(VALIDATION_WORDS.split",
      "new Set(",
    ]) {
      expect(source).toContain(`/*#__PURE__*/ ${initialiser}`);
    }
  });

  it("survive in @miolos/core's MEDAL_IDS, which has no test of its own", () => {
    // A module-level call is otherwise a side effect that can pin the module
    // into a chunk that only wanted a type. Scanned from here because
    // `packages/core` carries no Node types.
    const source = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "core",
        "src",
        "medals",
        "definitions.ts",
      ),
      "utf8",
    );
    expect(source).toContain(
      "/*#__PURE__*/ MEDAL_DEFINITIONS.map((d) => d.id)",
    );
    expect(source.match(/\/\*#__PURE__\*\//g)).toHaveLength(1);
  });
});
