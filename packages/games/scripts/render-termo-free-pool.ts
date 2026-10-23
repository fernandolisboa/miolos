import {
  excludedWords,
  parseCanonicalCsv,
  renderWordsModule,
  VERO_NOTICE,
} from "./render-termo-words.ts";

export function renderTermoFreePoolModule(
  commonCsv: string,
  answersCsv: string,
  excludedTxt: string,
): string {
  const answers = new Set(
    parseCanonicalCsv("answers.csv", answersCsv).map((row) => row.normalized),
  );
  const excluded = excludedWords(excludedTxt);
  const pool = parseCanonicalCsv("common.csv", commonCsv)
    .filter(
      (row) => !answers.has(row.normalized) && !excluded.has(row.normalized),
    )
    .map((row) => row.canonical);
  return renderWordsModule(
    "content/termo/common.csv, answers.csv and excluded.txt",
    "FREE_POOL_CANONICALS",
    "canonical common words that are never in answers.csv and never excluded, common.csv order",
    pool,
    VERO_NOTICE,
  );
}
