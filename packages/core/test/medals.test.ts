import { describe, expect, it } from "vitest";

import {
  dateFromEpochDay,
  earnedMedals,
  epochDay,
  GAMES,
  MEDAL_DEFINITIONS,
  MEDAL_IDS,
  type Game,
  type PublishedDaily,
  type StatsRow,
} from "../src/index";

const TODAY = "2026-08-13";
const TODAY_DAY = epochDay(TODAY);

function daysAgo(i: number): string {
  return dateFromEpochDay(TODAY_DAY - i);
}

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

const ORIGINAL_FOUR: readonly Game[] = [
  "binairo",
  "sudoku",
  "nonogram",
  "termo",
];

function perfectDay(date: string): StatsRow[] {
  return ORIGINAL_FOUR.map((game) =>
    row({ game, date, guesses: game === "termo" ? 3 : null }),
  );
}

function lineup(date: string): PublishedDaily[] {
  return ORIGINAL_FOUR.map((game) => ({ date, game }));
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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

    expect(definitions.length).toBeGreaterThanOrEqual(20);
    expect(definitions.length).toBeLessThanOrEqual(30);

    const ids = definitions.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(SLUG);
      expect(id.length).toBeLessThanOrEqual(64);
    }
    expect([...MEDAL_IDS]).toEqual(ids);

    const kinds = [...new Set(definitions.map((d) => d.rule.kind))].sort();
    expect(kinds).toEqual([
      "curated",
      "eachGameWon",
      "fullDaysReached",
      "perfectDaysReached",
      "streakReached",
      "termoGuessWins",
      "totalWins",
    ]);

    const KEYS_BY_KIND: Record<string, string[]> = {
      totalWins: ["count", "game", "kind"],
      streakReached: ["days", "kind"],
      perfectDaysReached: ["count", "kind"],
      fullDaysReached: ["count", "kind"],
      termoGuessWins: ["count", "guesses", "kind"],
      eachGameWon: ["kind"],
      curated: ["kind"],
    };
    for (const { rule } of definitions) {
      expect(Object.keys(rule).sort()).toEqual(KEYS_BY_KIND[rule.kind]);
    }

    const derived = definitions.filter((d) => d.rule.kind !== "curated");
    const fingerprints = derived.map((d) => ruleFingerprint(d.rule));
    expect(new Set(fingerprints).size).toBe(fingerprints.length);

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
    expect(allWins.length).toBeLessThanOrEqual(5);
    const allWinCounts = allWins.map((d) =>
      d.rule.kind === "totalWins" ? d.rule.count : Number.NaN,
    );
    expect(allWinCounts[0]).toBe(1);
    expect(allWinCounts.at(-1)).toBeLessThanOrEqual(1000);
    expectMonotoneSpaced(allWinCounts);

    const perGame = definitions.filter(
      (d) => d.rule.kind === "totalWins" && d.rule.game !== null,
    );
    expect(perGame.length).toBeGreaterThanOrEqual(4);
    expect(perGame.length).toBeLessThanOrEqual(7);
    for (const game of GAMES) {
      const gameCounts = perGame
        .filter((d) => d.rule.kind === "totalWins" && d.rule.game === game)
        .map((d) => (d.rule.kind === "totalWins" ? d.rule.count : Number.NaN));
      expect(gameCounts.length).toBeGreaterThanOrEqual(1);
      expectMonotoneSpaced(gameCounts);
    }

    const streaks = definitions.filter((d) => d.rule.kind === "streakReached");
    expect(streaks.length).toBeGreaterThanOrEqual(4);
    expect(streaks.length).toBeLessThanOrEqual(5);
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
    expect(perfects.length).toBeLessThanOrEqual(4);
    const perfectCounts = perfects.map((d) =>
      d.rule.kind === "perfectDaysReached" ? d.rule.count : Number.NaN,
    );
    expect(perfectCounts[0]).toBe(1);
    expectMonotoneSpaced(perfectCounts);

    const fulls = definitions.filter((d) => d.rule.kind === "fullDaysReached");
    expect(fulls.length).toBeGreaterThanOrEqual(2);
    expect(fulls.length).toBeLessThanOrEqual(3);
    const fullCounts = fulls.map((d) =>
      d.rule.kind === "fullDaysReached" ? d.rule.count : Number.NaN,
    );
    expect(fullCounts[0]).toBe(1);
    expectMonotoneSpaced(fullCounts);

    const guessMedals = definitions.filter(
      (d) => d.rule.kind === "termoGuessWins",
    );
    expect(guessMedals).toHaveLength(3);
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
    expect(earnedMedals(lateWins("binairo", 1), [], TODAY, [])).toEqual([
      "first-win",
    ]);

    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(1), outcome: "lost", guesses: 6 })],
        [],
        TODAY,
        [],
      ),
    ).toEqual([]);

    expect(
      earnedMedals(
        [row({ date: dateFromEpochDay(TODAY_DAY + 1) })],
        [],
        TODAY,
        [],
      ),
    ).toEqual([]);

    const nine = lateWins("binairo", 9);
    expect(earnedMedals(nine, [], TODAY, [])).toEqual(["first-win"]);
    const ten = lateWins("binairo", 10);
    expect(earnedMedals(ten, [], TODAY, [])).toEqual(["first-win", "wins-10"]);

    const sudokuThirty = earnedMedals(lateWins("sudoku", 30), [], TODAY, []);
    expect(sudokuThirty).toContain("sudoku-30");
    expect(sudokuThirty).not.toContain("binairo-30");
    expect(sudokuThirty).toContain("wins-10");

    const threeGames = [
      row({ game: "binairo", date: daysAgo(10) }),
      row({ game: "sudoku", date: daysAgo(20), onTime: false }),
      row({ game: "nonogram", date: daysAgo(30) }),
    ];
    expect(earnedMedals(threeGames, [], TODAY, [])).not.toContain("all-games");
    const fourGames = [
      ...threeGames,
      row({ game: "termo", date: daysAgo(40), onTime: false, guesses: 3 }),
    ];
    expect(earnedMedals(fourGames, [], TODAY, [])).toContain("all-games");
  });
});

