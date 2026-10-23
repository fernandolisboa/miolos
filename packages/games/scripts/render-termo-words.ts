import { splitLines } from "./split-lines.ts";

const CANONICAL_CSV_HEADER = "canonical,normalized";

export interface CanonicalRow {
  readonly canonical: string;
  readonly normalized: string;
}

export function parseCanonicalCsv(name: string, raw: string): CanonicalRow[] {
  const lines = splitLines(name, raw);
  const header = lines[0];
  if (header !== CANONICAL_CSV_HEADER) {
    throw new Error(
      `${name}: expected header ${JSON.stringify(CANONICAL_CSV_HEADER)}, got ${JSON.stringify(header ?? "")}`,
    );
  }
  return lines.slice(1).map((line, index) => {
    const [canonical = "", normalized = "", ...rest] = line.split(",");
    if (rest.length !== 0 || canonical === "" || normalized === "") {
      throw new Error(
        `${name}: row ${String(index + 2)} is not a 2-column row: ${JSON.stringify(line)}`,
      );
    }
    return { canonical, normalized };
  });
}

function parseWordLines(name: string, raw: string): string[] {
  const lines = splitLines(name, raw);
  for (const [index, line] of lines.entries()) {
    if (line === "") {
      throw new Error(`${name}: line ${String(index + 1)} is empty`);
    }
  }
  return lines;
}

// see ADR-0152 decision 4
export const PROFANITY_IS_A_GUESS = false;

export const EXCLUSION_REASONS: ReadonlySet<string> = new Set([
  "archaic",
  "editorial",
  "foreign",
  "profanity",
  "proper-noun",
  "regional",
  "retired",
]);

export const VERO_NOTICE: readonly string[] = [
  "// Derived from VERO, the LibreOffice pt_BR dictionary (https://github.com/LibreOffice/dictionaries).",
  "// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.",
  "// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.",
];

export interface ExcludedRow {
  readonly normalized: string;
  readonly reason: string;
}

export function parseExcludedTxt(excludedTxt: string): ExcludedRow[] {
  return parseWordLines("excluded.txt", excludedTxt).map((line, index) => {
    const [normalized = "", reason = "", ...rest] = line.split("\t");
    if (rest.length !== 0 || !EXCLUSION_REASONS.has(reason)) {
      throw new Error(
        `excluded.txt: line ${String(index + 1)} is not a normalized<TAB>reason row: ${JSON.stringify(line)}`,
      );
    }
    return { normalized, reason };
  });
}

export function excludedWords(excludedTxt: string): ReadonlySet<string> {
  return new Set(parseExcludedTxt(excludedTxt).map((row) => row.normalized));
}

export function guessWords(
  validationTxt: string,
  excludedTxt: string,
): string[] {
  const refused = new Set(
    parseExcludedTxt(excludedTxt)
      .filter((row) => !PROFANITY_IS_A_GUESS && row.reason === "profanity")
      .map((row) => row.normalized),
  );
  return parseWordLines("validation.txt", validationTxt).filter(
    (word) => !refused.has(word),
  );
}

export function renderWordsModule(
  sources: string,
  exportName: string,
  description: string,
  words: readonly string[],
  notice: readonly string[] = [],
): string {
  return [
    "// GENERATED FILE - do not edit.",
    `// Produced by scripts/generate-termo-words.ts from ${sources}.`,
    "// Regenerate: pnpm --filter @miolos/games generate:termo",
    "// A staleness test under test/ fails CI if this file and its sources disagree.",
    ...notice,
    "",
    `/** ${String(words.length)} ${description}, "\\n"-joined. */`,
    `export const ${exportName}: string =`,
    `  ${JSON.stringify(words.join("\n"))};`,
    "",
  ].join("\n");
}

export function renderTermoAnswersModule(
  answersCsv: string,
  excludedTxt: string,
): string {
  const excluded = excludedWords(excludedTxt);
  return renderWordsModule(
    "content/termo/answers.csv and excluded.txt",
    "ANSWER_CANONICALS",
    "canonical answer spellings, answers.csv row order less excluded.txt",
    parseCanonicalCsv("answers.csv", answersCsv)
      .filter((row) => !excluded.has(row.normalized))
      .map((row) => row.canonical),
    VERO_NOTICE,
  );
}

export function renderTermoValidationModule(
  validationTxt: string,
  excludedTxt: string,
): string {
  return renderWordsModule(
    "content/termo/validation.txt and excluded.txt",
    "VALIDATION_WORDS",
    "normalized validation words, validation.txt order",
    guessWords(validationTxt, excludedTxt),
    VERO_NOTICE,
  );
}
