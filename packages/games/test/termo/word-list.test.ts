import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EXCLUSION_REASONS,
  guessWords,
  parseCanonicalCsv,
  parseExcludedTxt,
  PROFANITY_IS_A_GUESS,
  renderTermoAnswersModule,
  renderTermoValidationModule,
} from "../../scripts/render-termo-words";
import { normalizeWord } from "../../src/normalize";
import {
  isValidGuess,
  TERMO_VALIDATION_WORDS,
} from "../../src/termo/word-list";
import { TERMO_ANSWERS } from "../../src/termo-answers";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..", "..", "..");
const contentDir = join(repoRoot, "content", "termo");
const gamesDir = join(testDir, "..", "..");

const ADR_0147_ROWS = 626;
const ADR_0147_PREFIX_SHA256 =
  "29b601ef3ae87417a5edbe63e431d106f8bd5e65741d86208bafaf40d1e98367";
const ANSWER_ROW_COUNT = 1726;
const COMMON_COUNT = 2990;
const VALIDATION_COUNT = 18250;
const ISPELL_COUNT = 5310;
const EXCLUDED_COUNTS: Readonly<Record<string, number>> = {
  archaic: 10,
  editorial: 73,
  foreign: 5,
  profanity: 41,
  "proper-noun": 34,
  regional: 50,
  retired: 0,
};
const NORMALIZED_SHAPE = /^[a-z]{5}$/;

function readLines(file: string): string[] {
  const raw = readFileSync(join(contentDir, file), "utf8");
  const trimmed = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  return trimmed.split("\n");
}

const readCanonicalCsv = (file: string) =>
  parseCanonicalCsv(file, readFileSync(join(contentDir, file), "utf8"));

const readAnswersCsv = () => readCanonicalCsv("answers.csv");
const readCommonCsv = () => readCanonicalCsv("common.csv");

const evenParity = (normalized: string): boolean =>
  (createHash("sha256").update(normalized, "utf8").digest()[0] ?? 1) % 2 === 0;

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.push(value);
    } else {
      seen.add(value);
    }
  }
  return duplicates;
}

function readExcluded() {
  return parseExcludedTxt(
    readFileSync(join(contentDir, "excluded.txt"), "utf8"),
  );
}

function shippedGuesses(): string[] {
  const read = (file: string) => readFileSync(join(contentDir, file), "utf8");
  return guessWords(read("validation.txt"), read("excluded.txt"));
}

