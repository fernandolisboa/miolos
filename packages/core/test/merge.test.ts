import { describe, expect, it } from "vitest";

import {
  computeStreak,
  mergeCompletions,
  type Game,
  type MergeableCompletion,
} from "../src/index";

function row(
  game: Game,
  date: string,
  at: string,
  init?: Partial<Pick<MergeableCompletion, "outcome" | "onTime">>,
): MergeableCompletion {
  return {
    game,
    date,
    outcome: init?.outcome ?? "won",
    onTime: init?.onTime ?? true,
    completedAtOrder: at,
  };
}

function instant(date: string, time: string): string {
  return `${date}T${time}.000000Z`;
}

const TODAY = "2026-08-13";

describe("mergeCompletions — units (ADR-0009, ADR-0026, ADR-0049)", () => {
  it("T-CORE-S36: disjoint inputs — every row of both survives BY REFERENCE, sorted by (date, game), inputs unmutated", () => {
    const a1 = row("sudoku", "2026-08-13", instant("2026-08-13", "16:00:00"));
    const a2 = row("binairo", "2026-08-12", instant("2026-08-12", "15:00:00"));

    const b1 = row("termo", "2026-08-11", instant("2026-08-11", "14:00:00"), {
      outcome: "lost",
    });
    const b2 = row(
      "nonogram",
      "2026-08-13",
      instant("2026-08-14", "10:00:00"),
      {
        onTime: false,
      },
    );
    const canonical = [a1, a2];
    const other = [b1, b2];
    const canonicalSnapshot = canonical.map((r) => ({ ...r }));
    const otherSnapshot = other.map((r) => ({ ...r }));

    const merged = mergeCompletions(canonical, other);

    expect(merged).toHaveLength(4);
    expect(merged[0]).toBe(b1);
    expect(merged[1]).toBe(a2);
    expect(merged[2]).toBe(b2);
    expect(merged[3]).toBe(a1);

    expect(canonical.map((r) => ({ ...r }))).toEqual(canonicalSnapshot);
    expect(other.map((r) => ({ ...r }))).toEqual(otherSnapshot);
  });

  it("T-CORE-S37: shared key — the earliest wins in both directions, and the survivor is reference-identical, so outcome/onTime arrive untouched", () => {
    const canonicalEarlier = row(
      "binairo",
      "2026-08-10",
      instant("2026-08-10", "13:00:00"),
    );
    const otherLater = row(
      "binairo",
      "2026-08-10",
      instant("2026-08-10", "18:00:00"),
    );
    expect(mergeCompletions([canonicalEarlier], [otherLater])).toEqual([
      canonicalEarlier,
    ]);
    expect(mergeCompletions([canonicalEarlier], [otherLater])[0]).toBe(
      canonicalEarlier,
    );

    const canonicalLater = row(
      "sudoku",
      "2026-08-11",
      instant("2026-08-11", "18:00:00"),
    );
    const otherEarlier = row(
      "sudoku",
      "2026-08-11",
      instant("2026-08-11", "09:00:00"),
      { onTime: false },
    );
    const survived = mergeCompletions([canonicalLater], [otherEarlier]);
    expect(survived).toHaveLength(1);
    expect(survived[0]).toBe(otherEarlier);
    expect(survived[0]?.onTime).toBe(false);
  });

  it("T-CORE-S38: an exact completedAtOrder tie keeps the canonical side's row — the documented db-agreement rule (D2/D6 strict inequality)", () => {
    const at = instant("2026-08-10", "12:00:00");
    const canonicalRow = row("nonogram", "2026-08-10", at);
    const otherRow = row("nonogram", "2026-08-10", at, { onTime: false });

    const merged = mergeCompletions([canonicalRow], [otherRow]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(canonicalRow);
  });

  it("T-CORE-S39: the 'with cause' carve-out — an earlier lost Termo beats a later on-time win, and the merged streak reads lower than the win-holding input's", () => {
    const lostEarlier = row("termo", TODAY, instant(TODAY, "13:00:00"), {
      outcome: "lost",
    });
    const wonLater = row("termo", TODAY, instant(TODAY, "18:00:00"));

    const merged = mergeCompletions([wonLater], [lostEarlier]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(lostEarlier);

    expect(computeStreak([wonLater], TODAY).streak).toBe(1);
    expect(computeStreak(merged, TODAY).streak).toBe(0);
  });

  it("T-CORE-S106: the #58 downgrade corner is ACCEPTED earliest-wins — an earlier late row beats a later credited row, and the merged streak visibly drops", () => {
    const yesterday = "2026-08-12";
    const lateEarlier = row(
      "binairo",
      yesterday,
      instant(yesterday, "20:00:00"),
      {
        onTime: false,
      },
    );
    const creditedLater = row(
      "binairo",
      yesterday,
      instant(TODAY, "01:00:00"),
      {
        onTime: true,
      },
    );

    const merged = mergeCompletions([creditedLater], [lateEarlier]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(lateEarlier);
    expect(merged[0]?.onTime).toBe(false);

    expect(computeStreak([creditedLater], yesterday).streak).toBe(1);
    expect(computeStreak(merged, yesterday).streak).toBe(0);
  });

  it("T-CORE-S40: empty edges — merge([], []) is []; one empty side returns the other, sorted", () => {
    expect(mergeCompletions([], [])).toEqual([]);

    const later = row(
      "sudoku",
      "2026-08-12",
      instant("2026-08-12", "16:00:00"),
    );
    const earlier = row(
      "binairo",
      "2026-08-11",
      instant("2026-08-11", "15:00:00"),
    );
    const unsorted = [later, earlier];

    const leftOnly = mergeCompletions(unsorted, []);
    expect(leftOnly).toHaveLength(2);
    expect(leftOnly[0]).toBe(earlier);
    expect(leftOnly[1]).toBe(later);

    const rightOnly = mergeCompletions([], unsorted);
    expect(rightOnly).toHaveLength(2);
    expect(rightOnly[0]).toBe(earlier);
    expect(rightOnly[1]).toBe(later);
  });

  it("T-CORE-S41: same-input duplicate keys (impossible via the PK, defined anyway) — earliest wins within a side; equal-order duplicates keep the first occurrence", () => {
    const earlier = row(
      "binairo",
      "2026-08-10",
      instant("2026-08-10", "10:00:00"),
    );
    const later = row(
      "binairo",
      "2026-08-10",
      instant("2026-08-10", "15:00:00"),
    );
    const withinSide = mergeCompletions([later, earlier], []);
    expect(withinSide).toHaveLength(1);
    expect(withinSide[0]).toBe(earlier);

    const at = instant("2026-08-11", "12:00:00");
    const first = row("sudoku", "2026-08-11", at);
    const second = row("sudoku", "2026-08-11", at, { onTime: false });
    const equalOrder = mergeCompletions([first, second], []);
    expect(equalOrder).toHaveLength(1);
    expect(equalOrder[0]).toBe(first);
  });
});
