import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { deriveClues } from "./clues";
import { MOTIFS, motifBitmap, type Motif } from "./motifs";
import { effortScore, solveNonogram } from "./solve";
import type { NonogramApprovalCriteria, NonogramSolution } from "./types";

export const MIN_POOL = 14;

export const T8 = 2.17;
export const T10 = 2.19;
export const T15 = 3.12;

export const NONOGRAM_WEEKDAY_CRITERIA: Readonly<
  Record<Weekday, NonogramApprovalCriteria>
> = {
  1: { size: 5, minEffort: 0, maxEffort: Number.POSITIVE_INFINITY },
  2: { size: 8, minEffort: 0, maxEffort: T8 },
  3: { size: 8, minEffort: T8, maxEffort: Number.POSITIVE_INFINITY },
  4: { size: 10, minEffort: 0, maxEffort: T10 },
  5: { size: 10, minEffort: T10, maxEffort: Number.POSITIVE_INFINITY },
  6: { size: 15, minEffort: 0, maxEffort: T15 },
  7: { size: 15, minEffort: T15, maxEffort: Number.POSITIVE_INFINITY },
};

export function mirrorH(solution: NonogramSolution): NonogramSolution {
  return solution.map((row) => [...row].reverse());
}

export interface PoolEntry {
  readonly motif: Motif;
  readonly mirrored: boolean;
}

const poolCache = new Map<Weekday, ReadonlyArray<PoolEntry>>();

export function weekdayPool(weekday: Weekday): ReadonlyArray<PoolEntry> {
  if (!isWeekday(weekday)) {
    throw new RangeError(
      `weekday must be an integer in 1..7 (ISO 8601), got ${String(weekday)}`,
    );
  }
  const cached = poolCache.get(weekday);
  if (cached !== undefined) {
    return cached;
  }
  const criteria = NONOGRAM_WEEKDAY_CRITERIA[weekday];
  const pool: PoolEntry[] = [];
  for (const motif of MOTIFS) {
    if (motif.size !== criteria.size) {
      continue;
    }
    const base = motifBitmap(motif);
    const variants: ReadonlyArray<{
      bitmap: NonogramSolution;
      mirrored: boolean;
    }> = motif.mirrorable
      ? [
          { bitmap: base, mirrored: false },
          { bitmap: mirrorH(base), mirrored: true },
        ]
      : [{ bitmap: base, mirrored: false }];
    for (const variant of variants) {
      const result = solveNonogram(deriveClues(variant.bitmap));
      if (result.status !== "solved") {
        continue;
      }
      const score = effortScore(result);
      if (score >= criteria.minEffort && score < criteria.maxEffort) {
        pool.push({ motif, mirrored: variant.mirrored });
      }
    }
  }
  poolCache.set(weekday, pool);
  return pool;
}
