import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  SUDOKU_MAX_GENERATION_ATTEMPTS,
  SudokuGenerationError,
  countSudokuSolutions,
  generateDailySudoku,
  generateSudoku,
  getSudokuConflicts,
  gradeSudoku,
  isSudokuSolved,
  sudokuCriteriaForWeekday,
  validateSudoku,
  type SudokuApprovalCriteria,
  type Weekday,
} from "../../src/sudoku/index";

// Every fc.assert in test/sudoku/** pins { seed: FC_SEED, numRuns } so the
// sampled puzzle-seed set is identical on every CI run (plan §5, review B2).
// Run counts follow ADR-0023: 100 is the FLOOR for the main determinism (P1)
// and validity (P2) properties — never reduce those below 100, and time is
// never bought by sampling less (ADR-0055).
//
// There is no file-level ceiling. The four heavy tests below carry their own
// in-file timeouts (ADR-0017 forbids a vitest config here), adjudicated at
// #109 per ADR-0055 — two re-derived (P1, P3 ramp), two retained (P2,
// full-week); each comment says which and why. The rule, once: anchor on the
// highest measured figure, CI first and worst contended local second, x4,
// rounded up to the next 5000 ms. A ceiling, not a target: a test over
// budget / 2 is a defect to diagnose and record before anything moves —
// budget / 2 and not budget / 4 because budget = anchor x 4, so budget / 4 IS
// the anchor and would fire on the ordinary new sample maximum.
//
// What these budgets measure on CI is CPU SHARE, not the generator — the
// finding everything below rests on: the engine is byte-identical since
// e02d82a and P1 went from 35 220 ms (gate run 30683187834, 2026-08-01, 39
// test files across the whole suite) to 155 025 ms (gate run 31888933252,
// 2026-08-15, 161 files).
// On the 2-vCPU runner six vitest processes share two cores, so a CPU-bound
// property's wall time is its CPU time divided by the share it gets while
// sibling suites are executing — a share that saturates once the siblings
// outlast this file (08-12 measured 77 461 ms with MORE sibling files than
// 08-02's 124 686 ms), so it is not a function of file count and carries no
// prediction. So the cost drivers are: packages/games/src/sudoku/**; this
// file's numRuns, FC_SEED and arbitraries; fast-check's version; the
// runner's vCPU count (printed by `nproc` on every gate); and the CPU demand
// of whatever sibling suites execute concurrently in the same gate run —
// which no per-timeout list can enumerate, and which is why the tripwire
// above is read whenever a gate log is read for anything. If a tripwire
// fires again on an unchanged generator, the defect is the gate's shape,
// not this file: that conversation is issue #123. Every contended-local
// figure below is from a run at turbo's default fan-out; after #114 a bare
// `pnpm test` is capped at 2, so reproduce with
// `pnpm test --force --concurrency=10`, and read a CI figure only from a run
// whose @miolos/games:test line says `cache miss, executing`, never
// `cache hit, replaying logs` (a `gh run view --log` download carries the
// literal `^[[` colour codes: strip with perl -pe 's/\^\[\[[0-9;]*m//g').
//
// If a budget must move again, the levers that are NOT available are any
// numRuns reduction below the ADR-0023 floor and any silent reduction; the
// ones that are, in order: P3 35 -> 25 and grade.test.ts's cross-check
// 25 -> 15 (secondary properties, Binairo P3 = 25 precedent), then a floor
// amendment proposed against ADR-0023.
const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);

// Pinned regression literal: generateDailySudoku({ seed: 123456789,
// weekday: 4 }) — Thursday, tier 3. Catches cross-version drift of the
// whole pipeline loudly.
const PINNED_SEED = 123456789;
const PINNED_WEEKDAY: Weekday = 4;
const PINNED_GIVENS: readonly number[] = [
  0, 3, 0, 0, 0, 7, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 8, 4, 0, 2, 0,
  5, 0, 0, 0, 0, 0, 4, 0, 5, 0, 0, 0, 0, 6, 1, 0, 0, 9, 2, 0, 1, 0, 0, 0, 0, 0,
  0, 0, 8, 0, 1, 7, 0, 3, 0, 0, 0, 4, 6, 0, 9, 0, 0, 3, 7, 0, 3, 0, 0, 0, 0, 8,
  0, 0, 0,
];
const PINNED_SOLUTION: readonly number[] = [
  2, 3, 4, 5, 9, 7, 1, 8, 6, 6, 8, 5, 1, 3, 2, 9, 4, 7, 1, 7, 9, 8, 4, 6, 2, 3,
  5, 9, 2, 6, 3, 8, 4, 7, 5, 1, 7, 4, 3, 6, 1, 5, 8, 9, 2, 5, 1, 8, 2, 7, 9, 4,
  6, 3, 8, 9, 1, 7, 6, 3, 5, 2, 4, 4, 6, 2, 9, 5, 1, 3, 7, 8, 3, 5, 7, 4, 2, 8,
  6, 1, 9,
];

