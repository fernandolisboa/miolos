import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { renderTermoWordsModule } from "../../scripts/render-termo-words";
import { normalizeWord } from "../../src/termo/normalize";
import {
  isValidGuess,
  TERMO_ANSWERS,
  TERMO_VALIDATION_WORDS,
} from "../../src/termo/word-list";

// ADR-0015 harness: proves the reviewed word list's invariants against the
// real content/termo artifacts on every test run. This gate is what allows
// #27 to trust @miolos/games/termo as the sole ingestion path for the list.

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..", "..", "..");
const contentDir = join(repoRoot, "content", "termo");
const gamesDir = join(testDir, "..", "..");

const ANSWER_COUNT = 400;
const VALIDATION_COUNT = 5310;
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

/** canonical-map.csv header is `normalized,canonical`. */
function readCanonicalMap(): { normalized: string; canonical: string }[] {
  const [header, ...rows] = readLines("canonical-map.csv");
  expect(header).toBe("normalized,canonical");
  return rows.map((row) => {
    const columns = row.split(",");
    expect(columns).toHaveLength(2);
    return { normalized: columns[0] ?? "", canonical: columns[1] ?? "" };
  });
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
    // ADR-0015: sabia/sábia/sabiá is one slot.
    const normalized = readAnswersCsv().map((row) => row.normalized);
    expect(new Set(normalized).size).toBe(ANSWER_COUNT);
  });

  it("every answer normalized form is in the validation dictionary", () => {
    const validation = new Set(readLines("validation.txt"));
    for (const row of readAnswersCsv()) {
      expect(validation.has(row.normalized), row.normalized).toBe(true);
    }
  });

  it("every answer canonical normalizes to its normalized column via normalizeWord", () => {
    // The TS↔Python parity pin over the answers (pipeline.py keeps the
    // Python copy; this makes drift between them a test failure).
    for (const row of readAnswersCsv()) {
      expect(normalizeWord(row.canonical)).toBe(row.normalized);
    }
  });

  it("validation.txt is sorted, unique, and every word matches ^[a-z]{5}$", () => {
    const words = readLines("validation.txt");
    expect(words).toHaveLength(VALIDATION_COUNT);
    expect(new Set(words).size).toBe(VALIDATION_COUNT);
    expect([...words].sort()).toEqual(words);
    for (const word of words) {
      expect(word).toMatch(NORMALIZED_SHAPE);
    }
  });

  it("canonical-map covers exactly the validation set and every canonical normalizes to its key", () => {
    // Parity proved over the full accented corpus even though the map never
    // ships in the runtime.
    const rows = readCanonicalMap();
    const validation = readLines("validation.txt");
    expect(new Set(rows.map((row) => row.normalized))).toEqual(
      new Set(validation),
    );
    expect(rows).toHaveLength(validation.length);
    for (const row of rows) {
      expect(normalizeWord(row.canonical)).toBe(row.normalized);
    }
  });

  it("words.generated.ts is byte-identical to the renderer output from content/termo", () => {
    // Staleness gate: hand-editing the generated module or editing the CSVs
    // without regenerating fails here. Same renderer as the codegen script —
    // no second rendering implementation.
    const answersCsv = readFileSync(join(contentDir, "answers.csv"), "utf8");
    const validationTxt = readFileSync(
      join(contentDir, "validation.txt"),
      "utf8",
    );
    const onDisk = readFileSync(
      join(gamesDir, "src", "termo", "words.generated.ts"),
      "utf8",
    );
    expect(onDisk).toBe(renderTermoWordsModule(answersCsv, validationTxt));
  });

  it("TERMO_ANSWERS preserves answers.csv row order", () => {
    // The order is contractual: #27's server-side seeded pick (ADR-0010)
    // indexes into TERMO_ANSWERS; reordering is a breaking change.
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
    expect(TERMO_VALIDATION_WORDS).toHaveLength(VALIDATION_COUNT);
    expect(isValidGuess("ábaco")).toBe(true);
    expect(isValidGuess("xqzwv")).toBe(false);
  });

  it("TERMO_VALIDATION_WORDS equals validation.txt line-for-line", () => {
    // Renderer-independent anchor: a renderer parsing bug would byte-match
    // its own wrong output in the staleness test; this ties the runtime
    // export directly to the reviewed content artifact.
    expect([...TERMO_VALIDATION_WORDS]).toEqual(readLines("validation.txt"));
  });
});
