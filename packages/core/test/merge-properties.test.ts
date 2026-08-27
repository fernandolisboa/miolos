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

function isoOf(epochDay: number): string {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 40, max: DAY_MAX });

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

          expect(mergeCompletions(a, b)).toEqual(reference);

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

        const mergedKeys = merged.map(keyOf);
        expect(new Set(mergedKeys).size).toBe(mergedKeys.length);
        expect(new Set(mergedKeys)).toEqual(new Set(all.map(keyOf)));
        for (const survivor of merged) {
          expect(all.includes(survivor)).toBe(true);

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

        expect(mergeCompletions(m, b)).toEqual(m);
        expect(mergeCompletions(m, [])).toEqual(m);
        expect(mergeCompletions(m, m)).toEqual(m);
      }),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S45: AC 2's fuller calendar — disjoint keys union every counted day, so the merged streak never reads below either input's", () => {
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

        for (const day of countedDays(merged, today)) {
          expect(union.has(day)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
