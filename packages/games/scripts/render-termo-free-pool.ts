import { LEXICON_COLUMNS, parseTsv } from "./render-crossword-lexicon.ts";
import {
  parseAnswersCsv,
  parseWordLines,
  renderWordsModule,
} from "./render-termo-words.ts";

export function renderTermoFreePoolModule(
  lexiconTsv: string,
  validationTxt: string,
  answersCsv: string,
  reserveTxt: string,
): string {
  const guessable = new Set(parseWordLines("validation.txt", validationTxt));
  const excluded = new Set([
    ...parseAnswersCsv(answersCsv).map((row) => row.normalized),
    ...parseWordLines("reserve.txt", reserveTxt),
  ]);
  const pool = parseTsv("lexicon.tsv", lexiconTsv, LEXICON_COLUMNS)
    .filter(
      ([normalized = ""]) =>
        normalized.length === 5 &&
        guessable.has(normalized) &&
        !excluded.has(normalized),
    )
    .map(([, canonical = ""]) => canonical);
  return renderWordsModule(
    "content/crossword/lexicon.tsv, content/termo/validation.txt, answers.csv and reserve.txt",
    "FREE_POOL_CANONICALS",
    "canonical five-letter lexicon words that are guesses, never answers and never reserved, lexicon.tsv order",
    pool,
  );
}
