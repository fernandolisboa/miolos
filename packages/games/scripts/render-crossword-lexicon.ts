import { splitLines } from "./split-lines.ts";

const LEXICON_COLUMNS = ["normalized", "canonical", "clue"] as const;

export function parseTsv(
  name: string,
  raw: string,
  columns: readonly string[],
): string[][] {
  const [header, ...rows] = splitLines(name, raw);
  if (header !== columns.join("\t")) {
    throw new Error(
      `${name}: expected header ${JSON.stringify(columns.join("\t"))}, got ${JSON.stringify(header ?? "")}`,
    );
  }
  return rows.map((row, index) => {
    const cells = row.split("\t");
    if (cells.length !== columns.length || cells.some((cell) => cell === "")) {
      throw new Error(
        `${name}: row ${String(index + 2)} is not a ${String(columns.length)}-column row: ${JSON.stringify(row)}`,
      );
    }
    return cells;
  });
}

export function renderCrosswordLexiconModule(lexiconTsv: string): string {
  const rows = parseTsv("lexicon.tsv", lexiconTsv, LEXICON_COLUMNS).map(
    ([normalized, canonical, clue]) =>
      `  { normalized: ${JSON.stringify(normalized)}, canonical: ${JSON.stringify(canonical)}, clue: ${JSON.stringify(clue)} },`,
  );
  return [
    "// GENERATED FILE - do not edit.",
    "// Produced by scripts/generate-crossword-lexicon.ts from content/crossword/lexicon.tsv.",
    "// Regenerate: pnpm --filter @miolos/games generate:crossword",
    "// test/crossword/lexicon.test.ts fails CI if this file and the TSV disagree.",
    "",
    'import type { CrosswordLexiconEntry } from "./types";',
    "",
    "export const CROSSWORD_LEXICON: readonly CrosswordLexiconEntry[] = [",
    ...rows,
    "];",
    "",
  ].join("\n");
}
