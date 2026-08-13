import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  computeStreak,
  COMPLETION_OUTCOMES,
  type StreakRow,
} from "../src/index";

/**
 * Property tests for `computeStreak` (ADR-0023: main properties run at
 * ≥ 100; these all run at exactly 100). The domain is quantified as epoch
 * days in a window around a generated `today`, so consecutive-day structure
 * — the thing the function is about — arises often instead of never.
 */

/** Whole days since the epoch → 'YYYY-MM-DD' (the test-side inverse). */
function isoOf(epochDay: number): string {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

// A comfortable modern window: 2020-01-01 (18262) .. 2030-12-31 (22279).
const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 40, max: DAY_MAX });

/** Rows clustered near `today` so runs and anchor cases actually occur. */
function rowsArb(todayDay: number): fc.Arbitrary<StreakRow[]> {
  return fc.array(
    fc.record({
      date: fc
        .integer({ min: todayDay - 30, max: todayDay + 2 })
        .map((day) => isoOf(day)),
      outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
      onTime: fc.boolean(),
    }),
    { maxLength: 60 },
  );
}

const inputArb = todayDayArb.chain((todayDay) =>
  fc.record({
    today: fc.constant(isoOf(todayDay)),
    rows: rowsArb(todayDay),
  }),
);

describe("computeStreak — properties (ADR-0023)", () => {
  it("T-CORE-S30: permutation invariance and determinism over the domain", () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.infiniteStream(fc.nat()),
        ({ today, rows }, indices) => {
          const reference = computeStreak(rows, today);
          // Repeated calls agree (determinism: no clock, no randomness).
          expect(computeStreak(rows, today)).toEqual(reference);
          // Any permutation agrees (the Set construction).
          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const next = indices.next();
            const j = (next.done ? 0 : next.value) % (i + 1);
            const a = shuffled[i];
            const b = shuffled[j];
            if (a !== undefined && b !== undefined) {
              shuffled[i] = b;
              shuffled[j] = a;
            }
          }
          expect(computeStreak(shuffled, today)).toEqual(reference);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S31: monotone exclusions — lost/late rows never help, an on-time win never hurts", () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.integer({ min: -30, max: 2 }),
        fc.boolean(),
        fc.boolean(),
        ({ today, rows }, offset, insertLost, insertedOnTime) => {
          const before = computeStreak(rows, today);
          const todayDay = Math.round(
            Date.parse(`${today}T00:00:00Z`) / 86_400_000,
          );
          const date = isoOf(todayDay + offset);
          const inert: StreakRow = insertLost
            ? { date, outcome: "lost", onTime: insertedOnTime }
            : { date, outcome: "won", onTime: false };
          // Inserting a lost row or a late win never increases the streak
          // and never flips todayCounts to true (ADR-0008 rules 1–3).
          const withInert = computeStreak([...rows, inert], today);
          expect(withInert.streak).toBeLessThanOrEqual(before.streak);
          if (!before.todayCounts) {
            expect(withInert.todayCounts).toBe(false);
          }
          // Inserting an on-time win never decreases the streak.
          const helper: StreakRow = { date, outcome: "won", onTime: true };
          const withHelper = computeStreak([...rows, helper], today);
          expect(withHelper.streak).toBeGreaterThanOrEqual(before.streak);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S32: constructive oracle — k consecutive on-time wins ending at today or yesterday read exactly k", () => {
    fc.assert(
      fc.property(
        todayDayArb,
        fc.integer({ min: 1, max: 30 }),
        fc.boolean(),
        (todayDay, k, endsAtToday) => {
          const endDay = endsAtToday ? todayDay : todayDay - 1;
          const rows: StreakRow[] = [];
          for (let i = 0; i < k; i += 1) {
            rows.push({
              date: isoOf(endDay - i),
              outcome: "won",
              onTime: true,
            });
          }
          // The AC-5 arithmetic proved over the domain: the run reads
          // exactly k, and today counts iff the run ends at today.
          expect(computeStreak(rows, isoOf(todayDay))).toEqual({
            streak: k,
            todayCounts: endsAtToday,
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("T-CORE-S33: idempotent duplicates — re-inserting any present row changes nothing", () => {
    fc.assert(
      fc.property(inputArb, fc.nat(), ({ today, rows }, pickSeed) => {
        fc.pre(rows.length > 0);
        const reference = computeStreak(rows, today);
        const picked = rows[pickSeed % rows.length];
        if (picked === undefined) {
          return;
        }
        expect(computeStreak([...rows, picked], today)).toEqual(reference);
      }),
      { numRuns: 100 },
    );
  });
});
