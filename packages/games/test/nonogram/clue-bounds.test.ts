import { describe, expect, it } from "vitest";

import { deriveClues } from "../../src/nonogram/clues";
import { mirrorH } from "../../src/nonogram/difficulty";
import { MOTIFS, motifBitmap } from "../../src/nonogram/motifs";

const WORST_ROW: Readonly<Record<number, readonly [number, number]>> = {
  5: [3, 3],
  8: [4, 4],
  10: [5, 5],
  15: [5, 5],
};

interface Bound {
  chars: number;
  runs: number;
}

function worstRowPerSize(): Map<number, Bound> {
  const worst = new Map<number, Bound>();
  for (const motif of MOTIFS) {
    const base = motifBitmap(motif);

    const bitmaps = motif.mirrorable ? [base, mirrorH(base)] : [base];
    for (const bitmap of bitmaps) {
      const bound = worst.get(motif.size) ?? { chars: 0, runs: 0 };
      for (const line of deriveClues(bitmap).rows) {
        const chars = line.reduce((sum, run) => sum + String(run).length, 0);
        bound.chars = Math.max(bound.chars, chars);
        bound.runs = Math.max(bound.runs, line.length);
      }
      worst.set(motif.size, bound);
    }
  }
  return worst;
}

describe("row-clue bound", () => {
  it("holds the per-size maximum apps/web's WORST_ROW is pinned to", () => {
    const worst = worstRowPerSize();
    expect([...worst.keys()].sort((a, b) => a - b)).toEqual([5, 8, 10, 15]);
    for (const [size, bound] of worst) {
      const pinned = WORST_ROW[size];
      expect(pinned, `size ${String(size)} is unpinned`).toBeDefined();
      expect(
        [bound.chars, bound.runs],
        `size ${String(size)}: update WORST_ROW in apps/web/test/nonogram-screen.test.tsx, then re-check assertion A3`,
      ).toEqual(pinned);
    }
  });
});
