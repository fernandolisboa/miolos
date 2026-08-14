import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  COMPLETION_OUTCOMES,
  dateFromEpochDay,
  earnedMedals,
  epochDay,
  GAMES,
  MEDAL_DEFINITIONS,
  type StatsRow,
} from "../src/index";

/**
 * Property tests for the #30 medal derivation (ADR-0023: main properties
 * run at ≥ 100; these run at exactly 100, pinned seed — sampled evidence,
 * never proof). The domain is the stats-properties register: epoch days in
 * a window around a generated `today`, rows quantified over the FULL type
 * (lost rows, late rows, null-guess termo rows, future-dated rows
 * included) — the function is total, and the properties must hold anyway.
 */

// A comfortable modern window: 2020-01-01 (18262) .. 2030-12-31 (22279).
const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 50, max: DAY_MAX });

/** Rows clustered near `today` so runs and same-date structure arise. */
function rowArb(todayDay: number): fc.Arbitrary<StatsRow> {
  return fc.record({
    game: fc.constantFrom(...GAMES),
    date: fc
      .integer({ min: todayDay - 45, max: todayDay + 2 })
      .map((day) => dateFromEpochDay(day)),
    outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
    onTime: fc.boolean(),
    elapsedMs: fc.integer({ min: 0, max: 3_600_000 }),
    hintsUsed: fc.integer({ min: 0, max: 3 }),
    guesses: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
  });
}

/** Grant ids: catalog ids (curated and rule-derived alike — the derivation
 *  must ignore the latter) plus unknown-but-shape-valid strays. */
const grantArb = fc.oneof(
  fc.constantFrom(...MEDAL_DEFINITIONS.map((d) => d.id)),
  fc.constantFrom("ghost-medal", "future-medal", "abc-123"),
);

const inputArb = todayDayArb.chain((todayDay) =>
  fc.record({
    todayDay: fc.constant(todayDay),
    today: fc.constant(dateFromEpochDay(todayDay)),
    rows: fc.array(rowArb(todayDay), { maxLength: 80 }),
    grants: fc.array(grantArb, { maxLength: 8 }),
  }),
);

describe("earnedMedals — properties (ADR-0023, sampled evidence)", () => {
  it("T-CORE-S75: monotonicity — adding rows never un-earns a medal — plus determinism and permutation invariance in rows and grants", () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.array(
          todayDayArb.chain((d) => rowArb(d)),
          { maxLength: 20 },
        ),
        fc.infiniteStream(fc.nat()),
        ({ today, rows, grants }, extra, indices) => {
          const reference = earnedMedals(rows, grants, today);

          // Determinism: no clock, no randomness — repeated calls agree.
          expect(earnedMedals(rows, grants, today)).toEqual(reference);

          // Monotonicity (the recompute-honesty property, ADR-0052): a
          // future late row (#31) may newly earn a medal — history can
          // grow backward — but nothing is ever un-earned by adding rows.
          const widened = earnedMedals([...rows, ...extra], grants, today);
          for (const id of reference) {
            expect(widened).toContain(id);
          }

          // Permutation invariance of rows AND grants (the T-CORE-S62
          // shuffle): order is never load-bearing.
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
          expect(earnedMedals(shuffled, grants, today)).toEqual(reference);
          expect(earnedMedals(rows, [...grants].reverse(), today)).toEqual(
            reference,
          );
        },
      ),
      { numRuns: 100, seed: 20_260_813 },
    );
  });

  it("T-CORE-S76: streakReached agrees with an independent run-length oracle over counted days — the sampled evidence that licenses D10's future single-pass optimization", () => {
    fc.assert(
      fc.property(inputArb, ({ todayDay, today, rows, grants }) => {
        const earned = new Set(earnedMedals(rows, grants, today));

        // The oracle, spelled independently of computeStreak: counted days
        // are the distinct epoch days ≤ today holding a won on-time row;
        // the maximum reached streak is the longest run of consecutive
        // counted days.
        const countedDays = [
          ...new Set(
            rows
              .filter((row) => row.outcome === "won" && row.onTime)
              .map((row) => epochDay(row.date))
              .filter((day) => day <= todayDay),
          ),
        ].sort((a, b) => a - b);
        let maxRun = 0;
        let run = 0;
        let previous: number | undefined;
        for (const day of countedDays) {
          run = previous !== undefined && day === previous + 1 ? run + 1 : 1;
          previous = day;
          if (run > maxRun) {
            maxRun = run;
          }
        }

        for (const definition of MEDAL_DEFINITIONS) {
          if (definition.rule.kind === "streakReached") {
            expect(earned.has(definition.id)).toBe(
              maxRun >= definition.rule.days,
            );
          }
        }
      }),
      { numRuns: 100, seed: 20_260_813 },
    );
  });
});
