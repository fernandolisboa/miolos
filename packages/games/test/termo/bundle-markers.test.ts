import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normalizeWord } from "../../src/normalize";
import {
  isValidGuess,
  TERMO_ANSWERS,
  TERMO_VALIDATION_WORDS,
} from "../../src/termo/word-list";

const FORBIDDEN_PAIRS: readonly (readonly [string, string])[] = [
  ["então", "agora"],
  ["mamãe", "conta"],
  ["época", "carne"],
];

const CONTROL_PAIR = ["zurre", "zurro"] as const;

const EXPECTED_MARKERS: readonly string[] = ["zurro", "abaco"];

const SRC = join(import.meta.dirname, "..", "..", "src");
const WORDS = readFileSync(join(SRC, "termo", "words.generated.ts"), "utf8");
const LEXICON = readFileSync(
  join(SRC, "crossword", "lexicon.generated.ts"),
  "utf8",
);

function initialiser(name: string): string {
  const from = WORDS.indexOf(`export const ${name}`);
  const to = WORDS.indexOf("export const", from + 1);
  return WORDS.slice(from, to === -1 ? undefined : to);
}

const escaped = ([first, second]: readonly [string, string]) =>
  `${first}\\n${second}`;

function adjacent(
  list: readonly string[],
  [first, second]: readonly [string, string],
): boolean {
  const at = list.indexOf(first);
  return at !== -1 && list[at + 1] === second;
}

const CANONICALS = TERMO_ANSWERS.map((answer) => answer.canonical);
const VALIDATION = new Set(TERMO_VALIDATION_WORDS);

describe("the client-bundle tripwire's word-list markers", () => {
  it("are adjacent answers, stored as one escaped run in ANSWER_CANONICALS", () => {
    for (const pair of FORBIDDEN_PAIRS) {
      expect(
        adjacent(CANONICALS, pair),
        `\`${escaped(pair)}\` no longer spells two adjacent answers: update this file AND \`FORBIDDEN_EVERYWHERE\` in apps/web/scripts/route-client-js.mjs`,
      ).toBe(true);
      expect(initialiser("ANSWER_CANONICALS")).toContain(escaped(pair));
    }
  });

  it("appear in no form the validation list or the crossword lexicon would ship", () => {
    for (const pair of FORBIDDEN_PAIRS) {
      expect(adjacent(TERMO_VALIDATION_WORDS, pair)).toBe(false);
      expect(initialiser("VALIDATION_WORDS")).not.toContain(escaped(pair));
      expect(LEXICON).not.toContain(escaped(pair));
      expect(LEXICON).not.toContain(pair.join("\n"));
    }
  });

  it("keep a positive control spelled the same way in the list that must ship", () => {
    expect(adjacent(TERMO_VALIDATION_WORDS, CONTROL_PAIR)).toBe(true);
    expect(initialiser("VALIDATION_WORDS")).toContain(escaped(CONTROL_PAIR));
  });

  it("keep their positive controls in the list that must ship", () => {
    for (const marker of EXPECTED_MARKERS) {
      expect(
        VALIDATION.has(marker),
        `\`${marker}\` is no longer a validation word: update this file, and any list in apps/web/scripts/route-client-js.mjs that names it (\`zurro\` is in EXPECTED_DAILY_SCOPE and FORBIDDEN_FREE_PLAY_SCOPE; \`abaco\` is in neither)`,
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
