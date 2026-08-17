import {
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import { dailyPuzzles, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday, type Weekday } from "@miolos/games";
import {
  NONOGRAM_WEEKDAY_CRITERIA,
  validateNonogram,
  type NonogramPuzzle,
} from "@miolos/games/nonogram";
import { sudokuCriteriaForWeekday, validateSudoku } from "@miolos/games/sudoku";
import { TERMO_ANSWERS } from "@miolos/games/termo";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import {
  drawUniformIndex,
  MAX_NONOGRAM_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_RUN,
  topUpNonogramBuffer,
  topUpSudokuBuffer,
  topUpTermoBuffer,
  uniformDrawLimit,
} from "../src/publishing/service";

// The top-up called directly over PGlite — the route is not in the picture
// here. This file owns the engine mocks deliberately (plan 018 T-API-S7): a
// file-wide `vi.mock("@miolos/games/sudoku", …)` must never leak into
// cron-publish.test.ts, which needs the real generators end to end.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { generation } = vi.hoisted(() => ({
  generation: { failWeekdays: new Set<number>(), calls: 0 },
}));

const { nonogram } = vi.hoisted(() => {
  const state: {
    failWeekdays: Set<number>;
    calls: number;
    /**
     * When set, every call generates for THIS weekday whatever the target —
     * the only way to reach the top-up's weekday/size cross-check, which real
     * generator output can never fail (T-API-S19).
     */
    forceWeekday: Weekday | undefined;
    /** The last puzzle handed to the top-up — T-API-S19's anti-vacuity subject. */
    lastPuzzle: NonogramPuzzle | undefined;
  } = {
    failWeekdays: new Set(),
    calls: 0,
    forceWeekday: undefined,
    lastPuzzle: undefined,
  };
  return { nonogram: state };
});

vi.mock("@miolos/games/nonogram", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@miolos/games/nonogram")>();
  return {
    ...actual,
    generateNonogram: (
      seed: Parameters<typeof actual.generateNonogram>[0],
      weekday: Parameters<typeof actual.generateNonogram>[1],
    ) => {
      nonogram.calls += 1;
      if (nonogram.failWeekdays.has(weekday)) {
        // The REAL class, taken from the spread original, so the service's
        // `instanceof NonogramGenerationError` branch is the one under test.
        throw new actual.NonogramGenerationError(
          seed,
          weekday,
          actual.NONOGRAM_MAX_GENERATION_ATTEMPTS,
        );
      }
      const puzzle = actual.generateNonogram(
        seed,
        nonogram.forceWeekday ?? weekday,
      );
      nonogram.lastPuzzle = puzzle;
      return puzzle;
    },
  };
});

vi.mock("@miolos/games/sudoku", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/games/sudoku")>();
  return {
    ...actual,
    generateDailySudoku: (
      options: Parameters<typeof actual.generateDailySudoku>[0],
    ) => {
      generation.calls += 1;
      if (generation.failWeekdays.has(options.weekday)) {
        // The REAL class, taken from the spread original, so the service's
        // `instanceof SudokuGenerationError` branch is the one under test —
        // a look-alike would fall through to the rethrow and abort the run,
        // which is exactly the behaviour these tests deny.
        throw new actual.SudokuGenerationError(
          options.seed,
          actual.sudokuCriteriaForWeekday(options.weekday),
          actual.SUDOKU_MAX_GENERATION_ATTEMPTS,
        );
      }
      return actual.generateDailySudoku(options);
    },
  };
});

// Hook budget 30_000 ms. The arithmetic, both measured figures, the uncapped
// worst case and the re-derivation tripwire live once, beside `createTestDb`
// in `@miolos/db/testing` (ADR-0055 decision 1 as amended by #114; ADR-0057).
// Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  generation.failWeekdays.clear();
  generation.calls = 0;
  nonogram.failWeekdays.clear();
  nonogram.calls = 0;
  nonogram.forceWeekday = undefined;
  nonogram.lastPuzzle = undefined;
});

