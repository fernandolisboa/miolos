import { describe, expect, it } from "vitest";

import {
  dateFromEpochDay,
  earnedMedals,
  epochDay,
  GAMES,
  MEDAL_DEFINITIONS,
  MEDAL_IDS,
  type Game,
  type StatsRow,
} from "../src/index";

/**
 * The #30 medal suite (ADR-0052): the definition harness — the mechanical
 * half of the ADR-0015 curation method, enforcing the written constraints
 * in content/medals/README.md — and the per-kind rule pins over
 * `earnedMedals`. Exclusions are pinned HERE, at seam 2, exactly like the
 * stats suite: the db reader is unfiltered and the pure function owns
 * every rule.
 */

const TODAY = "2026-08-13";
const TODAY_DAY = epochDay(TODAY);

/** The i-th day before TODAY as 'YYYY-MM-DD' (i = 0 is TODAY). */
function daysAgo(i: number): string {
  return dateFromEpochDay(TODAY_DAY - i);
}

/** A won on-time row — the counted shape; override to manufacture others. */
function row(init: Partial<StatsRow> & { date: string }): StatsRow {
  return {
    game: "binairo",
    outcome: "won",
    onTime: true,
    elapsedMs: 61_000,
    hintsUsed: 0,
    guesses: null,
    ...init,
  };
}

/** `count` LATE wins of `game` on distinct past dates — volume without
 *  touching streaks, perfect days or the guess distribution. */
