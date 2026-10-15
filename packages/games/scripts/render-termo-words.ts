import { splitLines } from "./split-lines.ts";

const ANSWERS_HEADER = "canonical,normalized";

export interface AnswerRow {
  readonly canonical: string;
  readonly normalized: string;
}

export function parseAnswersCsv(answersCsv: string): AnswerRow[] {
  const lines = splitLines("answers.csv", answersCsv);
  const header = lines[0];
  if (header !== ANSWERS_HEADER) {
    throw new Error(
      `answers.csv: expected header ${JSON.stringify(ANSWERS_HEADER)}, got ${JSON.stringify(header ?? "")}`,
    );
  }
  return lines.slice(1).map((line, index) => {
    const [canonical = "", normalized = "", ...rest] = line.split(",");
    if (rest.length !== 0 || canonical === "" || normalized === "") {
      throw new Error(
        `answers.csv: row ${String(index + 2)} is not a 2-column row: ${JSON.stringify(line)}`,
      );
    }
    return { canonical, normalized };
  });
}

export function parseWordLines(name: string, raw: string): string[] {
  const lines = splitLines(name, raw);
  for (const [index, line] of lines.entries()) {
    if (line === "") {
      throw new Error(`${name}: line ${String(index + 1)} is empty`);
    }
  }
  return lines;
}

export function renderWordsModule(
  sources: string,
  exportName: string,
  description: string,
  words: readonly string[],
): string {
  return [
    "// GENERATED FILE - do not edit.",
    `// Produced by scripts/generate-termo-words.ts from ${sources}.`,
    "// Regenerate: pnpm --filter @miolos/games generate:termo",
    "// A staleness test under test/ fails CI if this file and its sources disagree.",
    "",
    `/** ${String(words.length)} ${description}, "\\n"-joined. */`,
    `export const ${exportName}: string =`,
    `  ${JSON.stringify(words.join("\n"))};`,
    "",
  ].join("\n");
}

export function renderTermoAnswersModule(answersCsv: string): string {
  return renderWordsModule(
    "content/termo/answers.csv",
    "ANSWER_CANONICALS",
    "canonical answer spellings, answers.csv row order",
    parseAnswersCsv(answersCsv).map((row) => row.canonical),
  );
}

export function renderTermoValidationModule(validationTxt: string): string {
  return renderWordsModule(
    "content/termo/validation.txt",
    "VALIDATION_WORDS",
    "normalized validation words, validation.txt order",
    parseWordLines("validation.txt", validationTxt),
  );
}