describe("generateSudoku / generateDailySudoku", () => {
  it("P1 — determinism: same (seed, weekday) yields deep-equal puzzles", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const first = generateDailySudoku({ seed, weekday });
        const second = generateDailySudoku({ seed, weekday });
        expect(second).toEqual(first);
      }),
      { seed: FC_SEED, numRuns: 100 },
    );
    // Explicit timeout, re-derived at #109 (ADR-0055 decisions 1, 2 and 4;
    // plan 051; shared arithmetic and cost drivers in the header above). The
    // cost is 200 generations — two per run, which IS the determinism
    // property; the deep-equal is not measurable beside them (P1 / P2 ≈ 2.5
    // on CI — 2.39–2.68 across the seven runs — two generations against one)
    // — so nothing is reducible without reducing numRuns, which ADR-0023
    // floors. Figures: 155 025 ms on CI, the pooled maximum over seven
    // genuine gate runs (31888933252; the others 85 994–147 606 ms) — 64.6 %
    // of the previous 240 000 ms and over its budget / 2 = 120 000 ms on five
    // of the seven — and 40 844 ms contended local (pooled max over 3
    // uncapped runs at #109; every workspace but packages/games at #120's
    // worker bound). CI is the anchor: 155 025 x 4 = 620 100 -> 625 000 ms,
    // of which the anchor is 24.8 % and 49.6 % of the budget / 2 =
    // 312 500 ms tripwire. The 240 000 it replaces was never derived by
    // ADR-0055 decision 2: sized at #55 from an isolated ~18.5 s local
    // figure — the baseline class plan 042 §2.2 shows under-shoots CI — via
    // a multiplier its comment never stated (18.5 x 4 = 74 s, not 240 s); CI
    // runs this test at 4.6–8.4x its isolated cost, not the "3-4x" that
    // comment claimed. So this is decision
    // 2's first application here, with decision 4's diagnosis discharged
    // first (plan 051 §3 D1). A ceiling, not a target: over 312 500 ms is a
    // defect to diagnose and record, never a number to raise — and on an
    // unchanged generator that defect is the gate's shape (see the header).
  }, 625_000);

  it("P1 — pinned regression: the literal expected puzzle for a fixed seed", () => {
    const puzzle = generateDailySudoku({
      seed: PINNED_SEED,
      weekday: PINNED_WEEKDAY,
    });
    expect(puzzle.givens).toEqual(PINNED_GIVENS);
    expect(puzzle.solution).toEqual(PINNED_SOLUTION);
    expect(puzzle.tier).toBe(3);
    expect(puzzle.clueCount).toBe(26);
    expect(puzzle.seed).toBe(PINNED_SEED);
  });

  it("P2 — solvability + uniqueness + integrity on every instance", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateDailySudoku({ seed, weekday });
        for (let i = 0; i < 81; i += 1) {
          const given = puzzle.givens[i]!;
          expect(given === 0 || given === puzzle.solution[i]).toBe(true);
        }
        expect(isSudokuSolved(puzzle.solution)).toBe(true);
        expect(puzzle.clueCount).toBe(
          puzzle.givens.filter((v) => v !== 0).length,
        );
        // The uniqueness proof, via the counter validated in solve.test.ts.
        expect(countSudokuSolutions(puzzle.givens, 2)).toBe(1);
        expect(getSudokuConflicts(puzzle.givens)).toEqual([]);
      }),
      { seed: FC_SEED, numRuns: 100 },
    );
    // Retained at 240 000 ms at #109, not re-derived (ADR-0055 decision 4
    // governs a shipped ceiling; the ADR-0057 decision 5 shape). Figures:
    // 62 009 ms on CI, the pooled maximum over the same seven genuine runs
    // (31888933252; 32 122–61 783 ms on the other six) = 25.8 % — under the
    // 40 % trigger and under budget / 2 = 120 000 ms — and 9 870 ms contended
    // local (#109, 3 uncapped runs). Decision 2's arithmetic would say
    // 62 009 x 4 = 248 036 -> 250 000 ms, one step above what ships;
    // recorded as that one-step disagreement and not moved, because nothing
    // fires and it has never been red. Same driver and same contention as P1
    // (one generation per run plus the counting-solver re-proof), so it
    // drifts with P1: the trigger sits at 96 000 ms, the tripwire at
    // 120 000 ms. The comment this replaces derived the number from an
    // isolated ~9 s figure by an unstated multiplier; the sentence is
    // replaced, the number is not.
  }, 240_000);

  it("P3 — weekday ramp / approval on every instance", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const criteria = sudokuCriteriaForWeekday(weekday);
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(gradeSudoku(puzzle.givens)).toBe(criteria.tier);
        expect(puzzle.tier).toBe(criteria.tier);
        expect(puzzle.clueCount).toBeGreaterThanOrEqual(criteria.minClues);
        expect(puzzle.clueCount).toBeLessThanOrEqual(criteria.maxClues);
        expect(validateSudoku(puzzle, criteria)).toEqual({
          approved: true,
          tier: criteria.tier,
          clueCount: puzzle.clueCount,
        });
      }),
      { seed: FC_SEED, numRuns: 35 },
    );
    // Explicit timeout, re-derived at #109 (ADR-0055 decisions 1, 2 and 4;
    // plan 051; shared arithmetic in the header). 35 runs of one generation +
    // grade + validate. Figures: 24 386 ms on CI, pooled maximum over seven
    // genuine gate runs (32083224936; 14 144–24 114 ms on the other six) =
    // 40.6 % of the previous 60 000 ms — over the 40 % trigger on two of the
    // seven, including the maximum (24 114 = 40.19 %, 24 386 = 40.6 %); the
    // trigger reads the maximum — and 3 711 ms contended local (#109, 3
    // uncapped runs). 24 386 x 4 = 97 544 -> 100 000 ms, of which the anchor
    // is 24.4 % and 48.8 % of the budget / 2 = 50 000 ms tripwire. It was a
    // bare `60000` from the engine's first commit, never derived by any
    // rule, and it drifted 5 824 -> 24 386 ms on CI with the gate's CPU
    // share exactly as P1 did (header). A ceiling, not a target: over
    // 50 000 ms is a defect to diagnose and record. numRuns 35 is a
    // secondary (approval) property outside ADR-0023's floor and is untouched
    // regardless (#109). The full-week sibling below is deliberately left at
    // 60 000 ms: 8 189 ms CI maximum over the same seven runs (31888933252;
    // 4 391–8 072 ms on the others) = 13.6 %, 1 288 ms contended local — under
    // the trigger; its literal is respelt 60_000 and nothing else changes.
  }, 100_000);

  it("P3 — deterministic full-week coverage for fixed seeds", () => {
    const weekdays: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
    for (const seed of [7, 77, 777]) {
      for (const weekday of weekdays) {
        const criteria = sudokuCriteriaForWeekday(weekday);
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(gradeSudoku(puzzle.givens)).toBe(criteria.tier);
        expect(validateSudoku(puzzle, criteria).approved).toBe(true);
      }
    }
  }, 60_000);

  it("throws the full failure contract when the attempt cap is hit", () => {
    // A 17-clue tier-1 puzzle is practically impossible: deterministic cap
    // hit, fast because maxAttempts is tiny.
    const impossible: SudokuApprovalCriteria = {
      tier: 1,
      minClues: 17,
      maxClues: 17,
    };
    const seed = 424242;
    let caught: unknown;
    try {
      generateSudoku({ seed, criteria: impossible, maxAttempts: 2 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SudokuGenerationError);
    expect(caught).toBeInstanceOf(Error);
    const typed = caught as SudokuGenerationError;
    expect(typed.attempts).toBe(2);
    expect(typed.seed).toBe(seed >>> 0);
    expect(typed.criteria).toBe(impossible);
    expect(typed.message).toContain(String(seed >>> 0));
    expect(typed.message).toContain("tier: 1");
    expect(typed.message).toContain("2 attempts");

    // Deterministic failure: an identical call throws with deep-equal fields.
    let again: unknown;
    try {
      generateSudoku({ seed, criteria: impossible, maxAttempts: 2 });
    } catch (error) {
      again = error;
    }
    const typedAgain = again as SudokuGenerationError;
    expect(typedAgain.attempts).toBe(typed.attempts);
    expect(typedAgain.seed).toBe(typed.seed);
    expect(typedAgain.criteria).toEqual(typed.criteria);
    expect(typedAgain.message).toBe(typed.message);
  });

  it("threads maxAttempts through generateDailySudoku", () => {
    // Pinned literal seed chosen so the branch taken is fixed: seed 0's
    // first Sunday attempt does NOT pass approval, so a cap of 1 throws.
    expect(() =>
      generateDailySudoku({ seed: 0, weekday: 7, maxAttempts: 1 }),
    ).toThrow(SudokuGenerationError);
    let caught: unknown;
    try {
      generateDailySudoku({ seed: 0, weekday: 7, maxAttempts: 1 });
    } catch (error) {
      caught = error;
    }
    expect((caught as SudokuGenerationError).attempts).toBe(1);
  });

  it("exposes the measured default attempt cap", () => {
    expect(SUDOKU_MAX_GENERATION_ATTEMPTS).toBe(1200);
  });

  it("rejects invalid weekdays, criteria, and maxAttempts", () => {
    // 0 is exactly the Date#getDay() Sunday trap the ISO encoding catches.
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 0 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 8 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 1.5 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 0 as never, minClues: 30, maxClues: 50 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 16, maxClues: 50 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 40, maxClues: 30 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 36, maxClues: 82 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 36, maxClues: 56 },
        maxAttempts: 0,
      }),
    ).toThrow(RangeError);
  });

  it("returns frozen puzzles (deep, including the composed object)", () => {
    const puzzle = generateDailySudoku({ seed: 5, weekday: 1 });
    expect(Object.isFrozen(puzzle)).toBe(true);
    expect(Object.isFrozen(puzzle.givens)).toBe(true);
    expect(Object.isFrozen(puzzle.solution)).toBe(true);
  });
});