afterAll(async () => {
  await ctx.close();
});

async function sudokuRows(): Promise<{ date: string; content: unknown }[]> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows
    .filter((row) => row.game === "sudoku")
    .map((row) => ({ date: row.date, content: row.content }));
}

async function nonogramRows(): Promise<
  { date: string; seed: number; content: unknown }[]
> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows
    .filter((row) => row.game === "nonogram")
    .map((row) => ({ date: row.date, seed: row.seed, content: row.content }));
}

function weekdayOf(date: string): Weekday {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  return weekday;
}

describe("topUpSudokuBuffer", () => {
  it("covers a full week with content the strict contract and the weekday criteria both accept", async () => {
    // Anti-vacuity for the two failure tests below: the spread mock must
    // reach the REAL generator whenever the weekday is not forced to fail.
    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 7, depth: 7, failures: [] });
    const rows = await sudokuRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const content = sudokuDailyContentSchema.parse(row.content);
      const weekday = isoWeekdayOf(row.date);
      if (!isWeekday(weekday)) {
        throw new Error(`unreachable: bad weekday for ${row.date}`);
      }
      const verdict = validateSudoku(
        content,
        sudokuCriteriaForWeekday(weekday),
      );
      expect(verdict.approved).toBe(true);
    }
  }, 30_000);

  it("T-API-S7: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);
    const doomedWeekday = isoWeekdayOf(doomedDate);
    // Every weekday appears exactly once in a 7-day window, so failing one
    // weekday fails exactly one date.
    generation.failWeekdays.add(doomedWeekday);

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result.generated).toBe(6);
    expect(result.depth).toBe(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(doomedDate);
    expect(result.failures[0]?.reason).toContain("No approved Sudoku found");
    const dates = (await sudokuRows()).map((row) => row.date).sort();
    expect(dates).not.toContain(doomedDate);
    expect(dates).toHaveLength(6);
    // The doomed date spent its whole per-date budget; the other six were
    // covered on their first seed.
    expect(generation.calls).toBe(6 + MAX_SUDOKU_SEED_RETRIES_PER_DATE);
  }, 30_000);

  it("T-API-S16: the RUN-scoped budget bounds total attempts, not depth x per-date", async () => {
    // Force every weekday to fail: without a run budget a depth-7 run would
    // spend 7 x MAX_SUDOKU_SEED_RETRIES_PER_DATE seeds, and a depth-30 run
    // (remoteConfigSchema's clamp ceiling) 30 x — the ~8 s bound in plan
    // 018 S13 is a property of the code only if this holds.
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      generation.failWeekdays.add(weekday);
    }
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(generation.calls).toBe(MAX_SUDOKU_SEED_RETRIES_PER_RUN);
    expect(result.generated).toBe(0);
    expect(result.depth).toBe(0);
    expect(result.failures.map((failure) => failure.date)).toEqual(
      Array.from({ length: 7 }, (_, offset) => addDays(today, offset)),
    );

    const datesThatReallyTried =
      MAX_SUDOKU_SEED_RETRIES_PER_RUN / MAX_SUDOKU_SEED_RETRIES_PER_DATE;
    for (const failure of result.failures.slice(0, datesThatReallyTried)) {
      expect(failure.reason).toContain("No approved Sudoku found");
    }
    for (const failure of result.failures.slice(datesThatReallyTried)) {
      expect(failure.reason).toBe("run seed-retry budget exhausted");
    }
  }, 30_000);

  it("an already-covered date is never charged against the run budget", async () => {
    // Dates already in the buffer are skipped BEFORE the budget check, so a
    // healthy buffer with one hole still gets its hole filled.
    await topUpSudokuBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const hole = addDays(today, 5);
    await ctx.db.execute(
      sql`delete from daily_puzzles where game = 'sudoku' and date = ${hole}`,
    );
    generation.calls = 0;

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 1, depth: 7, failures: [] });
    expect(generation.calls).toBe(1);
  }, 30_000);
});