describe("the Cruzadinha's medals (ADR-0087)", () => {
  it("T-CORE-S126: all-games needs the original four only — earned without the crossword, never earned through it", () => {
    const originalFour = ORIGINAL_FOUR.map((game, i) =>
      row({ game, date: daysAgo(i + 1), guesses: game === "termo" ? 3 : null }),
    );
    expect(earnedMedals(originalFour, [], TODAY, [])).toContain("all-games");

    const crosswordForTermo = [
      ...originalFour.filter((r) => r.game !== "termo"),
      row({ game: "crossword", date: daysAgo(9) }),
    ];
    expect(earnedMedals(crosswordForTermo, [], TODAY, [])).not.toContain(
      "all-games",
    );
  });

  it("T-CORE-S127: crossword-30 follows termo-30, earns at the 30th crossword win and not the 29th", () => {
    expect(MEDAL_IDS.indexOf("crossword-30")).toBe(
      MEDAL_IDS.indexOf("termo-30") + 1,
    );
    expect(
      earnedMedals(lateWins("crossword", 29), [], TODAY, []),
    ).not.toContain("crossword-30");
    const thirty = earnedMedals(lateWins("crossword", 30), [], TODAY, []);
    expect(thirty).toContain("crossword-30");
    expect(thirty).not.toContain("termo-30");
  });
});

describe("the Rainhas medal", () => {
  it("T-CORE-S135: queens-30 follows crossword-30, earns at the 30th Rainhas win and not the 29th, and all-games ignores it", () => {
    expect(MEDAL_IDS.indexOf("queens-30")).toBe(
      MEDAL_IDS.indexOf("crossword-30") + 1,
    );
    expect(earnedMedals(lateWins("queens", 29), [], TODAY, [])).not.toContain(
      "queens-30",
    );
    const thirty = earnedMedals(lateWins("queens", 30), [], TODAY, []);
    expect(thirty).toContain("queens-30");
    expect(thirty).not.toContain("crossword-30");

    const queensForTermo = [
      ...ORIGINAL_FOUR.filter((game) => game !== "termo").map((game, i) =>
        row({ game, date: daysAgo(i + 1) }),
      ),
      row({ game: "queens", date: daysAgo(9) }),
    ];
    expect(earnedMedals(queensForTermo, [], TODAY, [])).not.toContain(
      "all-games",
    );
  });

  it("T-CORE-S201: minesweeper-30 follows queens-30, earns at the 30th Campo Minado win and not the 29th, never from losses, and all-games ignores it", () => {
    expect(MEDAL_IDS.indexOf("minesweeper-30")).toBe(
      MEDAL_IDS.indexOf("queens-30") + 1,
    );
    expect(
      earnedMedals(lateWins("minesweeper", 29), [], TODAY, []),
    ).not.toContain("minesweeper-30");
    const thirty = earnedMedals(lateWins("minesweeper", 30), [], TODAY, []);
    expect(thirty).toContain("minesweeper-30");
    expect(thirty).not.toContain("queens-30");

    const lost = lateWins("minesweeper", 30).map((won) => ({
      ...won,
      onTime: true,
      outcome: "lost" as const,
    }));
    expect(earnedMedals(lost, [], TODAY, [])).toEqual([]);

    const minesweeperForTermo = [
      ...ORIGINAL_FOUR.filter((game) => game !== "termo").map((game, i) =>
        row({ game, date: daysAgo(i + 1) }),
      ),
      row({ game: "minesweeper", date: daysAgo(9) }),
    ];
    expect(earnedMedals(minesweeperForTermo, [], TODAY, [])).not.toContain(
      "all-games",
    );
  });
});

