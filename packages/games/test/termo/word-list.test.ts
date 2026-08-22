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
// real content/termo artifacts on every test run, so the rest of the repo
// can trust @miolos/games/termo as the sole ingestion path for the list.

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..", "..", "..");
const contentDir = join(repoRoot, "content", "termo");
const gamesDir = join(testDir, "..", "..");

const ANSWER_COUNT = 400;
const VALIDATION_COUNT = 5408; // 5310 from the IME-USP lexicon + 98 curated additions (ADR-0062)
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

/** Returns every value that appears more than once, so failures name the offending word(s). */
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
    // The TS↔Python parity pin over the answers (pipeline.py keeps the
    // Python copy; this makes drift between them a test failure).
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
    // Order is contractual because the harness pins this array against
    // answers.csv row by row. The daily draw does NOT index it — it filters
    // used answers out and draws uniformly (see word-list.ts).
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

  it('accepts "áudio" and its unaccented typing "audio" as guesses (#140)', () => {
    // The reported defect: the IME-USP lexicon lacks the standalone noun
    // "áudio", so the guess dictionary rejected an ordinary pt-BR word.
    // Closed by content/termo/additions.txt (ADR-0062). Both spellings ride
    // one normalized entry, exactly like rádio/radio always did.
    expect(isValidGuess("áudio")).toBe(true);
    expect(isValidGuess("audio")).toBe(true);
  });

  it("every additions.txt canonical is shaped, sorted, unique, and guessable through the shipped predicate", () => {
    // Pins the curated-additions artifact (ADR-0062) to the runtime:
    // pipeline.py enforces the same shape at generation time, but nothing on
    // that side can see the shipped dictionary. Sort order is the pipeline's
    // (normalized form, then canonical) — additions.txt carries accented
    // canonicals, so a plain codepoint sort would not read naturally.
    const additions = readLines("additions.txt");
    expect(additions.length).toBeGreaterThan(0);
    expect(findDuplicates(additions)).toEqual([]);
    // Codepoint comparison, not localeCompare: pipeline.py sorts the same
    // tuple with Python's plain string order, and the pin is exact parity.
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

  it("TERMO_VALIDATION_WORDS equals validation.txt line-for-line", () => {
    // Renderer-independent anchor: a renderer parsing bug would byte-match
    // its own wrong output in the staleness test; this ties the runtime
    // export directly to the reviewed content artifact.
    expect([...TERMO_VALIDATION_WORDS]).toEqual(readLines("validation.txt"));
  });
});