describe("termo word-list harness (ADR-0015)", () => {
  it("every answer normalized form matches ^[a-z]{5}$", () => {
    for (const row of readAnswersCsv()) {
      expect(row.normalized).toMatch(NORMALIZED_SHAPE);
    }
    for (const answer of TERMO_ANSWERS) {
      expect(answer.normalized).toMatch(NORMALIZED_SHAPE);
    }
  });

  it("no two answers share a normalized form", () => {
    const normalized = readAnswersCsv().map((row) => row.normalized);
    expect(normalized).toHaveLength(ANSWER_ROW_COUNT);
    expect(findDuplicates(normalized)).toEqual([]);
  });

  it("every answer normalized form is in the validation dictionary", () => {
    const validation = new Set(readLines("validation.txt"));
    for (const row of readAnswersCsv()) {
      expect(validation.has(row.normalized), row.normalized).toBe(true);
    }
  });

  it("every answer canonical normalizes to its normalized column via normalizeWord", () => {
    for (const row of readAnswersCsv()) {
      expect(normalizeWord(row.canonical)).toBe(row.normalized);
    }
  });

  it("validation.txt is sorted, unique, and every word matches ^[a-z]{5}$", () => {
    const words = readLines("validation.txt");
    expect(words).toHaveLength(VALIDATION_COUNT);
    expect(findDuplicates(words)).toEqual([]);
    expect([...words].sort()).toEqual(words);
    for (const word of words) {
      expect(word).toMatch(NORMALIZED_SHAPE);
    }
  });

  it("every frozen IME form in ispell.txt is still in validation.txt and still a guess, unless refused as profanity", () => {
    const ispell = readLines("ispell.txt");
    expect(ispell).toHaveLength(ISPELL_COUNT);
    expect(findDuplicates(ispell)).toEqual([]);
    expect([...ispell].sort()).toEqual(ispell);
    const validation = new Set(readLines("validation.txt"));
    const profanity = new Set(
      readExcluded()
        .filter((row) => row.reason === "profanity")
        .map((row) => row.normalized),
    );
    for (const word of ispell) {
      expect(validation.has(word), word).toBe(true);
      expect(isValidGuess(word), word).toBe(
        PROFANITY_IS_A_GUESS || !profanity.has(word),
      );
    }
  });

  it("accepts real words the IME list missed, and still refuses non-words", () => {
    for (const word of ["bolor", "chope", "sarau", "vocal", "sagui", "glifo"]) {
      expect(isValidGuess(word), word).toBe(true);
    }
    for (const word of ["xqzwv", "https", "vldis", "zzzzz"]) {
      expect(isValidGuess(word), word).toBe(false);
    }
  });

  it("excluded.txt is sorted, unique, counted per reason, and names guesses that are in answers.csv only when retired", () => {
    const rows = readExcluded();
    const words = rows.map((row) => row.normalized);
    expect(findDuplicates(words)).toEqual([]);
    expect([...words].sort()).toEqual(words);
    expect([...EXCLUSION_REASONS].sort()).toEqual(Object.keys(EXCLUDED_COUNTS));
    for (const [reason, count] of Object.entries(EXCLUDED_COUNTS)) {
      expect(
        rows.filter((row) => row.reason === reason),
        reason,
      ).toHaveLength(count);
    }
    const validation = new Set(readLines("validation.txt"));
    const answers = new Set(readAnswersCsv().map((row) => row.normalized));
    for (const { normalized, reason } of rows) {
      expect(normalized).toMatch(NORMALIZED_SHAPE);
      expect(validation.has(normalized), normalized).toBe(true);
      expect(answers.has(normalized), normalized).toBe(reason === "retired");
    }
  });

  it("refuses an excluded.txt row whose reason is not one of the seven", () => {
    expect(() => parseExcludedTxt("abade\tobscure\n")).toThrow(/line 1/);
    expect(parseExcludedTxt("abade\tretired\n")).toEqual([
      { normalized: "abade", reason: "retired" },
    ]);
  });

  it("only profanity rows ever leave the guesses", () => {
    const refused = new Set(readLines("validation.txt"));
    for (const word of shippedGuesses()) {
      refused.delete(word);
    }
    const profanity = readExcluded()
      .filter((row) => row.reason === "profanity")
      .map((row) => row.normalized);
    expect([...refused]).toEqual(PROFANITY_IS_A_GUESS ? [] : profanity);
  });

  it("common.csv is the alphabetical IME-and-VERO common words, each a frozen IME form and a guess", () => {
    const rows = readCommonCsv();
    const normalized = rows.map((row) => row.normalized);
    expect(rows).toHaveLength(COMMON_COUNT);
    expect(findDuplicates(normalized)).toEqual([]);
    expect([...normalized].sort()).toEqual(normalized);
    const ispell = new Set(readLines("ispell.txt"));
    const validation = new Set(readLines("validation.txt"));
    for (const row of rows) {
      expect(row.normalized).toMatch(NORMALIZED_SHAPE);
      expect(normalizeWord(row.canonical)).toBe(row.normalized);
      expect(ispell.has(row.normalized), row.normalized).toBe(true);
      expect(validation.has(row.normalized), row.normalized).toBe(true);
    }
  });

  it("the first 626 rows of answers.csv are ADR-0147's, byte for byte", () => {
    const prefix = readLines("answers.csv").slice(0, ADR_0147_ROWS + 1);
    expect(
      createHash("sha256")
        .update(`${prefix.join("\n")}\n`, "utf8")
        .digest("hex"),
    ).toBe(ADR_0147_PREFIX_SHA256);
  });

  it("every row past the prefix is a common.csv row of even SHA-256 parity", () => {
    const common = new Map(
      readCommonCsv().map((row) => [row.normalized, row.canonical]),
    );
    const appended = readAnswersCsv().slice(ADR_0147_ROWS);
    expect(appended.length).toBeGreaterThan(0);
    for (const { canonical, normalized } of appended) {
      expect(common.get(normalized), normalized).toBe(canonical);
      expect(evenParity(normalized), normalized).toBe(true);
    }
  });

  it("every common word of even parity that is not excluded is in answers.csv", () => {
    const answers = new Set(readAnswersCsv().map((row) => row.normalized));
    const excluded = new Set(readExcluded().map((row) => row.normalized));
    const missing = readCommonCsv()
      .map((row) => row.normalized)
      .filter(
        (word) => evenParity(word) && !excluded.has(word) && !answers.has(word),
      );
    expect(missing).toEqual([]);
  });

  it("a profanity row is a guess exactly when PROFANITY_IS_A_GUESS says so", () => {
    for (const word of ["merda", "foder", "mijou"]) {
      expect(isValidGuess(word), word).toBe(PROFANITY_IS_A_GUESS);
    }
  });

  it("words.generated.ts and answers.generated.ts are byte-identical to the renderer output from content/termo", () => {
    const answersCsv = readFileSync(join(contentDir, "answers.csv"), "utf8");
    const validationTxt = readFileSync(
      join(contentDir, "validation.txt"),
      "utf8",
    );
    const excludedTxt = readFileSync(join(contentDir, "excluded.txt"), "utf8");
    const onDisk = (...path: string[]) =>
      readFileSync(join(gamesDir, "src", ...path), "utf8");
    expect(onDisk("termo", "words.generated.ts")).toBe(
      renderTermoValidationModule(validationTxt, excludedTxt),
    );
    expect(onDisk("termo-answers", "answers.generated.ts")).toBe(
      renderTermoAnswersModule(answersCsv, excludedTxt),
    );
  });

  it("TERMO_ANSWERS is answers.csv less excluded.txt, in row order", () => {
    const excluded = new Set(readExcluded().map((row) => row.normalized));
    expect(TERMO_ANSWERS.map((a) => ({ ...a }))).toEqual(
      readAnswersCsv().filter((row) => !excluded.has(row.normalized)),
    );
  });

  it("exports are frozen and sized", () => {
    expect(Object.isFrozen(TERMO_ANSWERS)).toBe(true);
    expect(Object.isFrozen(TERMO_VALIDATION_WORDS)).toBe(true);
    for (const answer of TERMO_ANSWERS) {
      expect(Object.isFrozen(answer)).toBe(true);
    }
    expect(TERMO_ANSWERS).toHaveLength(ANSWER_ROW_COUNT);
    expect(TERMO_VALIDATION_WORDS).toHaveLength(shippedGuesses().length);
    expect(isValidGuess("ábaco")).toBe(true);
    expect(isValidGuess("xqzwv")).toBe(false);
  });

  it('accepts "áudio" and its unaccented typing "audio" as guesses (#140)', () => {
    expect(isValidGuess("áudio")).toBe(true);
    expect(isValidGuess("audio")).toBe(true);
  });

  it("every additions.txt canonical is shaped, sorted, unique, and guessable through the shipped predicate", () => {
    const additions = readLines("additions.txt");
    expect(additions.length).toBeGreaterThan(0);
    expect(findDuplicates(additions)).toEqual([]);

    const byCodepoint = (a: string, b: string): number =>
      a < b ? -1 : a > b ? 1 : 0;
    const resorted = [...additions].sort((a, b) => {
      const byNorm = byCodepoint(normalizeWord(a), normalizeWord(b));
      return byNorm !== 0 ? byNorm : byCodepoint(a, b);
    });
    expect(resorted).toEqual(additions);
    const validation = new Set(readLines("validation.txt"));
    for (const word of additions) {
      expect(normalizeWord(word)).toMatch(NORMALIZED_SHAPE);
      expect(validation.has(normalizeWord(word)), word).toBe(true);
      expect(isValidGuess(word), word).toBe(true);
    }
  });

  it("TERMO_VALIDATION_WORDS equals validation.txt line-for-line, less any refused profanity", () => {
    expect([...TERMO_VALIDATION_WORDS]).toEqual(shippedGuesses());
  });
});