function lateWins(game: Game, count: number, startDaysAgo = 1): StatsRow[] {
  return Array.from({ length: count }, (_, i) =>
    row({
      game,
      date: daysAgo(startDaysAgo + i),
      onTime: false,
      guesses: game === "termo" ? 6 : null,
    }),
  );
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A structural fingerprint for the no-duplicate-rules assertion. */
function ruleFingerprint(
  rule: (typeof MEDAL_DEFINITIONS)[number]["rule"],
): string {
  return Object.entries(rule)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("|");
}

describe("the definition harness (content/medals/README.md, ADR-0015 scaled)", () => {
  it("T-CORE-S70: the catalog satisfies every written constraint — count, ids, kinds, quotas, monotone ≥2× thresholds, bounds — and no forbidden-input rule exists", () => {
    const definitions = [...MEDAL_DEFINITIONS];

    // AC 1's number, independently of the quota arithmetic below.
    expect(definitions.length).toBeGreaterThanOrEqual(20);
    expect(definitions.length).toBeLessThanOrEqual(30);

    // Ids: unique, slug-shaped, ≤ 64 — wire values and grant keys.
    const ids = definitions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(SLUG);
      expect(id.length).toBeLessThanOrEqual(64);
    }
    expect([...MEDAL_IDS]).toEqual(ids);

    // The sanctioned discriminant set, deep-equal: adding a kind is a
    // deliberate edit of this line, never a drive-by. The forbidden inputs
    // (hintsUsed, elapsedMs, time-of-day, device state, free play) are
    // inexpressible in these six — no variant carries a field for them.
    const kinds = [...new Set(definitions.map((d) => d.rule.kind))].sort();
    expect(kinds).toEqual([
      "curated",
      "eachGameWon",
      "perfectDaysReached",
      "streakReached",
      "termoGuessWins",
      "totalWins",
    ]);

    // "None exists" made mechanical: every rule object's key set is
    // exactly its variant's sanctioned keys — no smuggled field.
    const KEYS_BY_KIND: Record<string, string[]> = {
      totalWins: ["count", "game", "kind"],
      streakReached: ["days", "kind"],
      perfectDaysReached: ["count", "kind"],
      termoGuessWins: ["count", "guesses", "kind"],
      eachGameWon: ["kind"],
      curated: ["kind"],
    };
    for (const { rule } of definitions) {
      expect(Object.keys(rule).sort()).toEqual(KEYS_BY_KIND[rule.kind]);
    }

    // No two rule-derived definitions with structurally identical rules.
    const derived = definitions.filter((d) => d.rule.kind !== "curated");
    const fingerprints = derived.map((d) => ruleFingerprint(d.rule));
    expect(new Set(fingerprints).size).toBe(fingerprints.length);

    // Per-kind quotas (the README table) and the threshold rules:
    // strictly increasing AND ≥ 2× spacing per kind/scope (the anti-ladder
    // rule — feats are round, rare marks, never consecutive rungs).
    function expectMonotoneSpaced(thresholds: readonly number[]): void {
      for (let i = 1; i < thresholds.length; i += 1) {
        const previous = thresholds[i - 1] ?? Number.NaN;
        const current = thresholds[i] ?? Number.NaN;
        expect(current).toBeGreaterThan(previous);
        expect(current).toBeGreaterThanOrEqual(previous * 2);
      }
    }

    const allWins = definitions.filter(
      (d) => d.rule.kind === "totalWins" && d.rule.game === null,
    );
    expect(allWins.length).toBeGreaterThanOrEqual(4);
    expect(allWins.length).toBeLessThanOrEqual(6);
    const allWinCounts = allWins.map((d) =>
      d.rule.kind === "totalWins" ? d.rule.count : Number.NaN,
    );
    expect(allWinCounts[0]).toBe(1); // the first-win medal
    expect(allWinCounts.at(-1)).toBeLessThanOrEqual(1000);
    expectMonotoneSpaced(allWinCounts);

    const perGame = definitions.filter(
      (d) => d.rule.kind === "totalWins" && d.rule.game !== null,
    );
    expect(perGame.length).toBeGreaterThanOrEqual(4);
    expect(perGame.length).toBeLessThanOrEqual(6);
    for (const game of GAMES) {
      const gameCounts = perGame
        .filter((d) => d.rule.kind === "totalWins" && d.rule.game === game)
        .map((d) => (d.rule.kind === "totalWins" ? d.rule.count : Number.NaN));
      expect(gameCounts.length).toBeGreaterThanOrEqual(1); // every game represented
      expectMonotoneSpaced(gameCounts);
    }

    const streaks = definitions.filter((d) => d.rule.kind === "streakReached");
    expect(streaks.length).toBeGreaterThanOrEqual(4);
    expect(streaks.length).toBeLessThanOrEqual(6);
    const streakDays = streaks.map((d) =>
      d.rule.kind === "streakReached" ? d.rule.days : Number.NaN,
    );
    for (const days of streakDays) {
      expect(days).toBeGreaterThanOrEqual(3);
      expect(days).toBeLessThanOrEqual(365);
    }
    expectMonotoneSpaced(streakDays);

    const perfects = definitions.filter(
      (d) => d.rule.kind === "perfectDaysReached",
    );
    expect(perfects.length).toBeGreaterThanOrEqual(3);
    expect(perfects.length).toBeLessThanOrEqual(5);
    const perfectCounts = perfects.map((d) =>
      d.rule.kind === "perfectDaysReached" ? d.rule.count : Number.NaN,
    );
    expect(perfectCounts[0]).toBe(1);
    expectMonotoneSpaced(perfectCounts);

    const guessMedals = definitions.filter(
      (d) => d.rule.kind === "termoGuessWins",
    );
    expect(guessMedals.length).toBeGreaterThanOrEqual(3);
    expect(guessMedals.length).toBeLessThanOrEqual(4);
    for (const guesses of [1, 2, 6] as const) {
      const scoped = guessMedals
        .filter(
          (d) => d.rule.kind === "termoGuessWins" && d.rule.guesses === guesses,
        )
        .map((d) =>
          d.rule.kind === "termoGuessWins" ? d.rule.count : Number.NaN,
        );
      expectMonotoneSpaced(scoped);
    }

    expect(
      definitions.filter((d) => d.rule.kind === "eachGameWon"),
    ).toHaveLength(1);

    const curated = definitions.filter((d) => d.rule.kind === "curated");
    expect(curated.length).toBeGreaterThanOrEqual(1);
    expect(curated.length).toBeLessThanOrEqual(2);

    // Params in bounds: every counting threshold is a positive integer.
    for (const { rule } of derived) {
      if ("count" in rule) {
        expect(Number.isInteger(rule.count)).toBe(true);
        expect(rule.count).toBeGreaterThanOrEqual(1);
      }
      if ("days" in rule) {
        expect(Number.isInteger(rule.days)).toBe(true);
      }
      if ("guesses" in rule) {
        expect([1, 2, 6]).toContain(rule.guesses);
      }
    }
  });
});

