import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  parseTsv,
  renderCrosswordLexiconModule,
} from "../../scripts/render-crossword-lexicon";
import { CROSSWORD_LEXICON } from "../../src/crossword/lexicon.generated";
import { normalizeWord } from "../../src/normalize";

const testDir = dirname(fileURLToPath(import.meta.url));
const contentDir = join(
  testDir,
  "..",
  "..",
  "..",
  "..",
  "content",
  "crossword",
);
const generatedPath = join(
  testDir,
  "..",
  "..",
  "src",
  "crossword",
  "lexicon.generated.ts",
);

const NORMALIZED_SHAPE = /^[a-z]{3,7}$/;
const MAX_CLUE_LENGTH = 48;
const LENGTH_FLOORS: ReadonlyMap<number, number> = new Map([
  [3, 220],
  [4, 1050],
  [5, 2850],
  [6, 2700],
  [7, 2700],
]);
const REJECTION_REASONS: ReadonlySet<string> = new Set([
  "proper-noun",
  "foreign",
  "obscene",
  "abbreviation",
  "obscure",
  "archaic",
  "regional",
  "not-a-word",
  "interjection",
  "inflection",
  "offensive",
  "brand",
  "unclueable",
]);

function readContent(file: string): string {
  return readFileSync(join(contentDir, file), "utf8");
}

const lexiconTsv = readContent("lexicon.tsv");
const lexicon = parseTsv("lexicon.tsv", lexiconTsv, [
  "normalized",
  "canonical",
  "clue",
]).map(([normalized = "", canonical = "", clue = ""]) => ({
  normalized,
  canonical,
  clue,
}));
const rejected = parseTsv("rejected.tsv", readContent("rejected.tsv"), [
  "normalized",
  "canonical",
  "reason",
]).map(([normalized = "", canonical = "", reason = ""]) => ({
  normalized,
  canonical,
  reason,
}));

function duplicatesOf(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.push(value);
    }
    seen.add(value);
  }
  return duplicates;
}

function isSortedStrictly(values: readonly string[]): boolean {
  return values.every(
    (value, index) => index === 0 || (values[index - 1] ?? "") < value,
  );
}

function clueTokens(clue: string): string[] {
  return normalizeWord(clue)
    .split(/[^a-z]+/)
    .filter((token) => token !== "");
}

function isShapedAnswer(row: {
  normalized: string;
  canonical: string;
}): boolean {
  return (
    NORMALIZED_SHAPE.test(row.normalized) &&
    normalizeWord(row.canonical) === row.normalized
  );
}

function clueKey(clue: string): string {
  return clueTokens(clue).sort().join(" ");
}

describe("crossword lexicon harness", () => {
  it("every answer is 3-7 letters a-z and its canonical normalizes to it", () => {
    expect(lexicon.filter((row) => !isShapedAnswer(row))).toEqual([]);
  });

  it("answers are sorted and unique", () => {
    expect(isSortedStrictly(lexicon.map((row) => row.normalized))).toBe(true);
  });

  it("clues are short, capitalized or blank-led, and carry no terminal period", () => {
    const misshapen = lexicon.filter(
      ({ clue }) =>
        clue.length > MAX_CLUE_LENGTH ||
        !/^(\p{Lu}|___)/u.test(clue) ||
        clue.endsWith("."),
    );
    expect(misshapen).toEqual([]);
  });

  it("clues are unique across the lexicon, ignoring case, accents, punctuation and word order", () => {
    expect(duplicatesOf(lexicon.map((row) => clueKey(row.clue)))).toEqual([]);
  });

  it("no clue gives its answer away", () => {
    const givesAway = lexicon.filter(({ normalized, clue }) =>
      clueTokens(clue).some(
        (token) =>
          token === normalized ||
          (normalized.length >= 4 && token.startsWith(normalized)) ||
          (token.length >= 3 && normalized.startsWith(token)),
      ),
    );
    expect(givesAway).toEqual([]);
  });

  it("the give-away rule catches a token and a prefix, and spares a substring", () => {
    expect(clueTokens("Água do Mar, salgada")).toContain("mar");
    expect(clueTokens("Pessoa amarela")).not.toContain("mar");
    expect(clueTokens("Casinhas").some((t) => t.startsWith("casa"))).toBe(
      false,
    );
    expect(clueTokens("Casarão").some((t) => t.startsWith("casa"))).toBe(true);
    expect(clueKey("Tolo, bobo!")).toBe(clueKey("Bobo, tolo"));
  });

  it("each length keeps its floor", () => {
    for (const [length, floor] of LENGTH_FLOORS) {
      const count = lexicon.filter(
        (row) => row.normalized.length === length,
      ).length;
      expect(count, `${String(length)} letters`).toBeGreaterThanOrEqual(floor);
    }
  });

  it("rejected.tsv is shaped, sorted, closed-reasoned and disjoint from the lexicon", () => {
    expect(rejected.length).toBeGreaterThan(0);
    expect(isSortedStrictly(rejected.map((row) => row.normalized))).toBe(true);
    const answers = new Set(lexicon.map((row) => row.normalized));
    const offenders = rejected.filter(
      (row) =>
        !isShapedAnswer(row) ||
        !REJECTION_REASONS.has(row.reason) ||
        answers.has(row.normalized),
    );
    expect(offenders).toEqual([]);
  });

  it("lexicon.generated.ts is byte-identical to the renderer output", () => {
    expect(readFileSync(generatedPath, "utf8")).toBe(
      renderCrosswordLexiconModule(lexiconTsv),
    );
  });

  it("CROSSWORD_LEXICON carries every TSV row in order", () => {
    expect(CROSSWORD_LEXICON).toEqual(lexicon);
  });

  it("the renderer refuses a malformed TSV", () => {
    const header = "normalized\tcanonical\tclue\n";
    expect(() => renderCrosswordLexiconModule("wrong\n")).toThrow(/header/);
    expect(() => renderCrosswordLexiconModule(`${header}mar\tmar\n`)).toThrow(
      /3-column/,
    );
    expect(() => renderCrosswordLexiconModule(`${header}mar\tmar\t\n`)).toThrow(
      /3-column/,
    );
    expect(() =>
      renderCrosswordLexiconModule(`${header}mar\tmar\tÁgua\r\n`),
    ).toThrow(/CRLF/);
  });
});
