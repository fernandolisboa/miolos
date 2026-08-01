# Implementation plan — issue #22 "M2: Sudoku engine in packages/games"

Step 2 (Plan) of the eight-step flow, **revised at step 4** after the step-3 review (`03-plan-review.md`, REJECTED — B1/B2 + 6 advisories) and a measurement spike (see §8.1 and the Step-4 changelog at the end). Based on the step-1 brief (`01-explore.md`), issue #22, spec #13, CLAUDE.md gates, and spot-checked source (`packages/games/src/random.ts`, `src/index.ts`, `test/purity.test.ts`, `test/random.test.ts`, `package.json`, both tsconfigs). This document is committed as `docs/plans/011-issue-22-plan-sudoku-engine.md` (first commit on the branch; confirm at commit time that 011 is still the next free number in the shared `docs/plans/` + `docs/handoffs/` sequence — the sibling engine streams allocate from the same range).

## 0. Fixed conventions (orchestrator-imposed; do not renegotiate)

- Code in `packages/games/src/sudoku/`, public API in `src/sudoku/index.ts`.
- `packages/games/package.json` `exports` gains one line: `"./sudoku": "./src/sudoku/index.ts"`. The root barrel `src/index.ts` is NOT touched — it keeps only shared substrate (`createSeededRandom`); game modules are never re-exported from it (keeps per-game code-splitting honest and avoids the four-way merge on that file).
- Weekday keying: **ISO 8601, Monday = 1 … Sunday = 7 — the cross-stream seam settled by the Binairo stream (its plan §2.1)**. The shared type lives in the substrate file `src/weekday.ts`, re-exported from the root barrel. This branch adds `src/weekday.ts` and the root-barrel export line **byte-identical** to the Binairo stream's canonical content (identical file/line additions merge cleanly); sudoku code imports `Weekday` from `../weekday`, never redefines it. The `getDay()` Sunday=0 convention is banned everywhere in this stream — a stray `getDay()` value 0 is outside the 1–7 range and fails validation instead of silently swapping Sunday/Monday. Monday (1) = easiest, Sunday (7) = hardest, per spec #18. Date→weekday mapping (America/Sao_Paulo logic) stays in #17; this package only ever sees the pure number.
- The weekday→criteria table lives in the sudoku module and is exported (`SUDOKU_WEEKDAY_CRITERIA`, a `Readonly<Record<Weekday, SudokuApprovalCriteria>>` — same shape as Binairo's `BINAIRO_WEEKDAY_CRITERIA`).
- No new ADRs from this stream. ADR-worthy observations are collected in §9 "Flags for orchestrator".
- Deterministic retries: attempt seeds derive from the base seed via a master `createSeededRandom` stream; capped; on cap a typed error is thrown. Same seed ⇒ same puzzle including across rejected attempts.

## 1. Public API — `src/sudoku/index.ts`

Everything below is exported from `src/sudoku/index.ts` and nothing else is. All types `readonly`-deep, and every object this module returns is runtime-frozen (`Object.freeze`) — including the composed top-level `SudokuPuzzle`. No Zod in this package (purity); public entry points validate their inputs by hand and throw `TypeError`/`RangeError` — consumers (`packages/core`, api) do Zod parsing at their own boundaries.

**Shared substrate (byte-identical to the Binairo stream's canonical `src/weekday.ts`):**

```ts
// src/weekday.ts — added by this branch, identical to the Binairo branch's copy
/** ISO 8601 day-of-week numbering: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
```

`src/index.ts` (root barrel) gains the identical one-liner both branches add: `export { WEEKDAYS, type Weekday } from "./weekday";` — substrate only, still no game modules.

**Sudoku module surface:**

```ts
import type { Weekday } from "../weekday";  // never redefined here
export type { Weekday };                     // re-exported for consumers' convenience

/** Difficulty tier, 1 (easiest) … 5 (hardest). See grader ladder in §3.4. */
export type SudokuTier = 1 | 2 | 3 | 4 | 5;

/**
 * Grade of a puzzle under the technique ladder. "beyond" = has a unique
 * solution reachable only with techniques outside the ladder (guessing);
 * never approved for a daily — every published puzzle is logically solvable.
 */
export type SudokuGrade = SudokuTier | "beyond";

/**
 * Flat row-major 9×9 grid, length 81, index = row * 9 + col.
 * Cell values: 0 = empty, 1–9 = digit. Plain readonly number[] (not a
 * branded type): boundary validation is the consumers' Zod duty; this
 * package validates shape at its own entry points (length 81, ints 0–9).
 */
export type SudokuGrid = readonly number[];

export interface SudokuPuzzle {
  /** Clues: 0 = empty cell to solve. */
  readonly givens: SudokuGrid;
  /**
   * The unique full solution. NOTE (ADR-0004, downstream duty): the engine
   * always carries the solution — the API layer (#23) must never serialize
   * it into a client response for the daily.
   */
  readonly solution: SudokuGrid;
  /** Grade actually achieved; equals the criteria's tier by construction. */
  readonly tier: SudokuTier;
  /** Number of non-zero givens. */
  readonly clueCount: number;
  /** The base seed the puzzle was generated from (provenance/debugging). */
  readonly seed: number;
}

export interface SudokuApprovalCriteria {
  readonly tier: SudokuTier;      // gradeSudoku(givens) must equal this exactly
  readonly minClues: number;      // inclusive band on clueCount
  readonly maxClues: number;      // inclusive
}

/**
 * Thrown when no approved puzzle is found within the attempt cap.
 * Failure contract (see §3.1): carries the normalized uint32 seed, the exact
 * criteria object passed in, and the number of attempts consumed; the message
 * states all three. Fully deterministic — the same (seed, criteria,
 * maxAttempts) either always returns the same puzzle or always throws with
 * the same fields. With the default cap and the shipped criteria tables this
 * error is practically unreachable (measured, §8.1: residual risk ≈ 5e-7 per
 * seed for tier 5, lower for the rest); it signals a generation bug or
 * hand-rolled impossible criteria. Pipeline #17 must catch it and alert —
 * never publish a fallback puzzle silently.
 */
export class SudokuGenerationError extends Error {
  readonly seed: number;
  readonly criteria: SudokuApprovalCriteria;
  readonly attempts: number;
}

/** Default attempt cap; sized from the §8.1 spike (tier-5 p99 = 404 attempts). */
export const SUDOKU_MAX_GENERATION_ATTEMPTS = 1200;

/** Canonical criteria per tier (values in §4). */
export const SUDOKU_TIER_CRITERIA: Readonly<Record<SudokuTier, SudokuApprovalCriteria>>;

/** Weekday (ISO, 1 = Monday … 7 = Sunday) → criteria. Consumed by pipeline #17. */
export const SUDOKU_WEEKDAY_CRITERIA: Readonly<Record<Weekday, SudokuApprovalCriteria>>;

/** Table lookup with weekday validation (integer 1–7, else RangeError). */
export function sudokuCriteriaForWeekday(weekday: Weekday): SudokuApprovalCriteria;

/**
 * Deterministic: same (seed, criteria, maxAttempts) ⇒ deep-equal puzzle, always.
 * seed is coerced uint32 like createSeededRandom (>>> 0).
 * Throws SudokuGenerationError when options.maxAttempts (default
 * SUDOKU_MAX_GENERATION_ATTEMPTS = 1200) attempts all fail approval.
 */
export function generateSudoku(
  seed: number,
  criteria: SudokuApprovalCriteria,
  options?: { readonly maxAttempts?: number },
): SudokuPuzzle;

/**
 * Convenience: generateSudoku(seed, sudokuCriteriaForWeekday(weekday), options).
 * options threads through so the cap is reachable/adjustable from this API too.
 */
export function generateDailySudoku(
  seed: number,
  weekday: Weekday,
  options?: { readonly maxAttempts?: number },
): SudokuPuzzle;

/**
 * First solution found by the backtracking solver in deterministic (fixed,
 * unseeded) order, or null if unsolvable. Validates the grid shape.
 */
export function solveSudoku(givens: SudokuGrid): SudokuGrid | null;

/**
 * Number of solutions, counting stops early at `limit` (default 2, must be
 * a positive integer). countSudokuSolutions(g, 2) === 1 is the uniqueness
 * predicate used by the property tests and the generator.
 */
export function countSudokuSolutions(givens: SudokuGrid, limit?: number): number;

/**
 * Indices (0–80) of every cell participating in a duplicate digit within
 * its row, column, or box. Empty array = grid is legal so far. Powers
 * client-side instant feedback (#20) — a responsiveness affordance, never
 * a source of truth (ADR-0004).
 */
export function getSudokuConflicts(grid: SudokuGrid): readonly number[];

/** True iff the grid is complete (no zeros) and conflict-free. */
export function isSudokuSolved(grid: SudokuGrid): boolean;

/**
 * Highest ladder tier ever needed to solve `givens` by logic alone (§3.4),
 * or "beyond" if the ladder stalls. Precondition: givens has ≥ 1 solution;
 * an unsolvable grid grades "beyond" (the ladder stalls) — documented, not
 * detected specially.
 */
export function gradeSudoku(givens: SudokuGrid): SudokuGrade;

/**
 * The pipeline's independent verification hook — distrusts its caller.
 * True iff ALL of: gradeSudoku(puzzle.givens) === criteria.tier;
 * minClues <= clueCount <= maxClues with clueCount matching the actual
 * non-zero count; countSudokuSolutions(givens, 2) === 1; every non-zero
 * given equals the corresponding solution cell; isSudokuSolved(solution).
 * Cost is µs–low-ms — cheap enough for #17 to run on every candidate.
 */
export function isSudokuApproved(
  puzzle: SudokuPuzzle,
  criteria: SudokuApprovalCriteria,
): boolean;
```

Deliberate exclusions: no pencil-marks/notes API (UI concern, #23); no `isValidPlacement(cell, digit)` (derivable from `getSudokuConflicts` on the tentative grid; add later if #23 needs it); no partial-progress serialization.

## 2. Grid representation under `noUncheckedIndexedAccess`

- Public type: flat `readonly number[]`, length 81, `0` = empty, row-major. Index helpers in `board.ts`: `rowOf(i) = (i / 9) | 0`, `colOf(i) = i % 9`, `boxOf(i) = ((rowOf / 3) | 0) * 3 + ((colOf / 3) | 0)`.
- Internal working grids: plain mutable `number[]` created with `new Array<number>(81).fill(0)` (no `Uint8Array` — keeps `readonly` typing and equality simple; perf is fine).
- `noUncheckedIndexedAccess` handling — fixed policy, no ad-hoc lint-fixing: hot-path modules (`solve.ts`, `grade.ts`, `generate.ts`, `board.ts`) read cells with the non-null assertion `grid[i]!`, justified by a single comment at the top of each file: "index reads use `!`: every index is produced by loops over [0, 81) / [0, 9); public entry points reject grids of the wrong length (assertSudokuGrid)". Every public function first calls `assertSudokuGrid(grid)` (`board.ts`): array, length 81, every cell an integer 0–9, else `TypeError` with the offending index in the message. No `any`, no `@ts-ignore`, no `as` casts on grid reads.
- Bitmasks are plain `number`s (9-bit, bit d-1 = digit d present). Popcount via a precomputed 512-entry lookup table (module-level `const`, built by a pure loop — no side effects beyond the module's own constants).

## 3. Algorithm specification

All randomness comes from `createSeededRandom` (splitmix32) — never `Math.random`, never `Date`, never object-key iteration order. Shuffles are Fisher–Yates using `rng.nextInt`.

### 3.1 Seed discipline and retry loop (`generate.ts`)

```
generateSudoku(seed, criteria, options):
  validate criteria (tier 1–5 integer; 17 <= minClues <= maxClues <= 81) else RangeError
  maxAttempts = options?.maxAttempts ?? SUDOKU_MAX_GENERATION_ATTEMPTS (1200; positive integer else RangeError)
  master = createSeededRandom(seed)
  for attempt in 1..maxAttempts:
    attemptSeed = master.nextInt(0x1_0000_0000)   // exact uint32 draw (splitmix32 next() * 2^32 is integral)
    result = tryGenerate(attemptSeed, criteria)   // §3.2–3.5; returns puzzle or null
    if result !== null: return Object.freeze({ ...result, seed })  // provenance = base seed; frozen like its members
  throw new SudokuGenerationError(seed, criteria, maxAttempts)
```

Determinism: the attempt-seed sequence is a pure function of `seed`; each attempt uses its own `createSeededRandom(attemptSeed)` so a rejected attempt consumes a fixed amount of master-stream state (exactly one draw) regardless of why it failed. Same seed ⇒ identical attempt sequence ⇒ identical puzzle or identical typed error.

**Failure contract.** `SudokuGenerationError(seed >>> 0, criteria, maxAttempts)` is the only failure mode, it is deterministic per (seed, criteria, maxAttempts), and with the shipped criteria and the 1200 default it is practically unreachable: measured per-attempt approval rates (§8.1) are 100% (T1), 74% (T2), 14% (T3), 9% (T4), 1.2% (T5), giving residual cap-hit probability ≈ (1 − 0.012)^1200 ≈ 5e-7 for the worst tier. It is therefore *not* an accepted product behavior for legitimate daily seeds: #17 treats it as an incident (catch → alert, optionally retry with its own distinct seed), and the property tests never tolerate it — any throw fails the test. Tests exercise the error only through deliberately impossible criteria plus a tiny explicit `maxAttempts` (§5.3).

### 3.2 Full-grid fill (in `solve.ts`, used by `generate.ts`)

Randomized backtracking, per the brief's recommendation (no structural bias, trivially deterministic):

- State: `grid: number[81]` zeroed; `rows[9]`, `cols[9]`, `boxes[9]` used-digit bitmasks.
- Recurse over cell indices 0..80 in fixed ascending order. At cell `i`: `mask = ~(rows[r] | cols[c] | boxes[b]) & 0x1ff`; expand to a digit array, Fisher–Yates shuffle with the attempt rng, try each digit (place → recurse → unplace). Dead end ⇒ backtrack.
- Always succeeds (a full grid exists from any prefix reachable this way after backtracking); typical cost well under 1 ms.

### 3.3 Clue removal with uniqueness + grade capping (in `generate.ts`)

Asymmetric removal (decision — see §9 flag c): finer difficulty control, simpler code, fewer retries; 180° symmetry is an aesthetic the spec does not require.

```
tryGenerate(attemptSeed, criteria):
  rng = createSeededRandom(attemptSeed)
  solution = fillGrid(rng)
  order = fisherYatesShuffle([0..80], rng)
  grid = copy(solution); clues = 81
  for idx of order:
    if clues === criteria.minClues: break         // never leave the band's floor
    removed = grid[idx]; grid[idx] = 0
    if countSolutionsInternal(grid, 2) > 1: grid[idx] = removed; continue   // uniqueness by construction
    g = gradeInternal(grid)
    if g === "beyond" or g > criteria.tier: grid[idx] = removed; continue    // difficulty cap by construction
    clues -= 1
  finalGrade = gradeInternal(grid)
  if finalGrade !== criteria.tier: return null            // stalled below target
  if clues < criteria.minClues or clues > criteria.maxClues: return null
  return { givens: freeze(grid), solution: freeze(solution), tier: finalGrade, clueCount: clues }
```

Uniqueness and ladder-solvability hold **by construction** (a clue is never kept out if removing it breaks either); the property tests then *verify* construction rather than winning a lottery (brief §5.7). Cost per attempt is **measured, not estimated** (§8.1 spike): mean 0.3 ms (T1) to 1.7 ms (T5) per attempt including all ≤81 uniqueness checks and all grade calls, p95 ≤ 4 ms. The step-2 draft's "grade every k-th removal" mitigation is **deleted, not deferred** — the spike shows grading after every accepted removal is cheap, and that mitigation would have changed emitted puzzles per seed with unspecified restore semantics (review B1). This loop, exactly as written above, is final; any future change to it changes every generated puzzle and requires re-pinning the P1 fixture deliberately.

The strip runs a single pass over `order` (a two-pass variant was spiked and rejected: it raised the tier-5 hit rate only from 1.0% to 1.3% — inside noise — while costing ~60% more per attempt).

### 3.4 Counting solver (`solve.ts`)

`countSolutionsInternal(grid, limit)` — same bitmask engine, MRV:

- Build `rows/cols/boxes` masks from the grid; reject immediately (return 0) if a duplicate exists.
- Recurse: collect empty cells; pick the one with fewest candidates (popcount lookup; first-lowest-index tiebreak — fixed, deterministic). Zero candidates ⇒ return. No empty cells ⇒ `count++`, return.
- Try candidate digits in ascending order (determinism is irrelevant to a count but fixed order keeps behavior reproducible). Early-exit the whole recursion as soon as `count >= limit`.
- `solveSudoku` = same engine, limit 1, recording the first completed grid.

### 3.5 Technique-tier grader (`grade.ts`) — exact ladder

State: per-cell candidate masks for empty cells (from row/col/box contents), maintained incrementally after placements/eliminations. Units = 9 rows, 9 cols, 9 boxes.

Ladder loop (defines "needed"): repeatedly try tier-1 technique; if no progress, tier 2; … tier 5. When the technique at tier k makes progress (a placement or a candidate elimination), record `grade = max(grade, k)` and **restart from tier 1**. Solved ⇒ return grade (minimum 1 — a grid solvable with zero or only-T1 moves grades 1; an already-complete legal grid grades 1). All five tiers stuck ⇒ return `"beyond"`.

- **T1 — naked single**: an empty cell whose candidate mask has popcount 1 ⇒ place that digit.
- **T2 — hidden single**: in some unit, a digit with exactly one candidate cell ⇒ place it.
- **T3 — locked candidates**:
  - *Pointing*: in a box, all candidate cells for digit d lie in a single row (or column) ⇒ eliminate d from that row (column) outside the box.
  - *Claiming*: in a row (or column), all candidate cells for d lie in a single box ⇒ eliminate d from the rest of that box.
  - Progress = at least one candidate actually removed.
- **T4 — naked pair / hidden pair**:
  - *Naked pair*: two cells in a unit with identical popcount-2 masks ⇒ eliminate those two digits from every other cell in the unit.
  - *Hidden pair*: two digits whose candidate cells within a unit coincide in exactly the same two cells ⇒ reduce those two cells' masks to those two digits.
- **T5 — naked/hidden triple + X-wing**:
  - *Naked triple*: three cells in a unit whose mask union has popcount 3 ⇒ eliminate those digits elsewhere in the unit.
  - *Hidden triple*: three digits confined within a unit to the same ≤3 cells ⇒ reduce those cells to those digits.
  - *X-wing* (rows and columns variants): digit d has exactly two candidate columns in each of two rows and the column pairs coincide ⇒ eliminate d from those columns in all other rows (and the transpose).

Tier 5 deliberately excludes guessing: every daily, Sunday included, is solvable by pure logic ("beyond" is never approved). The grade is defined **relative to this ladder** — it is our house difficulty scale, not a universal one (risk noted §8.2).

**Normative ordering, two levels.** Within a tier, the techniques are attempted **in the order listed above** (T3: pointing, then claiming; T4: naked pair, then hidden pair; T5: naked triple, hidden triple, X-wing-rows, X-wing-cols), and the first technique that progresses wins the pass. Within a technique, units/cells/digits scan in fixed ascending order and the **first** finding is applied. Both orders are part of the grader's definition — grading stability across refactors depends on them (risk §8.2), so they are stated here as spec, not left as implementation accident.

## 4. Difficulty tables — concrete values

`criteria.ts`:

```ts
export const SUDOKU_TIER_CRITERIA = {
  1: { tier: 1, minClues: 36, maxClues: 56 },
  2: { tier: 2, minClues: 30, maxClues: 50 },
  3: { tier: 3, minClues: 26, maxClues: 46 },
  4: { tier: 4, minClues: 24, maxClues: 42 },
  5: { tier: 5, minClues: 22, maxClues: 40 },
} as const satisfies Record<SudokuTier, SudokuApprovalCriteria>;
```

Bands are deliberately generous rails: **tier is the binding approval criterion**; the band only catches degenerate outputs (an "easy" with 60 clues, a "hard" stripped to near-minimum). 17 is the proven Sudoku minimum, never targeted.

Weekday table (ISO 8601: 1 = Monday … 7 = Sunday; Monday easiest → Sunday hardest per spec #18):

| Weekday | Day | Tier |
|---|---|---|
| 1 | Monday | 1 |
| 2 | Tuesday | 2 |
| 3 | Wednesday | 2 |
| 4 | Thursday | 3 |
| 5 | Friday | 3 |
| 6 | Saturday | 4 |
| 7 | Sunday | 5 |

`SUDOKU_WEEKDAY_CRITERIA = { 1: T1, 2: T2, 3: T2, 4: T3, 5: T3, 6: T4, 7: T5 }`, each entry the corresponding `SUDOKU_TIER_CRITERIA` object — the table reads easiest→hardest top to bottom, and the shape matches Binairo's `BINAIRO_WEEKDAY_CRITERIA`.

## 5. Test plan — proving the acceptance criteria

All tests in `packages/games/test/sudoku/`, typechecked by the existing `test/tsconfig.json` (its `include: ["."]` already covers subdirectories; verify — if vitest's default include misses it, that would only happen with a custom config, which ADR-0017 forbids adding; vitest's default `**/*.test.ts` covers it). Plain vitest + fast-check imports, per `test/random.test.ts` prior art. **Never add `vitest.config.ts` to this package (ADR-0017).**

Seed universe idiom: `const seedArb = fc.integer({ min: 0, max: 0xffffffff });` and `const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);`.

**fc seed pinning (CI determinism — review B2).** The existing `test/random.test.ts` calls `fc.assert` without a seed, which is fine there (no attempt cap in play), but the sudoku properties combine a hard cap with fc's per-run random sampling, so every `fc.assert` in `test/sudoku/**` passes an explicit parameters object: `fc.assert(fc.property(...), { seed: FC_SEED, numRuns: N })`, with `const FC_SEED = 220_022;` (one literal constant per test file, same value, named so greps find it). The sampled puzzle-seed set is thereby identical on every CI run — vetted once when the suite first goes green, deterministic forever. This does not weaken verification: rigor comes from the per-instance count-to-2/grade checks, not from which seeds fc happens to draw (§5.5). ADR-0017 forbids a vitest config, so the pin lives in the test files, not in config.

### 5.1 Counting-solver validation first (fixtures with known counts) — `solve.test.ts`

The uniqueness property is only as strong as the counter, so the counter is validated against hand-built fixtures **before** it is trusted by the generator properties:

- A hardcoded complete valid grid (literal in the test): `countSudokuSolutions(full) === 1`; removing one cell still 1; `solveSudoku` returns the original grid.
- **Exactly-2 fixture via an unavoidable rectangle**: from the hardcoded full grid, hardcode four indices `(r1,c1),(r1,c2),(r2,c1),(r2,c2)` with `r1,r2` in the same band, `g[r1][c1]=g[r2][c2]=a`, `g[r1][c2]=g[r2][c1]=b` (the test first asserts this rectangle property holds, so the fixture is self-checking). Blanking those four cells yields exactly 2 solutions: assert `countSudokuSolutions(g, 2) === 2` and `countSudokuSolutions(g, 3) === 2`.
- Zero-solution fixtures, two of them (the step-2 draft's "fill a rectangle blank with a third digit" construction is provably impossible — in the rectangle grid every digit other than `a`/`b` is already present in each affected row/column, so no locally-legal third digit exists; review A1): (1) *illegal*: a grid with a direct row duplicate ⇒ `countSudokuSolutions === 0` via the immediate-reject path; (2) *legal-so-far but unsolvable* (exercises the search path): a 10-given literal — row 0 holds digits 1–8 in columns 0–7 with (0,8) empty, and digit 9 placed at (2,8) (same column, different row and different box-row within the band is irrelevant — any cell of column 8 outside row 0 works). Cell (0,8) then has zero candidates while the grid is duplicate-free; the test asserts both premises (`getSudokuConflicts(g).length === 0`) and `countSudokuSolutions(g, 2) === 0`.
- Empty grid: `countSudokuSolutions(empty, 2) === 2` (early exit works; must return in milliseconds).
- Input validation: length ≠ 81, non-integer, value 10 ⇒ `TypeError`; `limit` 0 ⇒ `RangeError`.
- Property (cheap): for `seedArb`, fill a grid via the internal fill path exposed through `generateSudoku(seed, SUDOKU_TIER_CRITERIA[1])`'s output `solution` (tier 1 — the cheapest, 100% first-attempt approval per §8.1): `isSudokuSolved(solution) === true`.

### 5.2 Grader validation — `grade.test.ts`

- **Tier fixtures**: hand-built literal puzzles, one per detection rule, each asserted to grade exactly its tier: a solution minus a few cells where each step is a naked single (grade 1); a fixture requiring a hidden single (grade 2); fixtures exercising pointing, claiming (grade 3); naked pair, hidden pair (grade 4); naked triple, X-wing (grade 5). The implementer builds these by construction (start from the full-grid fixture and blank targeted cells), asserting both the grade and that the specific technique fires (via grade difference against a ladder-without-that-technique expectation being "beyond" or higher — at minimum, assert exact grade).
- Complete legal grid grades 1; ladder-stuck puzzle (e.g. the 2-solution rectangle grid — no unique conclusion exists for those cells) grades `"beyond"`.
- **Cross-check property** (redundant belt-and-suspenders, not an independent grader proof — review A2): for `seedArb` × `weekdayArb` (numRuns 25, fc seed pinned): generate, then assert `solveSudoku(givens)` deep-equals `puzzle.solution`. This follows from P2 (uniqueness + givens ⊆ solution) plus counter correctness; it stays because it exercises `solveSudoku`'s public path end-to-end and catches gross wiring mistakes cheaply. The grader itself is validated by the tier fixtures above, plus this spike-verified invariant kept as a unit test on a handful of generated puzzles: the ladder's own final solved grid (exposed to tests via a test-only internal, or reconstructed by replaying the ladder) equals `solution`.
- Determinism: `gradeSudoku` called twice on the same grid gives identical results (trivially true — no rng — one unit test to lock the signature's purity).

### 5.3 Generator properties — `generate.test.ts` (the acceptance criteria, verbatim)

Each property verifies the invariant on **every** generated instance ("proved, not sampled" = per-instance verification by the independently validated counter, not spot checks):

- **P1 — determinism** (numRuns 25): for `(seed, weekday)`: two independent `generateDailySudoku(seed, weekday)` calls are `toEqual`-deep-equal. Plus a pinned regression: one hardcoded seed/weekday with the full expected `givens` array as a literal (catches cross-version drift loudly).
- **P2 — solvability + uniqueness + integrity** (numRuns 50): for `(seed, weekday)`, generate and assert all of: `givens` is a subset of `solution` (`givens[i] === 0 || givens[i] === solution[i]`); `isSudokuSolved(solution)`; `clueCount` equals the actual non-zero count; **`countSudokuSolutions(givens, 2) === 1`** (the uniqueness proof, via the counter validated in 5.1); `getSudokuConflicts(givens).length === 0`.
- **P3 — weekday ramp / approval** (numRuns 35, weekday via `constantFrom` guarantees coverage; plus a deterministic loop of 3 fixed seeds × all 7 weekdays): `gradeSudoku(givens) === sudokuCriteriaForWeekday(weekday).tier`, clueCount within `[minClues, maxClues]`, `isSudokuApproved(puzzle, criteria) === true`, and `puzzle.tier === criteria.tier`.
- **Cap behavior / failure contract**: `generateSudoku(seed, { tier: 1, minClues: 17, maxClues: 17 }, { maxAttempts: 2 })` throws `SudokuGenerationError` (a 17-clue tier-1 puzzle is practically impossible ⇒ deterministic cap hit, fast because maxAttempts is tiny). Assert the contract: `error.attempts === 2`, `error.seed === seed >>> 0`, `error.criteria` is the criteria passed, `instanceof SudokuGenerationError` and `instanceof Error`, message mentions all three fields; and a second identical call throws with deep-equal fields (deterministic failure). Also: `generateDailySudoku(seed, 7, { maxAttempts: 1 })` either returns (that seed's first attempt happens to pass) or throws the typed error — asserted via the pinned literal seed chosen so the branch taken is fixed; this locks the options threading through the daily API.
- Input validation: bad weekday (`0`, `8`, `1.5` — note `0` is exactly the `getDay()` Sunday trap the ISO encoding exists to catch) ⇒ `RangeError`; bad criteria ⇒ `RangeError`; `maxAttempts: 0` ⇒ `RangeError`.

### 5.4 Validator + criteria + packaging — `validate.test.ts`, `criteria.test.ts`

- `getSudokuConflicts`: fixtures for row/col/box duplicates (exact index sets), empty grid ⇒ `[]`, solved fixture ⇒ `[]`; `isSudokuSolved` true only on complete + legal.
- Criteria tables: keys are exactly `WEEKDAYS` (1–7); Monday (1) is tier 1; Sunday (7) is tier 5; tiers along `WEEKDAYS` order are `[1, 2, 2, 3, 3, 4, 5]` (the ramp shape, asserted explicitly and non-decreasing); every entry satisfies `17 <= minClues <= maxClues <= 81`; `sudokuCriteriaForWeekday` rejects out-of-range input including `0`.
- **Code-splitting guard**: `import * as root from "../../src/index"` and assert `"generateSudoku" in root === false` **and** `"WEEKDAYS" in root === true` — mechanically locks the orchestrator convention that the root barrel stays substrate-only (shared `weekday.ts` is substrate; game modules are not).

### 5.5 Run counts and runtime budget

Total generations across the suite ≈ 25×2 (P1) + 50 (P2) + 35+21 (P3) + 25 (5.2 cross-check) ≈ **180 generations**, of which ~1/7 (≈26) are Sundays. Budget is tier-aware, grounded in the §8.1 spike (spike hardware, plain Node): full generation including retries measures mean/p99 wall of 5/22 ms (T3), 14/57 ms (T4), 140/668 ms (T5, max 708 ms). Expected suite cost of the generations ≈ 26 × 140 ms + 154 × ≤14 ms ≈ **6 s**, plus per-instance verification; hard ceiling for the sudoku files stays 90 s. Because every fc seed is pinned (§5 idiom), suite timing is deterministic — measure once, paste in the PR. If measured over 90 s, reduce in this order (documented in the test file, never below): P2 → 40, 5.2 cross-check → 15, P1 → 15. Do **not** crank numRuns above the stated values — the seed universe is sampled either way; rigor comes from per-instance verification. Timing is *measured and pasted in the PR* (evidence rule), not asserted in a flaky CI test.

## 6. File-by-file change list

New source (`packages/games/src/sudoku/`) — all imports relative, no dynamic-import tokens anywhere (the purity regex matches comments too):

| File | Contents |
|---|---|
| `src/weekday.ts` | shared substrate, **byte-identical** to the Binairo stream's canonical content (§1): `Weekday` (ISO 1–7), `WEEKDAYS` |
| `src/sudoku/types.ts` | `SudokuTier`, `SudokuGrade`, `SudokuGrid`, `SudokuPuzzle`, `SudokuApprovalCriteria`, `SudokuGenerationError` (imports `Weekday` from `../weekday`) |
| `src/sudoku/board.ts` | `assertSudokuGrid`, index helpers (`rowOf`/`colOf`/`boxOf`), popcount table, `getSudokuConflicts`, `isSudokuSolved` |
| `src/sudoku/solve.ts` | bitmask+MRV engine: `countSudokuSolutions`, `solveSudoku`, internal `fillGrid(rng)` |
| `src/sudoku/grade.ts` | candidate-mask model + ladder T1–T5, `gradeSudoku` |
| `src/sudoku/criteria.ts` | `SUDOKU_TIER_CRITERIA`, `SUDOKU_WEEKDAY_CRITERIA`, `sudokuCriteriaForWeekday` |
| `src/sudoku/generate.ts` | retry loop (§3.1), removal (§3.3), `generateSudoku`, `generateDailySudoku`, `isSudokuApproved` |
| `src/sudoku/index.ts` | public barrel: re-export exactly the §1 surface |

New tests (`packages/games/test/sudoku/`): `solve.test.ts`, `grade.test.ts`, `generate.test.ts`, `validate.test.ts`, `criteria.test.ts` (per §5; `criteria.test.ts` also holds the root-barrel code-splitting guard, or fold into `validate.test.ts` if small).

Modified:

- `packages/games/package.json` — one added line in `exports`: `"./sudoku": "./src/sudoku/index.ts"` (after the existing `"."`). Nothing else.
- `packages/games/src/index.ts` (root barrel) — exactly one added line, byte-identical to the Binairo branch's addition: `export { WEEKDAYS, type Weekday } from "./weekday";`. Substrate only; still no game-module re-exports (guarded by the §5.4 test).
- `docs/plans/011-issue-22-plan-sudoku-engine.md` — this document, committed verbatim as the first commit.

Explicitly NOT touched: `test/purity.test.ts` (recursive; covers the new files automatically), `tsconfig.json` / `test/tsconfig.json`, root `eslint.config.mjs`, `turbo.json`, no `vitest.config.ts` ever (ADR-0017), no build script.

## 7. Verification, branch, commits, PR

### 7.1 Gates (evidence rule: paste real output; from repo root)

```sh
source ~/.nvm/nvm.sh && nvm use default
cd /home/ferna/projects/miolos
pnpm typecheck   # green = both games tsconfig programs pass; src compiles under types: [] (purity backstop)
pnpm lint        # green = eslint --max-warnings 0 incl. no-restricted-imports over src/sudoku/**
pnpm test        # green = full suite incl. purity.test.ts over new files + all §5 properties/fixtures
```

Inner loop while implementing: `pnpm --filter @miolos/games run typecheck` and `pnpm --filter @miolos/games exec vitest run test/sudoku/solve.test.ts` (single files), full suite once at the end. What each gate proves: typecheck = strict + `noUncheckedIndexedAccess` + no Node/DOM types leaked into src; lint = import restrictions + zero warnings; test = purity (deps/imports/dynamic-tokens) + counting-solver fixtures + the three acceptance properties + ramp + cap behavior. No UI touched ⇒ `npx impeccable detect` not applicable (state this in the PR). Pre-commit hooks run as-is; never `--no-verify`. Additionally paste: measured generation timing (mean/p95 over ~100 daily generations across weekdays, a throwaway script in the scratchpad — not committed) against the §5.5 budget.

### 7.2 Branch and commits (Conventional Commits, English)

Branch: `feat/22-sudoku-engine` off `main`. Suggested slices (implementer may re-slice; keep each commit green):

1. `docs: add implementation plan for the Sudoku engine (#22)` — this file at `docs/plans/011-issue-22-plan-sudoku-engine.md`.
2. `feat(games): sudoku types, board helpers and counting solver` — `src/weekday.ts` + the root-barrel substrate line (byte-identical to the Binairo seam) + types/board/solve + `solve.test.ts` fixtures (TDD: fixtures first).
3. `feat(games): sudoku technique-tier grader` — grade + `grade.test.ts` fixtures.
4. `feat(games): sudoku generator with weekday approval criteria` — criteria/generate/index + `./sudoku` export + remaining tests (properties last, they consume everything).

### 7.3 PR body skeleton

```
## What
Sudoku engine in packages/games (#22): seeded generator (backtracking fill →
grade-capped clue removal), counting solver (bitmask+MRV, early exit at 2),
validator + technique-tier grader (T1–T5), weekday approval criteria table.
New export subpath "@miolos/games/sudoku"; root barrel untouched.

## Evidence
### pnpm typecheck
<output>
### pnpm lint
<output>
### pnpm test
<output — highlight sudoku property tests and purity suite>
### Generation performance
<mean/p95 ms per weekday over N=100, vs budget p95 ≤ 150 ms>

## Decisions surfaced (non-blocking — defaults chosen, engine unaffected either way)
- Asymmetric clue pattern (no 180° symmetry). Flip later = regenerate future days only.
- Difficulty scale is the house ladder (T1–T5, §3.4 of docs/plans/011); Sunday
  requires triples/X-wing but never guessing. Exact-T5 puzzles are rare under
  random generation (~1.2%/attempt, spike-measured), so Sunday generation costs
  ~140 ms mean / ~0.7 s p99 server-side — accepted; cap 1200 makes failure
  practically unreachable (~5e-7/seed).
- Weekday encoding is the shared ISO seam (Mon=1..Sun=7, src/weekday.ts,
  byte-identical across engine branches per the orchestrator's Binairo seam).
- SudokuPuzzle carries `solution`; #23's API layer must strip it for daily
  responses (ADR-0004 downstream duty).

Closes #22.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Merge only with everything green after step-6 adversarial reviews and step-7 fixes (the eight-step flow continues past this plan).

## 8. Risks

1. **Generation performance / tier-5 retry pressure — MEASURED, no longer a guess (step-4 spike).** Spike: `scratchpad/streams/issue-22/spike/sudoku-spike.js` (throwaway plain-Node port of §3.2–3.5 exactly as specified; splitmix32 byte-faithful; sanity checks — uniqueness of every sampled output and ladder-solution ≡ brute-solution — 0 failures). Results, 300 attempts per tier + full-generation runs over 200–300 base seeds:
   - Per-attempt approval rate (exact tier): T1 100%, T2 73.7%, T3 14.3%, T4 9.0%, **T5 1.0–1.3%** (pooled ≈ 1.2%). Final-grade distribution under cap-5 maximal strip: {1: ~1%, 2: ~70%, 3: ~19%, 4: ~9%, 5: ~1%} — random minimal-ish puzzles are dominated by singles difficulty, as the review suspected.
   - Per-attempt wall time: mean 0.3 ms (T1) → 1.7 ms (T5), p95 ≤ 4 ms — the "tens of ms" fear was wrong; grading after every removal is cheap. The draft's grade-batching mitigation is deleted (it was output-changing with no restore semantics — review B1).
   - Full generation, exact T5, single pass, `maxAttempts` 1200, 200 seeds: **0 cap failures**; attempts mean 83 / p50 56 / p95 269 / p99 404 / max 408; wall mean 140 ms / p50 95 ms / p95 429 ms / p99 668 ms / max 708 ms. Residual cap-hit probability ≈ (1 − 0.012)^1200 ≈ 5e-7. T3/T4 at cap 100: 0 failures in 300 seeds each, wall p99 ≤ 57 ms.
   - Rejected restructures (measured): two-pass removal (T5 rate 1.3% vs 1.0% — noise, +60% cost); Sunday band T4–T5 (hit rate 11%, but ~90% of approved Sundays would grade 4 ⇒ Sunday usually indistinguishable from Saturday, killing the spec-#18 ramp).
   - **Adopted**: exact-tier approval everywhere + default `maxAttempts` = 1200 (`SUDOKU_MAX_GENERATION_ATTEMPTS`), tier-aware budget in §5.5, failure contract in §3.1. Sunday costing ~140 ms mean server-side once a week is a non-issue. If the real implementation's measured numbers diverge materially from the spike (evidence rule: paste them in the PR), escalate to the orchestrator with numbers before weakening anything — tier equality is not negotiable at this step.
2. **Grader ambiguity.** "Tier" is defined by our exact ladder and scan order — a different Sudoku site would grade differently. That is fine (the approval criterion only needs to be mechanical and stable) but any future grader change re-grades the world: note in `grade.ts` header that ladder changes alter the meaning of stored/expected tiers.
3. **Merge overlap with the three parallel engine streams.** Shared touchpoints: `packages/games/package.json` `exports` (each stream adds one line — trivial), `pnpm-lock.yaml` (no dep changes here ⇒ no conflict), `src/weekday.ts` + the root-barrel substrate line (byte-identical additions on every branch that carries them — git merges identical added content cleanly; any byte difference is a merge conflict by design and must be resolved to the Binairo canonical text). The code-splitting guard test (§5.4) enforces the barrel convention mechanically on our side.
4. **Hand-built fixtures are wrong.** Mitigated by self-checking fixtures (the 2-solution rectangle asserts its own swap property; tier fixtures assert exact grades) and by validating the counter before any property trusts it (§5.1 ordering).
5. **Purity regressions.** No new gate work needed; the existing recursive purity test + `types: []` + eslint cover `src/sudoku/**` automatically. Only behavioral rule for the implementer: never write the token `import(` in src, even in a comment.

## 9. Flags for orchestrator (no ADRs from this stream)

- (a) `"sideEffects": false` in `packages/games/package.json` would strengthen tree-shaking for all games — one line, but package-shape beyond this stream's mandate.
- (b) ~~`Weekday` defined locally~~ **Resolved at step 4 by orchestrator directive**: `Weekday` is the shared ISO substrate (`src/weekday.ts`, Binairo seam), carried byte-identically on this branch. No consolidation pass needed.
- (c) Asymmetric clue pattern chosen over 180° rotational symmetry (product/visual call the spec doesn't make; engine-neutral, reversible).
- (d) ADR-0004 downstream duty: `SudokuPuzzle.solution` must never be serialized to the client for the daily — binds #23/#17, worth a checklist line on those issues.
- (e) `SudokuGenerationError` is an incident signal for #17 (catch → alert, never silently publish a fallback) — worth a checklist line on #17.

## Step-4 changelog

Step-3 review verdict was REJECTED (2 blocking, 6 advisory). Every finding and its disposition, plus the orchestrator's cross-stream weekday directive:

**Measurement spike** (B1 evidence): `…/scratchpad/streams/issue-22/spike/sudoku-spike.js` + `results-300.txt` + `results-t5-1200.txt` — throwaway plain-Node port of §3.2–3.5 as specified (byte-faithful splitmix32), 300 attempts/config + full-generation runs over 200–300 base seeds, 0 sanity failures (uniqueness of sampled outputs; ladder solution ≡ brute solution). Headline: exact-tier per-attempt approval T1 100% / T2 74% / T3 14% / T4 9% / **T5 ≈ 1.2%**; per-attempt wall 0.3–1.7 ms mean (p95 ≤ 4 ms); exact-T5 full generation at cap 1200 over 200 seeds: 0 failures, attempts mean 83 / p99 404, wall mean 140 ms / p99 668 ms.

- **B1 (tier-5 viability + output-changing mitigation)** — FIXED with data. Removal loop kept exactly as reviewed (grade after every accepted removal — measured cheap); the grade-batching mitigation deleted outright; two-pass and band-acceptance restructures spiked and rejected with numbers (§8.1); default `maxAttempts` raised 100 → 1200 (`SUDOKU_MAX_GENERATION_ATTEMPTS`), residual cap risk ≈ 5e-7/seed; §5.5 budget rewritten tier-aware from measurements. Determinism untouched: same (seed, criteria, maxAttempts) ⇒ same puzzle or same typed error.
- **B2 (CI flake: fc random seeds × cap, no failure contract)** — FIXED. Every `fc.assert` in `test/sudoku/**` pins `{ seed: FC_SEED, numRuns }` (repo has no prior pinning convention — `test/random.test.ts` is unpinned but cap-free; the pin is introduced here where it matters, in test files, never via a vitest config per ADR-0017). `maxAttempts` threaded through `generateDailySudoku`. Failure contract specified in §1/§3.1 (fields, determinism, "practically unreachable" now measured, #17 duty, and exactly which tests assert a throw).
- **Weekday (orchestrator directive, supersedes step-2 §0 choice)** — DONE. ISO Mon=1..Sun=7 via shared substrate `src/weekday.ts` byte-identical to the Binairo stream's canonical content; root barrel gains the identical substrate export line; `SUDOKU_WEEKDAY_CRITERIA` is now `Readonly<Record<Weekday, …>>` keyed 1–7 (Binairo shape); `getDay()` 0=Sunday convention removed everywhere (tables, arb, tests, validation — `0` now rejects with `RangeError`).
- **A1 (impossible zero-solution fixture)** — APPLIED. Duplicate-grid fixture promoted to primary; new provably-sound "legal but zero-candidate cell" 10-given literal specified for the search path (§5.1), self-checking.
- **A2 (cross-check overclaim)** — APPLIED. Reworded as redundant end-to-end check; added a ladder-solution ≡ brute-solution unit assertion (spike-verified invariant) for actual grader grounding (§5.2).
- **A3 (within-tier order normative)** — APPLIED. §3.5 now states both ordering levels (technique order within tier; scan order within technique) as spec.
- **A4 (isSudokuApproved too weak for a verification hook)** — APPLIED (strengthen, not reword): now re-checks tier, clue band + recount, uniqueness via count-to-2, givens ⊆ solution, and solved solution (§1).
- **A5 (docs/plans numbering race)** — APPLIED. Header note: confirm 011 is still free at commit time.
- **A6 (minor gaps)** — APPLIED. Fill property pinned to `SUDOKU_TIER_CRITERIA[1]`; composed puzzle object is `Object.freeze`d like its members (§3.1, §1 preamble).