/**
 * Deliberately WITHOUT a per-`it` timeout, unlike every sudoku case above
 * (landmine 25). Nonogram generate+validate measures 0.0354 ms (Mon 5x5) to
 * 0.1902 ms (Sun 15x15) with warm pools, plus ~34 ms once to build all seven
 * memoized pools — three orders of magnitude under `topUpSudokuBuffer`'s
 * ~834 ms week, so vitest's 5 000 ms default is ample and a copied 30_000
 * would be a number with no reason to exist.
 */
describe("topUpNonogramBuffer", () => {
  it("T-API-S17: covers a full week with content the strict contract and the validator both accept", async () => {
    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 7, depth: 7, failures: [] });
    const rows = await nonogramRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      // Every stored row re-passes the strict contract AND the engine's own
      // approval gate — the mapping proven end to end, not asserted.
      const content = nonogramDailyContentSchema.parse(row.content);
      const weekday = weekdayOf(row.date);
      expect(content.weekday).toBe(weekday);
      expect(content.size).toBe(NONOGRAM_WEEKDAY_CRITERIA[weekday].size);
      expect(row.seed).toBe(content.seed);
      // `validateNonogram` takes ONE argument and derives its criteria from
      // the puzzle's own weekday, so the narrowing above is what makes this
      // a check against the DATE rather than against the puzzle itself.
      expect(validateNonogram({ ...content, weekday }).ok).toBe(true);
    }
  });

  it("T-API-S18: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);
    // Every weekday appears exactly once in a 7-day window, so failing one
    // weekday fails exactly one date.
    nonogram.failWeekdays.add(weekdayOf(doomedDate));

    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result.generated).toBe(6);
    expect(result.depth).toBe(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(doomedDate);
    expect(result.failures[0]?.reason).toContain("nonogram generation failed");
    const dates = (await nonogramRows()).map((row) => row.date).sort();
    expect(dates).not.toContain(doomedDate);
    expect(dates).toHaveLength(6);
    // The doomed date spent its whole per-date budget; the other six were
    // covered on their first seed.
    expect(nonogram.calls).toBe(6 + MAX_NONOGRAM_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S19: the weekday/size cross-check is a TRIPWIRE — it can only fire for a puzzle this loop did not generate", async () => {
    // `generateNonogram` writes `weekday` and `size` from the same criteria
    // table the assertion reads, so real generator output can NEVER fail it.
    // Forcing every call to generate Monday's board is the only way to reach
    // the branch, and this comment exists so a later reader does not mistake
    // the case for coverage of a production path.
    nonogram.forceWeekday = 1;
    const today = await todaySaoPaulo(ctx.db);
    const monday = Array.from({ length: 7 }, (_unused, offset) =>
      addDays(today, offset),
    ).find((date) => isoWeekdayOf(date) === 1);
    if (monday === undefined) {
      throw new Error("unreachable: a 7-day window contains every weekday");
    }

    const result = await topUpNonogramBuffer(ctx.db, 7);

    // Only the date that really IS a Monday survives; the other six are
    // failed closed for the date, one seed each — a mismatch is code drift,
    // and every other seed would reproduce it.
    expect(result.generated).toBe(1);
    expect(result.failures).toHaveLength(6);
    for (const failure of result.failures) {
      expect(failure.date).not.toBe(monday);
      expect(failure.reason).toContain("weekday/size cross-check failed");
    }
    const rows = await nonogramRows();
    expect(rows.map((row) => row.date)).toEqual([monday]);
    expect(nonogram.calls).toBe(7);

    // The anti-vacuity half: the very puzzle the cross-check rejected is one
    // the VALIDATOR approves, so this proves the ASSERTION rejected it and
    // not `validateNonogram` (plan 020 P6/TR-11).
    const rejected = nonogram.lastPuzzle;
    if (rejected === undefined) {
      throw new Error("unreachable: the mock generated at least once");
    }
    expect(rejected.weekday).toBe(1);
    expect(validateNonogram(rejected).ok).toBe(true);
  });

  it("T-API-S20: a second run generates nothing and never touches an existing row", async () => {
    await topUpNonogramBuffer(ctx.db, 7);
    const before = new Map(
      (await nonogramRows()).map((row) => [
        row.date,
        JSON.stringify({ seed: row.seed, content: row.content }),
      ]),
    );
    nonogram.calls = 0;

    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 0, depth: 7, failures: [] });
    expect(nonogram.calls).toBe(0);
    for (const row of await nonogramRows()) {
      expect(JSON.stringify({ seed: row.seed, content: row.content })).toBe(
        before.get(row.date),
      );
    }
  });
});

