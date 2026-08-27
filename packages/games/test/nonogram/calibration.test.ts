import { describe, expect, it } from "vitest";

import { deriveClues } from "../../src/nonogram/clues";
import { MIN_POOL, T8, T10, T15, mirrorH } from "../../src/nonogram/difficulty";
import { MOTIFS, motifBitmap } from "../../src/nonogram/motifs";
import { effortScore, solveNonogram } from "../../src/nonogram/solve";

function classScores(size: number): number[] {
  const scores: number[] = [];
  for (const motif of MOTIFS) {
    if (motif.size !== size) {
      continue;
    }
    const base = motifBitmap(motif);
    const bitmaps = motif.mirrorable ? [base, mirrorH(base)] : [base];
    for (const bitmap of bitmaps) {
      const result = solveNonogram(deriveClues(bitmap));
      expect(result.status, motif.id).toBe("solved");
      scores.push(effortScore(result));
    }
  }
  return scores.sort((a, b) => a - b);
}

describe("effort threshold calibration (shared size classes)", () => {
  const cases: ReadonlyArray<readonly [number, number, string]> = [
    [8, T8, "T8"],
    [10, T10, "T10"],
    [15, T15, "T15"],
  ];

  it("every threshold sits strictly inside an observed-score gap with both bands >= MIN_POOL", () => {
    for (const [size, threshold, label] of cases) {
      const scores = classScores(size);
      const below = scores.filter((score) => score < threshold);
      const above = scores.filter((score) => score >= threshold);
      const maxBelow = below[below.length - 1];
      const minAbove = above[0];

      console.info(
        `${label}=${String(threshold)} size ${String(size)}: ${String(scores.length)} entries, ` +
          `gap (${String(maxBelow)}, ${String(minAbove)}), split ${String(below.length)}/${String(above.length)}`,
      );

      expect(maxBelow, label).toBeDefined();
      expect(minAbove, label).toBeDefined();
      expect(maxBelow, label).toBeLessThan(threshold);
      expect(minAbove, label).toBeGreaterThan(threshold);
      expect(below.length, label).toBeGreaterThanOrEqual(MIN_POOL);
      expect(above.length, label).toBeGreaterThanOrEqual(MIN_POOL);
    }
  });
});