describe("validateSudoku", () => {
  it("rejects a puzzle whose fields lie about the grid, naming the reasons", () => {
    const criteria = sudokuCriteriaForWeekday(1);
    const puzzle = generateDailySudoku({ seed: 5, weekday: 1 });
    expect(validateSudoku(puzzle, criteria)).toEqual({
      approved: true,
      tier: puzzle.tier,
      clueCount: puzzle.clueCount,
    });
    // Wrong criteria tier for the actual grade fails on both grade and the
    // declared tier field.
    const wrongTier = validateSudoku(puzzle, sudokuCriteriaForWeekday(7));
    expect(wrongTier.approved).toBe(false);
    if (!wrongTier.approved) {
      expect(wrongTier.reasons).toContain("too-easy");
      expect(wrongTier.reasons).toContain("tier-mismatch");
    }
    // A lying clueCount fails.
    const lyingCount = validateSudoku(
      { ...puzzle, clueCount: puzzle.clueCount + 1 },
      criteria,
    );
    expect(lyingCount.approved).toBe(false);
    if (!lyingCount.approved) {
      expect(lyingCount.reasons).toEqual(["clue-count-mismatch"]);
    }
    // A lying tier field fails even when the grid itself satisfies criteria.
    const lyingTier = validateSudoku({ ...puzzle, tier: 5 }, criteria);
    expect(lyingTier.approved).toBe(false);
    if (!lyingTier.approved) {
      expect(lyingTier.reasons).toEqual(["tier-mismatch"]);
    }
    // Givens contradicting the solution fail.
    const firstGivenIndex = puzzle.givens.findIndex((v) => v !== 0);
    const corrupted = puzzle.givens.map((v, i) =>
      i === firstGivenIndex ? (v % 9) + 1 : v,
    );
    const contradicted = validateSudoku(
      { ...puzzle, givens: corrupted },
      criteria,
    );
    expect(contradicted.approved).toBe(false);
    if (!contradicted.approved) {
      expect(contradicted.reasons).toContain("givens-contradict-solution");
    }
    // A malformed grid is a rejection reason, not a throw (Binairo shape).
    expect(
      validateSudoku(
        { ...puzzle, givens: new Array<number>(80).fill(0) },
        criteria,
      ),
    ).toEqual({ approved: false, reasons: ["malformed-grid"] });
    // Out-of-domain criteria are a caller bug: throw, never a rejection.
    expect(() =>
      validateSudoku(puzzle, { tier: 1, minClues: 16, maxClues: 50 }),
    ).toThrow(RangeError);
  });
});
