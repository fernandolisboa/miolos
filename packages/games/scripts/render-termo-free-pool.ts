import { LEXICON_COLUMNS, parseTsv } from "./render-crossword-lexicon.ts";
import {
  parseAnswersCsv,
  parseValidationTxt,
  renderWordsModule,
} from "./render-termo-words.ts";

export function renderTermoFreePoolModule(
  lexiconTsv: string,
  validationTxt: string,
  answersCsv: string,
): string {
  const guessable = new Set(parseValidationTxt(validationTxt));
  const answers = new Set(
    parseAnswersCsv(answersCsv).map((row) => row.normalized),
  );
  const pool = parseTsv("lexicon.tsv", lexiconTsv, LEXICON_COLUMNS)
    .filter(
      ([normalized = ""]) =>
        normalized.length === 5 &&
        guessable.has(normalized) &&
        !answers.has(normalized),
    )
    .map(([, canonical = ""]) => canonical);
  return renderWordsModule(
    "content/crossword/lexicon.tsv, content/termo/validation.txt and content/termo/answers.csv",
    "FREE_POOL_CANONICALS",
    "canonical five-letter lexicon words that are guesses and never answers, lexicon.tsv order",
    pool,
  );
}
