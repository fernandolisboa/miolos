import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  COMPLETION_OUTCOMES,
  dateFromEpochDay,
  earnedMedals,
  epochDay,
  GAMES,
  MEDAL_DEFINITIONS,
  type PublishedDaily,
  type StatsRow,
} from "../src/index";

const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 50, max: DAY_MAX });

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

const grantArb = fc.oneof(
  fc.constantFrom(...MEDAL_DEFINITIONS.map((d) => d.id)),
  fc.constantFrom("ghost-medal", "future-medal", "abc-123"),
);

function publishedArb(
  rows: readonly StatsRow[],
): fc.Arbitrary<PublishedDaily[]> {
  const played = rows.map(({ date, game }) => ({ date, game }));
  if (played.length === 0) {
    return fc.constant([]);
  }
  return fc
    .tuple(
      fc.subarray(played),
      fc.array(
        fc.record({
          date: fc.constantFrom(...played.map((daily) => daily.date)),
          game: fc.constantFrom(...GAMES),
        }),
        { maxLength: 5 },
      ),
    )
    .map(([fromRows, extra]) => [...fromRows, ...extra]);
}

const inputArb = todayDayArb.chain((todayDay) =>
  fc.array(rowArb(todayDay), { maxLength: 80 }).chain((rows) =>
    fc.record({
      todayDay: fc.constant(todayDay),
      today: fc.constant(dateFromEpochDay(todayDay)),
      rows: fc.constant(rows),
      grants: fc.array(grantArb, { maxLength: 8 }),
      published: publishedArb(rows),
    }),
  ),
);

describe("earnedMedals — properties (ADR-0023, sampled evidence)", () => {
  it("T-CORE-S75: monotonicity — adding rows under one published lineup never un-earns a medal — plus determinism and permutation invariance in rows and grants", () => {
    fc.assert(
      fc.property(
        inputArb,
        fc.array(
          todayDayArb.chain((d) => rowArb(d)),
          { maxLength: 20 },
        ),
        fc.infiniteStream(fc.nat()),
        ({ today, rows, grants, published }, extra, indices) => {
          const reference = earnedMedals(rows, grants, today, published);

          expect(earnedMedals(rows, grants, today, published)).toEqual(
            reference,
          );

          const widened = earnedMedals(
            [...rows, ...extra],
            grants,
            today,
            published,
          );
          for (const id of reference) {
            expect(widened).toContain(id);
          }

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
          expect(earnedMedals(shuffled, grants, today, published)).toEqual(
            reference,
          );
          expect(
            earnedMedals(rows, [...grants].reverse(), today, published),
          ).toEqual(reference);
        },
      ),
      { numRuns: 100, seed: 20_260_813 },
    );
  });

  it("T-CORE-S76: streakReached agrees with an independent run-length oracle over counted days — the sampled evidence that licenses D10's future single-pass optimization", () => {
    fc.assert(
      fc.property(inputArb, ({ todayDay, today, rows, grants }) => {
        const earned = new Set(earnedMedals(rows, grants, today, []));

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
