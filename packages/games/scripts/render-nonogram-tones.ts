import type { MotifTones } from "../src/nonogram/tones.ts";

export function encodeToneRuns(rows: ReadonlyArray<string>): string {
  return rows
    .join("")
    .replaceAll(".", "")
    .replace(/(.)\1*/g, (run, tone: string) =>
      run.length === 1 ? tone : `${tone}${String(run.length)}`,
    );
}

export function renderNonogramTonesModule(
  tables: ReadonlyArray<MotifTones>,
): string {
  const lines = tables.flatMap((table) =>
    Object.entries(table).map(([id, rows]) => `${id}:${encodeToneRuns(rows)}`),
  );
  return [
    "// GENERATED FILE - do not edit.",
    "// Produced by scripts/generate-nonogram-tones.ts from src/nonogram/colors-{5,8,10,15}.ts.",
    "// Regenerate: pnpm --filter @miolos/games generate:nonogram",
    "// A staleness test under test/ fails CI if this file and its sources disagree.",
    "",
    `/** ${String(lines.length)} motifs as "id:runs", each run a tone letter and its length over the filled cells in row order, "\\n"-joined. */`,
    "export const MOTIF_TONE_RUNS: string =",
    `  ${JSON.stringify(lines.join("\n"))};`,
    "",
  ].join("\n");
}