describe("earnedMedals — volume rules (ADR-0008 rule 2's totals posture)", () => {
  it("T-CORE-S71: a manufactured late win counts, a lost row never, a future-dated row never; per-game scoping holds; count − 1 rows leave a medal unearned and the nth row earns it", () => {
    // A single LATE win earns first-win: totals include late wins.
    expect(earnedMedals(lateWins("binairo", 1), [], TODAY)).toEqual([
      "first-win",
    ]);

    // A lost row counts for nothing — no medal at all.
    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(1), outcome: "lost", guesses: 6 })],
        [],
        TODAY,
      ),
    ).toEqual([]);

    // A won row dated AFTER today counts for nothing at all: it cannot be
    // the count-th row of a volume medal (the shared date ≤ today guard,
    // mirroring computeStreak's own defence-in-depth).
    expect(
      earnedMedals([row({ date: dateFromEpochDay(TODAY_DAY + 1) })], [], TODAY),
    ).toEqual([]);

    // count − 1 → unearned; the nth row earns (wins-10 at the seam).
    const nine = lateWins("binairo", 9);
    expect(earnedMedals(nine, [], TODAY)).toEqual(["first-win"]);
    const ten = lateWins("binairo", 10);
    expect(earnedMedals(ten, [], TODAY)).toEqual(["first-win", "wins-10"]);

    // Per-game scoping: 30 sudoku wins earn sudoku-30 and never binairo-30.
    const sudokuThirty = earnedMedals(lateWins("sudoku", 30), [], TODAY);
    expect(sudokuThirty).toContain("sudoku-30");
    expect(sudokuThirty).not.toContain("binairo-30");
    expect(sudokuThirty).toContain("wins-10"); // 30 wins move the all-games totals too

    // eachGameWon needs all four games — three won (one of them late) is
    // not enough; the fourth (late) completes the circuit.
    const threeGames = [
      row({ game: "binairo", date: daysAgo(10) }),
      row({ game: "sudoku", date: daysAgo(20), onTime: false }),
      row({ game: "nonogram", date: daysAgo(30) }),
    ];
    expect(earnedMedals(threeGames, [], TODAY)).not.toContain("all-games");
    const fourGames = [
      ...threeGames,
      row({ game: "termo", date: daysAgo(40), onTime: false, guesses: 3 }),
    ];
    expect(earnedMedals(fourGames, [], TODAY)).toContain("all-games");
  });
});

describe("earnedMedals — streak medals (ADR-0052/D10, computeStreak reused)", () => {
  it("T-CORE-S72: earned iff the one shared sweep's maximum reaches N; a later break never un-earns; a late win never extends", () => {
    // Seven consecutive counted days: streak-3 and streak-7, not streak-30.
    const sevenRun = Array.from({ length: 7 }, (_, i) =>
      row({ date: daysAgo(30 + i) }),
    );
    const earned = earnedMedals(sevenRun, [], TODAY);
    expect(earned).toContain("streak-3");
    expect(earned).toContain("streak-7");
    expect(earned).not.toContain("streak-30");

    // The break never un-earns: the same run read 30 days later (TODAY is
    // already 30+ days past the run's end) still carries streak-7 — the
    // sweep anchors on the counted dates themselves, not on today.
    // Shown again with a longer gap:
    const muchLater = dateFromEpochDay(TODAY_DAY + 300);
    expect(earnedMedals(sevenRun, [], muchLater)).toContain("streak-7");

    // Two counted days + a LATE win on the third consecutive day: the late
    // row never extends the run (computeStreak's own semantics, reached
    // through reuse) — streak-3 stays unearned.
    const twoPlusLate = [
      row({ date: daysAgo(12) }),
      row({ date: daysAgo(11) }),
      row({ date: daysAgo(10), onTime: false }),
    ];
    expect(earnedMedals(twoPlusLate, [], TODAY)).not.toContain("streak-3");
    // The on-time counterpart earns it — the pin is the onTime bit alone.
    const threeOnTime = [
      row({ date: daysAgo(12) }),
      row({ date: daysAgo(11) }),
      row({ date: daysAgo(10) }),
    ];
    expect(earnedMedals(threeOnTime, [], TODAY)).toContain("streak-3");
  });
});

