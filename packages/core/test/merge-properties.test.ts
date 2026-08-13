import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  computeStreak,
  COMPLETION_OUTCOMES,
  GAMES,
  mergeCompletions,
  type Game,
  type MergeableCompletion,
} from "../src/index";

/**
 * Property tests for `mergeCompletions` (ADR-0023: main properties run at
 * ≥ 100; these all run at exactly 100). The domain is shaped so collisions
 * — the thing the merge is about — actually occur: dates in a ~20-day
 * window around a generated `today`, games from GAMES, and per-side keys
 * kept unique via `fc.uniqueArray` on (game, date), mirroring the PK.
 * `completedAtOrder` is a zero-padded fixed-width numeric string —
 * lexicographic order IS numeric order — standing in for the DB's
 * fixed-width UTC instant (plan 029 D3): the key is compared, never parsed.
 */

/** Whole days since the epoch → 'YYYY-MM-DD' (the test-side inverse). */
function isoOf(epochDay: number): string {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

// A comfortable modern window: 2020-01-01 (18262) .. 2030-12-31 (22279).
const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 40, max: DAY_MAX });

/** Fixed-width numeric ordering key: ties arise, order is total. */
const orderArb = fc
  .integer({ min: 0, max: 999 })
  .map((n) => String(n).padStart(6, "0"));

function rowArb(
  todayDay: number,
  games: readonly Game[],
): fc.Arbitrary<MergeableCompletion> {
  return fc.record({
    game: fc.constantFrom(...games),
    date: fc.integer({ min: todayDay - 18, max: todayDay + 1 }).map(isoOf),
    outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
    onTime: fc.boolean(),
    completedAtOrder: orderArb,
  });
}

function keyOf(completion: MergeableCompletion): string {
  return `${completion.game}:${completion.date}`;
}

/** One account's history: unique (game, date) keys, as the PK guarantees. */
function sideArb(
  todayDay: number,
  games: readonly Game[] = GAMES,
): fc.Arbitrary<MergeableCompletion[]> {
  return fc.uniqueArray(rowArb(todayDay, games), {
    selector: keyOf,
    maxLength: 40,
  });
}

const inputArb = todayDayArb.chain((todayDay) =>
  fc.record({
    today: fc.constant(isoOf(todayDay)),
    a: sideArb(todayDay),
    b: sideArb(todayDay),
  }),
);

/** Fisher–Yates over a copy, driven by fast-check's index stream. */
function shuffled<T>(
  items: readonly T[],
  indices: IterableIterator<number>,
): T[] {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const next = indices.next();
    const j = (next.done ? 0 : next.value) % (i + 1);
    const a = output[i];
    const b = output[j];
    if (a !== undefined && b !== undefined) {
      output[i] = b;
      output[j] = a;
    }
  }
  return output;
}

/**
 * The counted-day oracle, restated from computeStreak's own rule (ADR-0048
 * decision 1): a day counts iff it has ≥ 1 on-time won row not after today.
 * ISO strings compare correctly as strings; no date arithmetic needed.
 */
function countedDays(
  rows: readonly MergeableCompletion[],
  today: string,
): Set<string> {
  return new Set(
    rows
      .filter((r) => r.outcome === "won" && r.onTime && r.date <= today)
      .map((r) => r.date),
  );
}

describe("mergeCompletions — properties (ADR-0023)", () => {
  it("T-CORE-S42: determinism and per-input permutation invariance over the domain", () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.infiniteStream(fc.nat()),
        ({ a, b }, indices) => {
          const reference = mergeCompletions(a, b);
          // Repeated calls agree (no clock, no randomness).
          expect(mergeCompletions(a, b)).toEqual(reference);
          // Shuffling either input (unique per-side keys, as the PK
          // guarantees) changes nothing.
          expect(mergeCompletions(shuffled(a, indices), b)).toEqual(reference);
          expect(mergeCompletions(a, shuffled(b, indices))).toEqual(reference);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S43: union-earliest-dedupe — every key survives exactly once, every survivor is an untouched input row, and none is beaten by an earlier input row", () => {
    fc.assert(
      fc.property(inputArb, ({ a, b }) => {
        const merged = mergeCompletions(a, b);
        const all = [...a, ...b];
        // Output keys = union of input keys, exactly once each — "no real
        // completion ever lost" at the key level (ADR-0009: every puzzle
        // either account completed stays completed).
        const mergedKeys = merged.map(keyOf);
        expect(new Set(mergedKeys).size).toBe(mergedKeys.length);
        expect(new Set(mergedKeys)).toEqual(new Set(all.map(keyOf)));
        for (const survivor of merged) {
          // Reference-identical to an input row: carried unchanged, never
          // fabricated, never mutated (#58's onTime obligation included).
          expect(all.includes(survivor)).toBe(true);
          // Earliest wins: no input row for the key is strictly earlier.
          for (const candidate of all) {
            if (keyOf(candidate) === keyOf(survivor)) {
              expect(
                candidate.completedAtOrder >= survivor.completedAtOrder,
              ).toBe(true);
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S44: idempotence — with m = merge(a, b), re-merging b, nothing, or m itself all fix m", () => {
    fc.assert(
      fc.property(inputArb, ({ a, b }) => {
        const m = mergeCompletions(a, b);
        // The AC's "merging twice = merging once" at the pure level; the
        // operation-level twin is T-DB-S20 (plan 029 D10).
        expect(mergeCompletions(m, b)).toEqual(m);
        expect(mergeCompletions(m, [])).toEqual(m);
        expect(mergeCompletions(m, m)).toEqual(m);
      }),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S45: AC 2's fuller calendar — disjoint keys union every counted day, so the merged streak never reads below either input's", () => {
    // The two-devices-different-days shape (ADR-0009's consequence): the
    // games are PARTITIONED between the inputs over one shared date window,
    // so keys are disjoint by construction and every row survives.
    const partitionedArb = todayDayArb.chain((todayDay) =>
      fc.integer({ min: 1, max: GAMES.length - 1 }).chain((split) =>
        fc.record({
          today: fc.constant(isoOf(todayDay)),
          a: sideArb(todayDay, GAMES.slice(0, split)),
          b: sideArb(todayDay, GAMES.slice(split)),
        }),
      ),
    );
    fc.assert(
      fc.property(partitionedArb, ({ today, a, b }) => {
        const merged = mergeCompletions(a, b);
        const union = new Set([
          ...countedDays(a, today),
          ...countedDays(b, today),
        ]);
        expect(countedDays(merged, today)).toEqual(union);
        // A superset of counted days never shortens the anchored run
        // (T-CORE-S31's monotonicity), so the merged streak dominates both
        // — "may end up longer … correct, not a bug" (ADR-0009).
        const mergedStreak = computeStreak(merged, today).streak;
        expect(mergedStreak).toBeGreaterThanOrEqual(
          computeStreak(a, today).streak,
        );
        expect(mergedStreak).toBeGreaterThanOrEqual(
          computeStreak(b, today).streak,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S46: the merge never invents a day — general inputs, collisions allowed", () => {
    fc.assert(
      fc.property(inputArb, ({ today, a, b }) => {
        const merged = mergeCompletions(a, b);
        const union = new Set([
          ...countedDays(a, today),
          ...countedDays(b, today),
        ]);
        // ⊆, not =: a collision may DROP a counted day (the T-CORE-S39
        // carve-out), but no merged counted day appears from nowhere —
        // every survivor is an input row (T-CORE-S43).
        for (const day of countedDays(merged, today)) {
          expect(union.has(day)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
