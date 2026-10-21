import {
  coloredRuns,
  deriveColoredClues,
  toneGrid,
} from "../../src/colored-nonogram/clues";
import { coloredPool } from "../../src/colored-nonogram/pool";
import type { ColoredRun } from "../../src/colored-nonogram/types";
import { MOTIFS } from "../../src/nonogram/motifs";
import { motifTones } from "../../src/nonogram-colors";

export const COLORED_SIZES = [5, 10, 15] as const;

export function variantPuzzle(id: string) {
  const base = id.replace(/~$/, "");
  const motif = MOTIFS.find((candidate) => candidate.id === base);
  const tones = motifTones(base, base !== id) ?? "";
  const clues = deriveColoredClues(motif?.size ?? 0, tones);
  return { clues, solution: toneGrid(clues.palette, tones) };
}

export function variantIds(size: number): string[] {
  return MOTIFS.filter((motif) => motif.size === size).flatMap((motif) =>
    motif.mirrorable ? [motif.id, `${motif.id}~`] : [motif.id],
  );
}

export function poolIds(size: number): string[] {
  return coloredPool(size).map(
    ({ motif, mirrored }) => `${motif.id}${mirrored ? "~" : ""}`,
  );
}

export function fittingLines(
  domains: readonly number[],
  runs: readonly ColoredRun[],
): number[][] {
  const lines: number[][] = [[]];
  for (const domain of domains) {
    const tones = [0, 1, 2, 3].filter((tone) => (domain >> tone) & 1);
    lines.splice(
      0,
      lines.length,
      ...lines.flatMap((line) => tones.map((tone) => [...line, tone])),
    );
  }
  return lines.filter(
    (line) => JSON.stringify(coloredRuns(line)) === JSON.stringify(runs),
  );
}
