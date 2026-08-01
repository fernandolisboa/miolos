import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { deriveClues } from "./clues";
import { MOTIFS, motifBitmap, type Motif } from "./motifs";
import { effortScore, solveNonogram } from "./solve";
import type { NonogramApprovalCriteria, NonogramSolution } from "./types";

/** Every weekday pool must hold at least this many effective entries. */
export const MIN_POOL = 14;

/**
 * Effort thresholds splitting each shared size class into its easy/hard
 * weekday bands, half-open: easy = [0, T), hard = [T, ∞). Calibrated from
 * the measured effort distribution of the authored library (plan §1): the
 * threshold nearest the class median such that both sides keep >= MIN_POOL
 * effective entries, placed strictly inside a gap between two observed
 * scores so the partition is stable. Values recorded in ADR-0021:
 * T8 in (2.15625, 2.1875) -> 37 easy / 40 hard;
 * T10 in (2.18, 2.2) -> 32 easy / 35 hard;
 * T15 in (3.1155..., 3.1244...) -> 35 easy / 36 hard.
 */
export const T8 = 2.17;
export const T10 = 2.19;
export const T15 = 3.12;

/**
 * The weekday difficulty ramp (plan §1), ISO keyed: Monday = 1 (easiest,
 * whole 5×5 class) → Sunday = 7 (hardest, 15×15 hard band). Size is the
 * dominant axis; within a shared class the effort band orders the days.
 */
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

/** Reverse each row. The only transform (plan §3.4): a mirrored anchor is
 * still an anchor; rotations and vertical flips destroy recognizability. */
export function mirrorH(solution: NonogramSolution): NonogramSolution {
  return solution.map((row) => [...row].reverse());
}

export interface PoolEntry {
  readonly motif: Motif;
  readonly mirrored: boolean;
}

const poolCache = new Map<Weekday, ReadonlyArray<PoolEntry>>();

/**
 * Effective entries for a weekday: every motif of the weekday's size class
 * (plus the mirrored variant of every `mirrorable` motif) whose measured
 * solver effort falls inside the weekday's band. Pure derivation from
 * constant data, memoized on first use. Throws a RangeError when `weekday`
 * is outside 1..7 at runtime (untyped boundaries).
 */
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
        // The harness proves this unreachable for shipped content; skipping
        // (rather than throwing) keeps the pool a pure filter.
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
