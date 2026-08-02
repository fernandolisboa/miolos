import { describe, expect, it } from "vitest";

import { deriveClues } from "../../src/nonogram/clues";
import { mirrorH } from "../../src/nonogram/difficulty";
import { MOTIFS, motifBitmap } from "../../src/nonogram/motifs";

/**
 * The clue-rail bound the web board's mobile geometry is derived from
 * (plan 020 §19 B1, ADR-0035 decision 4).
 *
 * WHY IT IS HERE AND NOT IN apps/web. `apps/web` deliberately never imports
 * `MOTIFS` — the motif tables must not reach the client bundle (ADR-0033
 * consequence (d), `apps/web/src/nonogram/engine.ts`'s barrel note) — so the
 * only place this enumeration can run is inside this package.
 *
 * THE CONSUMER, BY NAME. `apps/web/test/nonogram-screen.test.tsx`'s
 * `WORST_ROW` constant hard-codes the values asserted below and feeds them
 * into assertion A3, which proves the phone cell clears the two-digit clue
 * floor at 320px. A3 reads a literal, not the library, so nothing on the web
 * side can notice a motif that widens a rail. THIS file is the source of
 * truth: when it reds, the fix is to re-measure and update `WORST_ROW`, then
 * re-check A3 — never to relax the bound here.
 *
 * A3's slack at size 15 is under a pixel, so the failure mode this guards is
 * real rather than theoretical: a 15-row needing about seven digit characters
 * pushes the rendered cell under the floor with no web-side test firing.
 */

/**
 * Per size: the widest ROW clue in the shipped library, as
 * `[digit characters, runs]` — counting the digits the rail renders and the
 * number of `<span>`s they sit in, which is exactly what `.clueRow`'s
 * `column-gap` multiplies.
 *
 * Columns are not pinned: the column rail is a fixed-height band above the
 * board, and its width is the cell's, so a wider column clue costs nothing.
 */
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
    // Every variant the generator may ship, not just the authored one:
    // `weekdayPool` puts the mirrored form in the pool as its own entry.
    //
    // For ROW clues — all this file bounds — the mirrored pass provably
    // CANNOT widen the result, and saying so is the point (step-6 round-4
    // finding Q5): `mirrorH` reverses each row, so the run-length list of a
    // mirrored row is the reverse of the original's, leaving both `chars`
    // and `runs` invariant. It is enumerated for symmetry with `weekdayPool`
    // and so that a future column bound — where the mirror is NOT a
    // permutation of the same lines — inherits a loop that already walks the
    // real pool, not because it adds coverage today.
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
