import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  guessWords,
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

const ANSWER_COUNT = 626;
const VALIDATION_COUNT = 18250;
const ISPELL_COUNT = 5310;
const PROFANITY_COUNT = 41;
const NORMALIZED_SHAPE = /^[a-z]{5}$/;

function readLines(file: string): string[] {
  const raw = readFileSync(join(contentDir, file), "utf8");
  const trimmed = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  return trimmed.split("\n");
}

interface AnswerRow {
  readonly canonical: string;
  readonly normalized: string;
}

function readAnswersCsv(): AnswerRow[] {
  const [header, ...rows] = readLines("answers.csv");
  expect(header).toBe("canonical,normalized");
  return rows.map((row) => {
    const columns = row.split(",");
    expect(columns).toHaveLength(2);
    return { canonical: columns[0] ?? "", normalized: columns[1] ?? "" };
  });
}

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
    expect(normalized).toHaveLength(ANSWER_COUNT);
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

  it("excluded.txt is sorted, unique, profanity-only, and names dictionary words that are never answers", () => {
    const rows = readExcluded();
    const words = rows.map((row) => row.normalized);
    expect(findDuplicates(words)).toEqual([]);
    expect([...words].sort()).toEqual(words);
    expect(rows.filter((row) => row.reason === "profanity")).toHaveLength(
      PROFANITY_COUNT,
    );
    expect(rows.filter((row) => row.reason !== "profanity")).toEqual([]);
    const validation = new Set(readLines("validation.txt"));
    const answers = new Set(readAnswersCsv().map((row) => row.normalized));
    for (const word of words) {
      expect(word).toMatch(NORMALIZED_SHAPE);
      expect(validation.has(word), word).toBe(true);
      expect(answers.has(word), word).toBe(false);
    }
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
      renderTermoAnswersModule(answersCsv),
    );
  });

  it("TERMO_ANSWERS preserves answers.csv row order", () => {
    const rows = readAnswersCsv();
    expect(TERMO_ANSWERS).toHaveLength(rows.length);
    expect(TERMO_ANSWERS.map((a) => ({ ...a }))).toEqual(rows);
  });

  it("exports are frozen and sized", () => {
    expect(Object.isFrozen(TERMO_ANSWERS)).toBe(true);
    expect(Object.isFrozen(TERMO_VALIDATION_WORDS)).toBe(true);
    for (const answer of TERMO_ANSWERS) {
      expect(Object.isFrozen(answer)).toBe(true);
    }
    expect(TERMO_ANSWERS).toHaveLength(ANSWER_COUNT);
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
