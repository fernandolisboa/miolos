import { LEXICON_COLUMNS, parseTsv } from "./render-crossword-lexicon.ts";
import {
  parseAnswersCsv,
  parseExcludedTxt,
  parseWordLines,
  renderWordsModule,
  VERO_NOTICE,
} from "./render-termo-words.ts";

export function renderTermoFreePoolModule(
  lexiconTsv: string,
  validationTxt: string,
  answersCsv: string,
  excludedTxt: string,
): string {
  const guessable = new Set(parseWordLines("validation.txt", validationTxt));
  const answers = new Set(
    parseAnswersCsv(answersCsv).map((row) => row.normalized),
  );
  const excluded = new Set(
    parseExcludedTxt(excludedTxt).map((row) => row.normalized),
  );
  const pool = parseTsv("lexicon.tsv", lexiconTsv, LEXICON_COLUMNS)
    .filter(
      ([normalized = ""]) =>
        normalized.length === 5 &&
        guessable.has(normalized) &&
        !answers.has(normalized) &&
        !excluded.has(normalized),
    )
    .map(([, canonical = ""]) => canonical);
  return renderWordsModule(
    "content/crossword/lexicon.tsv, content/termo/validation.txt, answers.csv and excluded.txt",
    "FREE_POOL_CANONICALS",
    "canonical five-letter lexicon words that are guesses, never answers and never excluded, lexicon.tsv order",
    pool,
    VERO_NOTICE,
  );
}