describe("earnedMedals — perfect days and guess feats (on-time-only classes)", () => {
  it("T-CORE-S73: the nth perfect day earns; a late win-in-1 never counts a guess medal; a lost Termo counts nothing", () => {
    /** All four games won on time on `date` — one Dia Perfeito. */
    function perfectDay(date: string): StatsRow[] {
      return GAMES.map((game) =>
        row({ game, date, guesses: game === "termo" ? 3 : null }),
      );
    }

    // Perfect days: 4 days → perfect-1 only; the 5th earns perfect-5.
    const fourDays = [10, 20, 30, 40].flatMap((i) => perfectDay(daysAgo(i)));
    const fourEarned = earnedMedals(fourDays, [], TODAY);
    expect(fourEarned).toContain("perfect-1");
    expect(fourEarned).not.toContain("perfect-5");
    const fiveDays = [...fourDays, ...perfectDay(daysAgo(50))];
    expect(earnedMedals(fiveDays, [], TODAY)).toContain("perfect-5");

    // A LATE win-in-1 counts totals, never the guess medal: guess facts
    // are distribution-class and rule 2 bars late completions from them.
    const lateAce = [
      row({ game: "termo", date: daysAgo(3), onTime: false, guesses: 1 }),
    ];
    const lateEarned = earnedMedals(lateAce, [], TODAY);
    expect(lateEarned).toContain("first-win");
    expect(lateEarned).not.toContain("termo-first-try");

    // The on-time ace earns it; an on-time last-guess win earns survival.
    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), guesses: 1 })],
        [],
        TODAY,
      ),
    ).toContain("termo-first-try");
    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), guesses: 6 })],
        [],
        TODAY,
      ),
    ).toContain("termo-last-guess");

    // A lost Termo — even at guesses 6, even on time — counts nothing.
    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), outcome: "lost", guesses: 6 })],
        [],
        TODAY,
      ),
    ).toEqual([]);
  });
});

describe("earnedMedals — curated grants (ADR-0052/D2/D6)", () => {
  it("T-CORE-S74: a curated-id grant surfaces; rule-derived-id and unknown-id grants are ignored, never an error; duplicates collapse; output is in catalog order", () => {
    // A curated grant surfaces with zero completion rows.
    expect(earnedMedals([], ["founder"], TODAY)).toEqual(["founder"]);

    // A grant naming a RULE-DERIVED id is ignored at read time: storing
    // one could otherwise fake an uncomputed feat or desync from a
    // recompute (ADR-0052). Never an error.
    expect(earnedMedals([], ["first-win"], TODAY)).toEqual([]);

    // An id unknown to the catalog is ignored — never an error, never
    // surfaced (catalog/DB drift is a read-time no-op by design).
    expect(earnedMedals([], ["ghost-medal"], TODAY)).toEqual([]);

    // Duplicate ids in the input (impossible via the PK, defended anyway)
    // collapse — the input is treated as a set.
    expect(earnedMedals([], ["founder", "founder"], TODAY)).toEqual([
      "founder",
    ]);

    // Catalog order: a won row plus the founder grant answer in the
    // catalog's own order (first-win before founder), regardless of the
    // grants' position in the input.
    expect(
      earnedMedals([row({ date: daysAgo(1) })], ["founder"], TODAY),
    ).toEqual(["first-win", "founder"]);
  });
});