/**
 * Termo's top-up is not a sibling of the three above and this describe is
 * shaped accordingly: there is no engine to mock, no generation to fail and
 * no retry budget to exhaust. What replaces all of that is a CURATED POOL —
 * 400 answers, none of which may ever be drawn twice (ADR-0040) — so every
 * case below is about which answers remain eligible.
 *
 * No per-`it` timeout, and the arithmetic is here rather than in a commit
 * message because a later reader will otherwise copy the 30_000 above "for
 * safety". The wall clock here is PGlite round trips, not CPU: the top-up
 * itself is 0.019 ms for a cold week and 0.057 ms for its absolute worst
 * run. Measured on this toolchain, 395 rows inserted one at a time is
 * 74-95 ms and the same rows in ONE multi-row insert is 6.9 ms; at
 * landmine 6's 4x CI factor the row-by-row worst case is 378 ms, or 7.6 %
 * of vitest's 5 000 ms default. So the budget is not tight, and the
 * multi-row insert below is taken for READABILITY and speed — it is not
 * what keeps this file inside the timeout.
 */
describe("topUpTermoBuffer", () => {
  /** The `console.error` the low-pool warning writes; captured, not silenced. */
  let poolWarnings: string[] = [];

  beforeEach(() => {
    poolWarnings = [];
    vi.spyOn(console, "error").mockImplementation((...data: unknown[]) => {
      for (const entry of data) {
        if (typeof entry === "string") {
          poolWarnings.push(entry);
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function termoRows(): Promise<
    { date: string; seed: number; content: unknown }[]
  > {
    const rows = await ctx.db.select().from(dailyPuzzles);
    return rows
      .filter((row) => row.game === "termo")
      .map((row) => ({ date: row.date, seed: row.seed, content: row.content }));
  }

  function answersOf(rows: { content: unknown }[]): string[] {
    return rows.map(
      (row) => termoDailyContentSchema.parse(row.content).normalized,
    );
  }

  it("T-API-S29: a cold depth-30 run writes 30 rows with 30 DISTINCT curated answers", async () => {
    const result = await topUpTermoBuffer(ctx.db, 30);

    expect(result).toEqual({ generated: 30, depth: 30, failures: [] });
    const rows = await termoRows();
    expect(rows).toHaveLength(30);

    const today = await todaySaoPaulo(ctx.db);
    expect(rows.map((row) => row.date).sort()).toEqual(
      Array.from({ length: 30 }, (_, offset) => addDays(today, offset)),
    );

    const eligible = new Map(
      TERMO_ANSWERS.map((answer) => [answer.normalized, answer.canonical]),
    );
    const drawn = answersOf(rows);
    // Distinct WITHIN the run: the pool is spliced on every successful
    // insert, so two dates in one invocation cannot collide. The used-set
    // read alone would not prevent this — it is taken before the first write.
    expect(new Set(drawn).size).toBe(30);
    for (const row of rows) {
      const content = termoDailyContentSchema.parse(row.content);
      // Every stored row is a MEMBER of the curated list, not merely a
      // five-letter string that happens to parse.
      expect(eligible.get(content.normalized)).toBe(content.canonical);
      // The content is exactly `{canonical, normalized}` — no index, no
      // seed, no game literal (ADR-0040's three absences).
      expect(Object.keys(content).sort()).toEqual(["canonical", "normalized"]);
      // The COLUMN still carries the accepted uint32 draw, as provenance.
      expect(Number.isInteger(row.seed)).toBe(true);
      expect(row.seed).toBeGreaterThanOrEqual(0);
      expect(row.seed).toBeLessThan(2 ** 32);
    }
    // 370 answers remain, so the low-pool warning must NOT have fired.
    expect(poolWarnings).toEqual([]);
  });

  it("T-API-S30: a second run generates nothing and changes no stored content", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const before = new Map(
      (await termoRows()).map((row) => [row.date, JSON.stringify(row)]),
    );

    const result = await topUpTermoBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 0, depth: 7, failures: [] });
    const after = await termoRows();
    expect(after).toHaveLength(7);
    for (const row of after) {
      // Byte-identical: rows are immutable once written (ADR-0024 D14).
      expect(JSON.stringify(row)).toBe(before.get(row.date));
    }
  });

  it("T-API-S31: a KILLED row's answer is never drawn again", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const killedDates = Array.from({ length: 5 }, (_, offset) =>
      addDays(today, offset),
    );
    // Killed, never deleted: a killed date stays COVERED (listBufferedDates
    // counts it), so the wider run below fills only the new dates — and the
    // five spent answers must stay spent. A killed date's answer may already
    // have reached players.
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'termo' and date <= ${killedDates[4] ?? today}`,
    );
    const killedAnswers = new Set(
      answersOf(
        (await termoRows()).filter((row) => killedDates.includes(row.date)),
      ),
    );
    expect(killedAnswers.size).toBe(5);

    const result = await topUpTermoBuffer(ctx.db, 14);

    expect(result.generated).toBe(7);
    expect(result.failures).toEqual([]);
    // Depth counts ALIVE rows only: 14 covered dates minus the 5 killed.
    expect(result.depth).toBe(9);
    const fresh = (await termoRows()).filter(
      (row) => !killedDates.includes(row.date),
    );
    for (const answer of answersOf(fresh)) {
      expect(killedAnswers.has(answer)).toBe(false);
    }
    // And the whole table is still collision-free, across both runs.
    const all = answersOf(await termoRows());
    expect(new Set(all).size).toBe(all.length);
  });

  it("T-API-S32: exhaustion FAILS CLOSED — uncovered dates carry the exhaustion reason", async () => {
    // 395 of the 400 answers spent, in ONE multi-row insert: drizzle 0.45.2
    // emits a single statement with 395 value tuples and 1 975 bind
    // parameters against Postgres's 65 535 ceiling. Row by row this measures
    // 74-95 ms and this way 6.9 ms — a readability and speed choice, NOT a
    // timeout fix (see the describe's header).
    //
    // The dates are far in the past so they neither cover a target date nor
    // count toward `bufferDepth`, which reads `date >= SP-today`.
    const spent = TERMO_ANSWERS.slice(0, 395);
    await ctx.db.insert(dailyPuzzles).values(
      spent.map((answer, index) => ({
        game: "termo" as const,
        date: addDays("2020-01-01", index),
        seed: index,
        content: { canonical: answer.canonical, normalized: answer.normalized },
        publishedAt: sql`now() - interval '1 year'`,
      })),
    );

    const result = await topUpTermoBuffer(ctx.db, 10);

    expect(result.generated).toBe(5);
    expect(result.depth).toBe(5);
    expect(result.failures).toHaveLength(5);
    for (const failure of result.failures) {
      // The literal is duplicated here on purpose, as `RUN_BUDGET_EXHAUSTED`
      // already is at T-API-S16 above: it is OPERATOR-FACING copy that ends
      // up in the /cron/publish body and the alert issue, so its wording is
      // part of what this test protects.
      expect(failure.reason).toBe(
        "answer list exhausted: every curated Termo answer is already used",
      );
    }
    const today = await todaySaoPaulo(ctx.db);
    // The FIRST five dates are covered and the last five fail: the loop
    // never recycles and never reorders.
    expect(result.failures.map((failure) => failure.date)).toEqual(
      Array.from({ length: 5 }, (_, offset) => addDays(today, offset + 5)),
    );
    const fresh = (await termoRows()).filter((row) => row.date >= today);
    expect(fresh).toHaveLength(5);
    const spentSet = new Set(spent.map((answer) => answer.normalized));
    for (const answer of answersOf(fresh)) {
      expect(spentSet.has(answer)).toBe(false);
    }

    // And the low-pool warning fired exactly once for the run, as a LOG
    // LINE and not an alert — the alert channel is buffer depth (ADR-0010).
    expect(poolWarnings).toHaveLength(1);
    expect(JSON.parse(poolWarnings[0] ?? "null")).toEqual({
      event: "termo-answer-pool-low",
      remaining: 5,
      total: 400,
    });
  });

  it("T-API-S44: the low-pool warning fires AT 30 remaining, and is silent at 31", async () => {
    // ADR-0040 decision 7 says the top-up logs `termo-answer-pool-low` **at
    // 30 remaining**. The guard shipped as `pool.length < 30`, so the one
    // value the constant is named for was the one value it stayed silent for
    // (#27 step-7 finding A-4). Both sides are asserted, because a `<=` that
    // fired at 31 too would be the opposite error.
    //
    // The dates are far in the past so the spent rows neither cover a target
    // date nor count toward `bufferDepth`, exactly as T-API-S32 does it.
    const spendAnswers = async (count: number): Promise<void> => {
      await ctx.db.insert(dailyPuzzles).values(
        TERMO_ANSWERS.slice(0, count).map((answer, index) => ({
          game: "termo" as const,
          date: addDays("2020-01-01", index),
          seed: index,
          content: {
            canonical: answer.canonical,
            normalized: answer.normalized,
          },
          publishedAt: sql`now() - interval '1 year'`,
        })),
      );
    };

    // 400 - 369 = 31 remaining: one above the line, and silent.
    await spendAnswers(369);
    await topUpTermoBuffer(ctx.db, 1);
    expect(poolWarnings).toEqual([]);

    // The run above spent one more answer, so the pool is now exactly 30.
    await topUpTermoBuffer(ctx.db, 2);
    expect(poolWarnings).toHaveLength(1);
    expect(JSON.parse(poolWarnings[0] ?? "null")).toEqual({
      event: "termo-answer-pool-low",
      remaining: 30,
      total: 400,
    });
  });

  it("T-API-S32: an already-covered date is skipped before the pool is consulted", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const hole = addDays(today, 5);
    await ctx.db.execute(
      sql`delete from daily_puzzles where game = 'termo' and date = ${hole}`,
    );

    const result = await topUpTermoBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 1, depth: 7, failures: [] });
    const all = answersOf(await termoRows());
    expect(new Set(all).size).toBe(7);
  });
});

/**
 * The uniform draw, exercised through an INJECTED draw function rather than
 * through `crypto.getRandomValues`. `randomUint32` is a module-local in
 * `service.ts`, so `vi.mock` cannot reach it the way the sudoku and nonogram
 * engine mocks above reach theirs — the optional parameter is the seam, and
 * it exists for exactly this (plan 022 §19.5).
 *
 * `uniformDrawLimit` is EXPORTED so these assertions bind to the shipped
 * expression. Recomputing `Math.floor(2**32 / n) * n` inside the test and
 * asserting it equals itself is a tautology that stays green under a change
 * to `randomUint32() % n`, which is precisely the implementation P15
 * rejects. No distribution test ships: ADR-0023 reserves "prove" for
 * construction-backed invariants, and a frequency test would sample what
 * rejection sampling proves, carry a flake budget, and mostly test the
 * platform's CSPRNG.
 */
describe("drawUniformIndex", () => {
  const UINT32_MAX = 2 ** 32 - 1;

  it("T-API-S33: a draw one below the limit is ACCEPTED and maps to the last index", () => {
    for (const n of [1, 2, 399, 400]) {
      const limit = uniformDrawLimit(n);
      const draws: number[] = [];
      const result = drawUniformIndex(n, () => {
        draws.push(limit - 1);
        return limit - 1;
      });
      expect(draws).toHaveLength(1);
      expect(result).toEqual({ index: (limit - 1) % n, draw: limit - 1 });
      // `limit` is a multiple of `n` by construction, so the last accepted
      // uint32 maps to the last index — the property a `% n` implementation
      // shares, which is why the REJECTION cases below are the real test.
      expect(result.index).toBe(n - 1);
    }
  });

  it("T-API-S33: draws AT or ABOVE the limit are rejected and force a redraw", () => {
    // Only `n` that does NOT divide 2**32 has a non-empty reject region —
    // for a power of two the limit IS 2**32 and nothing is ever rejected
    // (pinned as its own case below). 3 is the smallest such n and gives the
    // narrowest possible region, exactly {2**32 - 1}; 399 and 400 are the
    // pool sizes production actually meets.
    for (const n of [3, 399, 400]) {
      const limit = uniformDrawLimit(n);
      // Anti-vacuity: for these n the reject region is non-empty and
      // `2**32 - 1` is genuinely inside it, so the three rejected values
      // below are not silently the same assertion three times.
      expect(limit).toBeLessThanOrEqual(UINT32_MAX);
      expect(limit % n).toBe(0);

      for (const rejected of [limit, limit + 1, UINT32_MAX]) {
        const draws: number[] = [];
        const result = drawUniformIndex(n, () => {
          draws.push(rejected);
          // First call rejects, second is the accepted redraw.
          return draws.length === 1 ? rejected : 0;
        });
        expect(draws).toEqual([rejected, rejected]);
        expect(result).toEqual({ index: 0, draw: 0 });
      }
    }
  });

  it("T-API-S33: a pool size that DIVIDES 2**32 has an empty reject region", () => {
    // The boundary case a naive `draw >= limit` guard would turn into an
    // infinite reject: `uniformDrawLimit(n)` is exactly 2**32 for every power
    // of two, and no uint32 can reach it. A one-answer pool is the last draw
    // before exhaustion, so this is reachable in production, not academic.
    for (const n of [1, 2, 4, 256]) {
      expect(uniformDrawLimit(n)).toBe(2 ** 32);
      for (const draw of [0, 1, UINT32_MAX]) {
        expect(drawUniformIndex(n, () => draw)).toEqual({
          index: draw % n,
          draw,
        });
      }
    }
  });

  it("T-API-S33: every accepted index lies in [0, n), for every draw the stub can make", () => {
    for (const n of [1, 2, 7, 399, 400]) {
      const limit = uniformDrawLimit(n);
      for (const draw of [0, 1, n - 1, n, limit - 1, Math.floor(limit / 2)]) {
        const { index } = drawUniformIndex(n, () => draw);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(n);
      }
    }
  });

  it("T-API-S33: a draw that never converges throws, and the loop runs exactly the bound it names", () => {
    const limit = uniformDrawLimit(400);
    let calls = 0;
    expect(() =>
      drawUniformIndex(400, () => {
        calls += 1;
        return limit;
      }),
    ).toThrow(/uniform draw did not converge in \d+ attempts/);
    // The bound is read OUT OF THE MESSAGE rather than copied, so this binds
    // to `MAX_UNIFORM_DRAW_ATTEMPTS` without exporting it. The throw is
    // unreachable in production — P(one reject) <= 96/2**32 at n = 400, so
    // P(64 consecutive) is about 1e-491 — and it ships because "unreachable"
    // is an argument, not a type.
    let bound = 0;
    try {
      drawUniformIndex(400, () => limit);
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : "";
      bound = Number(/in (\d+) attempts/.exec(message)?.[1] ?? 0);
    }
    expect(bound).toBeGreaterThan(0);
    expect(calls).toBe(bound);
  });

  it("T-API-S33: a non-positive or non-integer bound is a RangeError", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => drawUniformIndex(bad, () => 0)).toThrow(RangeError);
    }
  });
});
