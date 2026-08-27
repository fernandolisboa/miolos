import { describe, expect, it } from "vitest";

import { computeStreak, type StreakRow } from "../src/index";

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
    const runToYesterday = [
      won("2026-08-10"),
      won("2026-08-11"),
      won(YESTERDAY),
    ];
    expect(computeStreak(runToYesterday, TODAY)).toEqual({
      streak: 3,
      todayCounts: false,
    });

    expect(computeStreak(runToYesterday, "2026-08-14")).toEqual({
      streak: 0,
      todayCounts: false,
    });
  });

  it("T-CORE-S27: a lost row never counts, on time or not — the #27-transferred obligation at the unit level", () => {
    const rows = [won("2026-08-11"), won(YESTERDAY), lost(TODAY)];
    expect(computeStreak(rows, TODAY)).toEqual({
      streak: 2,
      todayCounts: false,
    });

    const gapRows = [won("2026-08-10"), won("2026-08-11"), lost(YESTERDAY)];
    expect(computeStreak(gapRows, TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });

    expect(computeStreak([lost(TODAY, false)], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });
  });

  it("T-CORE-S28: late wins never count — a day of late wins only is a gap (ADR-0008 rules 1–2)", () => {
    expect(computeStreak([won("2026-08-11"), late(YESTERDAY)], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });

    expect(computeStreak([won(YESTERDAY), late(TODAY)], TODAY)).toEqual({
      streak: 1,
      todayCounts: false,
    });
  });

  it("T-CORE-S29: robustness — duplicate dates count once, order is irrelevant, future rows are inert", () => {
    const fourGamesToday = [won(TODAY), won(TODAY), won(TODAY), won(TODAY)];
    expect(computeStreak(fourGamesToday, TODAY)).toEqual({
      streak: 1,
      todayCounts: true,
    });

    const first = won("2026-08-11");
    const second = won(YESTERDAY);
    const third = won(TODAY);
    const run = [first, second, third];
    const reversed = [third, second, first];
    const shuffled = [second, third, first];
    expect(computeStreak(reversed, TODAY)).toEqual(computeStreak(run, TODAY));
    expect(computeStreak(shuffled, TODAY)).toEqual(computeStreak(run, TODAY));

    expect(computeStreak([won("2026-08-14")], TODAY)).toEqual({
      streak: 0,
      todayCounts: false,
    });

    const acrossNewYear = [won("2025-12-31"), won("2026-01-01")];
    expect(computeStreak(acrossNewYear, "2026-01-01")).toEqual({
      streak: 2,
      todayCounts: true,
    });
  });

  it("T-CORE-S35: the date guard throws RangeError — malformed shapes and pre-1000 years alike, never a two-digit-year alias", () => {
    expect(() => computeStreak([], "26-08-13")).toThrow(RangeError);
    expect(() => computeStreak([], "2026/08/13")).toThrow(RangeError);

    expect(() => computeStreak([], "0099-01-01")).toThrow(RangeError);
    expect(() => computeStreak([won("0099-01-01")], TODAY)).toThrow(RangeError);

    expect(computeStreak([won("1000-01-01")], "1000-01-01")).toEqual({
      streak: 1,
      todayCounts: true,
    });
  });
});