describe("earnedMedals — streak medals (ADR-0052/D10, computeStreak reused)", () => {
  it("T-CORE-S72: earned iff the one shared sweep's maximum reaches N; a later break never un-earns; a late win never extends", () => {
    const sevenRun = Array.from({ length: 7 }, (_, i) =>
      row({ date: daysAgo(30 + i) }),
    );
    const earned = earnedMedals(sevenRun, [], TODAY, []);
    expect(earned).toContain("streak-3");
    expect(earned).toContain("streak-7");
    expect(earned).not.toContain("streak-30");

    const muchLater = dateFromEpochDay(TODAY_DAY + 300);
    expect(earnedMedals(sevenRun, [], muchLater, [])).toContain("streak-7");

    const twoPlusLate = [
      row({ date: daysAgo(12) }),
      row({ date: daysAgo(11) }),
      row({ date: daysAgo(10), onTime: false }),
    ];
    expect(earnedMedals(twoPlusLate, [], TODAY, [])).not.toContain("streak-3");

    const threeOnTime = [
      row({ date: daysAgo(12) }),
      row({ date: daysAgo(11) }),
      row({ date: daysAgo(10) }),
    ];
    expect(earnedMedals(threeOnTime, [], TODAY, [])).toContain("streak-3");
  });
});

describe("earnedMedals — perfect days and guess feats (on-time-only classes)", () => {
  it("T-CORE-S73: the nth perfect day earns; a late win-in-1 never counts a guess medal; a lost Termo counts nothing", () => {
    const fourDays = [10, 20, 30, 40].flatMap((i) => perfectDay(daysAgo(i)));
    const fourLineups = [10, 20, 30, 40].flatMap((i) => lineup(daysAgo(i)));
    const fourEarned = earnedMedals(fourDays, [], TODAY, fourLineups);
    expect(fourEarned).toContain("perfect-1");
    expect(fourEarned).not.toContain("perfect-5");
    const fiveDays = [...fourDays, ...perfectDay(daysAgo(50))];
    expect(
      earnedMedals(fiveDays, [], TODAY, [
        ...fourLineups,
        ...lineup(daysAgo(50)),
      ]),
    ).toContain("perfect-5");
    expect(earnedMedals(fiveDays, [], TODAY, [])).not.toContain("perfect-1");

    const lateAce = [
      row({ game: "termo", date: daysAgo(3), onTime: false, guesses: 1 }),
    ];
    const lateEarned = earnedMedals(lateAce, [], TODAY, []);
    expect(lateEarned).toContain("first-win");
    expect(lateEarned).not.toContain("termo-first-try");

    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), guesses: 1 })],
        [],
        TODAY,
        [],
      ),
    ).toContain("termo-first-try");
    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), guesses: 6 })],
        [],
        TODAY,
        [],
      ),
    ).toContain("termo-last-guess");

    expect(
      earnedMedals(
        [row({ game: "termo", date: daysAgo(3), outcome: "lost", guesses: 6 })],
        [],
        TODAY,
        [],
      ),
    ).toEqual([]);
  });
});

describe("earnedMedals — Dias Cheios (ADR-0129)", () => {
  function fullDay(date: string): StatsRow[] {
    return (["binairo", "sudoku", "nonogram"] as const).map((game) =>
      row({ game, date }),
    );
  }

  it("T-CORE-S196: the nth Dia Cheio earns full-n, and a Dia Perfeito counts as one", () => {
    expect(MEDAL_IDS.slice(-3)).toEqual(["full-1", "full-10", "full-50"]);

    const nine = Array.from({ length: 9 }, (_, i) => fullDay(daysAgo(i + 1)));
    const nineLineups = Array.from({ length: 9 }, (_, i) =>
      lineup(daysAgo(i + 1)),
    );
    const nineEarned = earnedMedals(nine.flat(), [], TODAY, nineLineups.flat());
    expect(nineEarned).toContain("full-1");
    expect(nineEarned).not.toContain("full-10");
    expect(nineEarned).not.toContain("perfect-1");

    const withPerfect = earnedMedals(
      [...nine.flat(), ...perfectDay(daysAgo(20))],
      [],
      TODAY,
      [...nineLineups.flat(), ...lineup(daysAgo(20))],
    );
    expect(withPerfect).toContain("full-10");
    expect(withPerfect).toContain("perfect-1");
    expect(withPerfect).not.toContain("full-50");

    expect(
      earnedMedals(
        fullDay(daysAgo(1)).slice(0, 2),
        [],
        TODAY,
        lineup(daysAgo(1)),
      ),
    ).not.toContain("full-1");
  });
});

describe("earnedMedals — curated grants (ADR-0052/D2/D6)", () => {
  it("T-CORE-S74: a curated-id grant surfaces; rule-derived-id and unknown-id grants are ignored, never an error; duplicates collapse; output is in catalog order", () => {
    expect(earnedMedals([], ["founder"], TODAY, [])).toEqual(["founder"]);

    expect(earnedMedals([], ["first-win"], TODAY, [])).toEqual([]);

    expect(earnedMedals([], ["ghost-medal"], TODAY, [])).toEqual([]);

    expect(earnedMedals([], ["founder", "founder"], TODAY, [])).toEqual([
      "founder",
    ]);

    expect(
      earnedMedals([row({ date: daysAgo(1) })], ["founder"], TODAY, []),
    ).toEqual(["first-win", "founder"]);
  });
});
