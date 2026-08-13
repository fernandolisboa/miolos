import { describe, expect, it } from "vitest";

import { computeStreak, type StreakRow } from "../src/index";

/** An on-time win for `date` — the only row shape that can count. */
function won(date: string): StreakRow {
  return { date, outcome: "won", onTime: true };
}

function lost(date: string, onTime = true): StreakRow {
  return { date, outcome: "lost", onTime };
}

function late(date: string): StreakRow {
  return { date, outcome: "won", onTime: false };
}

const TODAY = "2026-08-13";
const YESTERDAY = "2026-08-12";

describe("computeStreak — units (ADR-0008, ADR-0009, ADR-0048)", () => {
  it("T-CORE-S25: empty rows read zero; a single on-time win today reads one and counts today", () => {
    expect(computeStreak([], TODAY)).toEqual({ streak: 0, todayCounts: false });
    expect(computeStreak([won(TODAY)], TODAY)).toEqual({
      streak: 1,
      todayCounts: true,
    });
  });

  it("T-CORE-S26: a run ending yesterday is alive at full length; a run ending two days ago is dead", () => {
    // Three consecutive counted days ending yesterday: alive until the
    // rollover (ADR-0048 decision 2), with today not counted.
    const runToYesterday = [
      won("2026-08-10"),
      won("2026-08-11"),
      won(YESTERDAY),
    ];
    expect(computeStreak(runToYesterday, TODAY)).toEqual({
      streak: 3,
      todayCounts: false,
    });
    // The same run read one day later: a rollover passed unplayed, so the
    // anchor (today − 1 = 2026-08-13) is not a counted day and the run is 0.
    expect(computeStreak(runToYesterday, "2026-08-14")).toEqual({
      streak: 0,
      todayCounts: false,
    });
  });

  it("T-CORE-S27: a lost row never counts, on time or not — the #27-transferred obligation at the unit level", () => {
    // Today's only row is a lost Termo, ON TIME: today is not a counted day,
    // and the streak anchors at yesterday's run instead (ADR-0008 rule 3).
    const rows = [won("2026-08-11"), won(YESTERDAY), lost(TODAY)];
    expect(computeStreak(rows, TODAY)).toEqual({
      streak: 2,
      todayCounts: false,
    });
    // A day whose ONLY row is a lost Termo is a gap: won D−3, won D−2,
    // lost-only D−1 → the run through D−2 is unreachable from the anchor.
    const gapRows = [won("2026-08-10"), won("2026-08-11"), lost(YESTERDAY)];
    expect(computeStreak(gapRows, TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });
    // An off-time lost row is equally inert.
    expect(computeStreak([lost(TODAY, false)], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });
  });

  it("T-CORE-S28: late wins never count — a day of late wins only is a gap (ADR-0008 rules 1–2)", () => {
    // The archive solve for yesterday does not repair the run.
    expect(computeStreak([won("2026-08-11"), late(YESTERDAY)], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });
    // A late win today does not make today count.
    expect(computeStreak([won(YESTERDAY), late(TODAY)], TODAY)).toEqual({
      streak: 1,
      todayCounts: false,
    });
  });

  it("T-CORE-S29: robustness — duplicate dates count once, order is irrelevant, future rows are inert", () => {
    // Several games on one day: the day counts once (CONTEXT.md "≥ 1").
    const fourGamesToday = [won(TODAY), won(TODAY), won(TODAY), won(TODAY)];
    expect(computeStreak(fourGamesToday, TODAY)).toEqual({
      streak: 1,
      todayCounts: true,
    });
    // Reversed and shuffled inputs agree with the sorted one.
    const first = won("2026-08-11");
    const second = won(YESTERDAY);
    const third = won(TODAY);
    const run = [first, second, third];
    const reversed = [third, second, first];
    const shuffled = [second, third, first];
    expect(computeStreak(reversed, TODAY)).toEqual(computeStreak(run, TODAY));
    expect(computeStreak(shuffled, TODAY)).toEqual(computeStreak(run, TODAY));
    // A future-dated row (impossible per ADR-0026 decision 6, inert here)
    // neither counts today nor extends anything.
    expect(computeStreak([won("2026-08-14")], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });
    // Month and year boundaries walk correctly (the epoch-day arithmetic).
    const acrossNewYear = [won("2025-12-31"), won("2026-01-01")];
    expect(computeStreak(acrossNewYear, "2026-01-01")).toEqual({
      streak: 2,
      todayCounts: true,
    });
  });

  it("T-CORE-S35: the date guard throws RangeError — malformed shapes and pre-1000 years alike, never a two-digit-year alias", () => {
    // The shape guard, pinned as a thrown type rather than left implicit.
    expect(() => computeStreak([], "26-08-13")).toThrow(RangeError);
    expect(() => computeStreak([], "2026/08/13")).toThrow(RangeError);
    // Date.UTC backfills years 0–99 to 1900–1999: without the year guard,
    // "0099-01-01" would silently read as 1999 instead of throwing. The
    // guard covers `today` and row dates through the same private helper.
    expect(() => computeStreak([], "0099-01-01")).toThrow(RangeError);
    expect(() => computeStreak([won("0099-01-01")], TODAY)).toThrow(RangeError);
    // The guard's floor is exact: year 1000 is arithmetic, not an error.
    expect(computeStreak([won("1000-01-01")], "1000-01-01")).toEqual({
      streak: 1,
      todayCounts: true,
    });
  });
});
