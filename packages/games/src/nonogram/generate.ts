import { createSeededRandom } from "../random";
import type { Weekday } from "../weekday";
import { deriveClues } from "./clues";
import { WEEKDAY_CRITERIA, mirrorH, weekdayPool } from "./difficulty";
import { motifBitmap } from "./motifs";
import { NonogramGenerationError, type NonogramPuzzle } from "./types";
import { validateNonogram } from "./validate";

/** Deterministic retry cap (orchestrator convention; plan §3.3). */
export const MAX_ATTEMPTS = 8;

/**
 * Generate the Nonogram for (seed, weekday). Deterministic: the same pair
 * always yields the same puzzle. All randomness flows through one seeded
 * PRNG per attempt; attempt seeds derive from the base seed. Every pool
 * entry is harness-proven valid for its weekday, so attempt 0 succeeds in
 * practice — the retry loop and typed error are a cross-engine convention
 * and a tripwire against content/threshold drift.
 */
export function generateNonogram(
  seed: number,
  weekday: Weekday,
): NonogramPuzzle {
  const criteria = WEEKDAY_CRITERIA[weekday];
  const pool = weekdayPool(weekday);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const attemptSeed = ((seed >>> 0) + attempt * 0x9e3779b9) >>> 0;
    const random = createSeededRandom(attemptSeed);
    const entry = pool[random.nextInt(pool.length)];
    if (entry === undefined) {
      continue;
    }
    const base = motifBitmap(entry.motif);
    const solution = entry.mirrored ? mirrorH(base) : base;
    const puzzle: NonogramPuzzle = {
      game: "nonogram",
      seed: seed >>> 0,
      weekday,
      size: criteria.size,
      clues: deriveClues(solution),
      reveal: {
        motifId: entry.motif.id,
        name: entry.motif.name,
        mirrored: entry.mirrored,
        solution,
      },
    };
    // Defense in depth: the harness already proves every pool entry valid.
    if (validateNonogram(puzzle).ok) {
      return puzzle;
    }
  }
  throw new NonogramGenerationError(seed >>> 0, weekday, MAX_ATTEMPTS);
}
