const ANSWERS_HEADER = "canonical,normalized";

function splitLines(name: string, raw: string): string[] {
  if (raw.includes("\r")) {
    throw new Error(`${name}: CRLF line endings are not allowed`);
  }
  const trimmed = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  return trimmed.split("\n");
}

function parseAnswersCsv(answersCsv: string): string[] {
  const lines = splitLines("answers.csv", answersCsv);
  const header = lines[0];
  if (header !== ANSWERS_HEADER) {
    throw new Error(
      `answers.csv: expected header ${JSON.stringify(ANSWERS_HEADER)}, got ${JSON.stringify(header ?? "")}`,
    );
  }
  return lines.slice(1).map((line, index) => {
    const columns = line.split(",");
    if (columns.length !== 2 || columns[0] === "" || columns[1] === "") {
      throw new Error(
        `answers.csv: row ${String(index + 2)} is not a 2-column row: ${JSON.stringify(line)}`,
      );
    }
    return columns[0] ?? "";
  });
}

function parseValidationTxt(validationTxt: string): string[] {
  const lines = splitLines("validation.txt", validationTxt);
  for (const [index, line] of lines.entries()) {
    if (line === "") {
      throw new Error(`validation.txt: line ${String(index + 1)} is empty`);
    }
  }
  return lines;
}

export function renderTermoWordsModule(
  answersCsv: string,
  validationTxt: string,
): string {
  const answers = parseAnswersCsv(answersCsv);
  const validation = parseValidationTxt(validationTxt);
  const answersLiteral = JSON.stringify(answers.join("\n"));
  const validationLiteral = JSON.stringify(validation.join("\n"));
  return [
    "// GENERATED FILE - do not edit.",
    "// Produced by scripts/generate-termo-words.ts from content/termo/answers.csv",
    "// and content/termo/validation.txt. Regenerate:",
    "//   pnpm --filter @miolos/games generate:termo",
    "// The test/termo/word-list.test.ts staleness test fails CI if this file and",
    "// the CSVs disagree in either direction.",
    "",

    `/** ${String(answers.length)} canonical answer spellings, answers.csv row order, "\\n"-joined. */`,
    "export const ANSWER_CANONICALS: string =",
    `  ${answersLiteral};`,
    `/** ${String(validation.length)} normalized validation words, validation.txt order, "\\n"-joined. */`,
    "export const VALIDATION_WORDS: string =",
    `  ${validationLiteral};`,
    "",
  ].join("\n");
}
