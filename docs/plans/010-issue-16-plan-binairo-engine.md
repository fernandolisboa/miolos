# Implementation plan — Issue #16: M1 Binairo engine in `packages/games`

Point-in-time implementation plan (adversarially reviewed and fixed before implementation). Executes verbatim; a fresh implementer needs no other design input beyond the files cited.

**Orchestrator-imposed conventions (fixed, do not revisit):** game code in `packages/games/src/binairo/`, public API in `src/binairo/index.ts`; `package.json` `exports` gains `"./binairo"`; the root barrel `src/index.ts` never re-exports game modules (shared substrate only); ADR numbers 0019 and 0020 are reserved for this branch; weekday criteria table is exported for #17; retries derive from the base seed with a typed error on cap; engine-level hints are out of scope (surfaced decision for #18).

---

## 1. Ruleset decision: canonical Takuzu rule 4 is IN (ADR-0020)

The engine enforces all four canonical rules:

1. Every cell is `0` or `1`; givens are fixed.
2. No three identical digits consecutive in any row or column.
3. Every row and every column contains exactly four `0`s and four `1`s (8×8, n/2 = 4).
4. **No two rows are identical and no two columns are identical.**

Rationale, grounded in the 8×8 grid and the difficulty instrument:

- 8×8 is small. With rules 1–3 only, the technique spread is thin — surround/split pairs plus count saturation solve almost everything, and the Sunday end of the weekday ramp has nowhere to go without resorting to guessing. Rule 4 contributes exactly one extra *advanced* technique (duplicate-line avoidance, tier 2 below), which is what the hard end of the ramp needs while preserving the "no guessing ever" guarantee.
- Rule 4 only shrinks solution sets, so the clue-removal loop can go deeper before losing uniqueness — low-givens weekends (Sunday band) become reachable.
- It is the canonical Takuzu/binarypuzzle.com ruleset; players who know the genre expect it. The design copy ("Zeros e uns, em perfeito equilíbrio") describes rule 3 and is unaffected.
- Cost: #18's rules screen needs one extra line of pt-BR copy. Engine cost is one cheap check on completed lines.

Full ADR text in §7.

## 2. Public API

All public grid types are plain readonly arrays (JSON-serializable — #17 writes them to `daily_puzzles`). Internal solver state is mutable and private. `solution` and `givens` are sibling fields so ADR-0004 callers ship givens without the solution by destructuring — the type makes the separation structural, not conventional.

### 2.1 Shared substrate (root barrel — the ONLY root-barrel addition)

New file `packages/games/src/weekday.ts`:

```ts
/** ISO 8601 day-of-week numbering: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
```

**Weekday encoding: ISO 8601, Monday = 1 … Sunday = 7.** Justification (this encoding is imposed on Sudoku/Nonogram/Termo): (a) Monday-first matches the ramp's natural order — the table reads easiest→hardest top to bottom; (b) it is the ISO standard and exactly what `Temporal.ZonedDateTime.dayOfWeek` returns, which is what #17's America/Sao_Paulo cron code will compute — no off-by-one mapping at the seam; (c) it avoids the JS `Date.getDay()` Sunday=0 trap by being a *different* range (1–7), so a mistaken `getDay()` value 0 is a type error, not a silent Sunday/Monday swap. Date→weekday mapping (timezone logic) stays in #17; `packages/games` only ever sees the pure number.

`src/index.ts` gains one line: `export { WEEKDAYS, type Weekday } from "./weekday";`. **Merge note for the orchestrator/other streams: parallel engine branches cut from a `main` that lacks this file byte-copy §2.1's `src/weekday.ts` and the barrel line verbatim (identical add/add merges cleanly); after #16 merges they rebase and the copies unify. Never a divergent redefinition.**

### 2.2 Binairo module (`@miolos/games/binairo`) — exact surface

```ts
// types
export const BINAIRO_SIZE = 8;                       // daily grid is fixed 8×8 (design brief line 85)
export type BinairoCell = 0 | 1 | null;              // null = empty
export type BinairoGrid = readonly BinairoCell[];    // row-major, length 64 for the daily
export type BinairoSolvedGrid = readonly (0 | 1)[];  // row-major, complete
export type BinairoTier = 1 | 2;                     // solving-technique tiers (see §3.4); tier 3 = guessing, never approved
export interface BinairoPuzzle {
  readonly size: typeof BINAIRO_SIZE;
  readonly seed: number;                // normalized uint32 (input seed >>> 0)
  readonly weekday: Weekday;
  readonly givens: BinairoGrid;         // shippable to the client (ADR-0004)
  readonly solution: BinairoSolvedGrid; // server-side only — callers must not ship it
  readonly givensCount: number;
  readonly requiredTier: BinairoTier;   // hardest technique tier the puzzle requires
}

// generate.ts
export const BINAIRO_MAX_GENERATION_ATTEMPTS = 64;
export class BinairoGenerationError extends Error {
  readonly seed: number; readonly weekday: Weekday; readonly attempts: number;
}
export function generateBinairo(options: { seed: number; weekday: Weekday }): BinairoPuzzle;
// Deterministic: same (seed >>> 0, weekday) → deep-equal puzzle. Throws BinairoGenerationError
// after BINAIRO_MAX_GENERATION_ATTEMPTS derived-seed attempts (see §3.6).
// Doc comment MUST state the seed domain is uint32 (larger inputs alias via >>> 0).

// solve.ts
export function countBinairoSolutions(givens: BinairoGrid, limit?: number): number; // default limit 2, early exit
export function solveBinairo(givens: BinairoGrid): BinairoSolvedGrid | null;        // first solution in fixed order, or null
export interface BinairoGrade {
  readonly solvable: boolean;
  readonly unique: boolean;
  readonly requiredTier: BinairoTier | 3 | null;    // 3 = needs guessing; null = unsolvable
}
export function gradeBinairo(givens: BinairoGrid): BinairoGrade;

// constraints.ts (partial-grid rule check — the #18 local-validation affordance, ADR-0004)
export interface BinairoViolation {
  readonly rule: "run" | "balance" | "duplicate-line";
  readonly cells: readonly number[];                 // row-major indices involved
}
export function findBinairoViolations(grid: BinairoGrid): readonly BinairoViolation[];
export function isValidBinairoSolution(grid: BinairoSolvedGrid): boolean; // rules 2+3+4 on a complete grid

// validate.ts — the approval gate #17's cron calls
export interface BinairoApprovalCriteria {
  readonly maxTier: BinairoTier;  // ceiling: puzzle must be completable with techniques ≤ maxTier (no guessing)
  readonly minTier: BinairoTier;  // floor: puzzle must REQUIRE at least one deduction of tier ≥ minTier
  readonly minGivens: number;
  readonly maxGivens: number;
}
export const BINAIRO_WEEKDAY_CRITERIA: Readonly<Record<Weekday, BinairoApprovalCriteria>>; // exported for #17
export type BinairoRejectionReason =
  | "malformed-grid" | "solution-invalid" | "givens-contradict-solution"
  | "unsolvable" | "not-unique" | "too-hard" | "too-easy"
  | "too-few-givens" | "too-many-givens";
export type BinairoValidationResult =
  | { readonly approved: true; readonly requiredTier: BinairoTier; readonly givensCount: number }
  | { readonly approved: false; readonly reasons: readonly BinairoRejectionReason[] };
export function validateBinairo(
  candidate: { readonly givens: BinairoGrid; readonly solution?: BinairoSolvedGrid },
  weekday: Weekday,
): BinairoValidationResult;
```

`src/binairo/index.ts` re-exports exactly the names above (plus the types). Nothing else is public; `techniques.ts` internals stay unexported from the barrel.

`validateBinairo` checks, in order (collecting all applicable reasons): grid length is 64 and cells are `0|1|null` (`malformed-grid`); if `solution` present — length 64, satisfies rules 2–4 (`solution-invalid`), and every given equals the solution cell (`givens-contradict-solution`); `countBinairoSolutions(givens, 2)` is ≥1 (`unsolvable`) and exactly 1 (`not-unique`); `gradeBinairo` tier ≤ `maxTier` (`too-hard` — tier 3 always rejects) and ≥ `minTier` (`too-easy`); givens count within `[minGivens, maxGivens]`.

**Hints:** not exported. The tiered solver internally computes "next forced deduction"; exposing it as a hint API is a one-function change surfaced as a decision for #18 in the PR body.

## 3. Algorithm spec

### 3.1 Internal grid representation (under `noUncheckedIndexedAccess`)

Internal solver state: `type CellState = -1 | 0 | 1` (−1 = empty) in a mutable `CellState[]` of length `n*n`, row-major, plus per-line count tallies `zeros[line]`, `ones[line]` maintained incrementally. All access goes through two total helpers in a private `internal.ts` (or top of `solve.ts`):

```ts
function cellAt(cells: readonly CellState[], index: number): CellState {
  const v = cells[index];
  if (v === undefined) throw new RangeError(`cell index out of range: ${index}`);
  return v;
}
```

and the analogous `setCellAt`. No `!` assertions, no `any`, no `@ts-ignore`. Loops iterate `0..n-1` with `index = row * n + col`; the helper makes indexing total, satisfying `noUncheckedIndexedAccess` without sprinkled narrowing. Public boundary conversions (`BinairoGrid` ↔ `CellState[]`) live beside the helpers.

**Size parameterization:** `constraints.ts`, `techniques.ts` and `solve.ts` derive `n = Math.sqrt(grid.length)` and reject non-square or odd `n` with a `RangeError` — this costs nothing and lets tests use hand-built 4×4 fixtures. `generateBinairo` and `validateBinairo` are fixed to `BINAIRO_SIZE = 8`. Do not expose size options publicly.

### 3.2 Full-grid construction (per attempt)

Backtracking fill, driven only by the attempt's `SeededRandom`:

- Visit cells in fixed row-major order 0..63.
- At each cell, candidate order is `[first, 1 - first]` with `first = rng.nextInt(2)` drawn at each (re)visit — determinism holds because the entire search is a pure function of the consumed stream.
- Place a value only if incrementally legal: no run of three completed in the cell's row/col; row and col counts of that value ≤ 4; when the placement *completes* a row (col), the completed line differs from every previously completed row (col) — rule 4.
- Dead end (both values illegal) → backtrack (decrement counts, clear cell).

At 8×8 this terminates in well under a millisecond and always succeeds.

### 3.3 Counting solver (`countBinairoSolutions`)

Propagate-then-branch DFS counting solutions with early exit at `limit` (default 2):

1. **Propagation to fixpoint:** apply the technique rules of §3.4, tiers 1 then 2, in the fixed order given there, until no rule fires. **Performance latitude:** the counting solver may propagate with tier 1 only and branch instead — counting stays correct (propagation strength affects speed, not the count) and this avoids T2a's quadratic cost inside every count-solve; the tiered (tier-1+2) fixpoint remains the grader's instrument regardless. Contradiction (a rule would place both values, a run of three exists, a line count exceeds n/2, or a completed line duplicates a completed parallel line) → this branch contributes 0.
2. **Complete grid:** verify full ruleset via `isValidBinairoSolution` (defense in depth) → contributes 1.
3. **Branch:** pick the first undetermined cell in row-major order (fixed — no heuristics, so counting order is deterministic); recurse with value 0, then value 1, summing; return early once the running count reaches `limit`.

Propagation makes branching rare at 8×8 — this keeps the property suite inside budget (§5). `solveBinairo` is the same search returning the first completed grid.

### 3.4 Technique tiers — exact detection rules (the difficulty instrument)

Applied in this fixed order, rows scanned before columns, lines in index order, cells left-to-right/top-to-bottom. Fixpoint is order-independent (deductions are monotone — never retracted), but the fixed order makes traces reproducible.

**Tier 1 (basic):**
- **T1a — surround pair:** in any line, window `[v, v, empty]` → third cell is `1−v`; `[empty, v, v]` → first cell is `1−v`.
- **T1b — split pair:** window `[v, empty, v]` → middle cell is `1−v`.
- **T1c — count saturation:** a line already containing four of value `v` → every empty cell in it is `1−v`.

**Tier 2 (advanced):**
- **T2a — line lookahead (balance forcing):** for each empty cell `c` and each `v ∈ {0,1}`: on a scratch copy, place `v` at `c` and run the **tier-1 fixpoint only**; if it reaches a contradiction (as defined in §3.3 step 1), deduce `c = 1−v`. Simulation depth is exactly one placement plus tier-1 propagation — never nested.
- **T2b — duplicate-line avoidance (rule 4):** for each *complete* line `A` and each parallel line `B` with exactly two empty cells that agrees with `A` on every filled cell, **and A's values at B's two empty positions differ**: fill B's empties with the swapped arrangement (forced — counts require the empties to hold one `0` and one `1`, and matching `A` is barred by rule 4). If A's values at those two positions are equal, do nothing — T1c/contradiction detection owns that case. (The "differ" guard is load-bearing: without it "the opposite arrangement" is ill-defined.)

**Tier 3:** anything propagation cannot finish — i.e., the counting solver had to branch. **Daily puzzles never require tier 3** (blanket "no guessing needed" guarantee; every `maxTier` below is ≤ 2, and `validateBinairo` rejects tier 3 as `too-hard` unconditionally).

**Grader (`gradeBinairo`):** run tier-1-only fixpoint from the givens; if the grid completes → `requiredTier: 1`. Else run tier-1+2 fixpoint; completes → `requiredTier: 2`. Else `requiredTier: 3`. `solvable`/`unique` come from `countBinairoSolutions(givens, 2)` (0 → `solvable: false, requiredTier: null`; soundness: every technique is a forced deduction under rules 1–4, so a tier-T completion is a proof of tier-T solvability).

### 3.5 Weekday → approval criteria table (concrete values)

```ts
export const BINAIRO_WEEKDAY_CRITERIA: Readonly<Record<Weekday, BinairoApprovalCriteria>> = {
  1: { maxTier: 1, minTier: 1, minGivens: 34, maxGivens: 40 }, // Monday    — tier-1 only, generous givens
  2: { maxTier: 1, minTier: 1, minGivens: 30, maxGivens: 34 }, // Tuesday
  3: { maxTier: 2, minTier: 1, minGivens: 26, maxGivens: 30 }, // Wednesday — tier 2 allowed, not required
  4: { maxTier: 2, minTier: 2, minGivens: 24, maxGivens: 28 }, // Thursday  — tier 2 required from here on
  5: { maxTier: 2, minTier: 2, minGivens: 20, maxGivens: 24 }, // Friday
  6: { maxTier: 2, minTier: 2, minGivens: 18, maxGivens: 22 }, // Saturday
  7: { maxTier: 2, minTier: 2, minGivens: 16, maxGivens: 20 }, // Sunday    — hardest: tier 2 + fewest givens
};
```

Ramp shape (FIXED — tests assert it): `minGivens`/`maxGivens` monotonically non-increasing Monday→Sunday; `maxTier` non-decreasing; `minTier` non-decreasing; tier 3 never allowed. Exact band numbers (TUNABLE, bounded): if property tests show generation-reliability problems (cap errors) or a floor that never binds, the implementer may shift/widen any band by at most ±4 givens while preserving the shape constraints, recording the final numbers and the reason in the PR body. Do not touch the tier columns. **Escalation path:** if band tuning within ±4 cannot make P1 pass, generation-side targeting (e.g., preferring removals that keep the puzzle tier-≤2-solvable, still fully seeded and deterministic) is authorized as an implementation detail; changing the 64-attempt cap or the tier columns still requires returning to the plan step.

### 3.6 Generation pipeline (`generateBinairo`) — determinism and retries

```
normalizedSeed = seed >>> 0
seedRng = createSeededRandom(normalizedSeed)
for attempt in 1..BINAIRO_MAX_GENERATION_ATTEMPTS:
  subSeed = Math.floor(seedRng.next() * 0x100000000)   // uint32, deterministic sequence
  rng = createSeededRandom(subSeed)
  solution = build full grid (§3.2, rng)
  target  = criteria.minGivens + rng.nextInt(criteria.maxGivens - criteria.minGivens + 1)
  order   = seeded Fisher–Yates permutation of [0..63] using rng   // NEVER Array.prototype.sort
  givens  = copy of solution
  for index of order:
    if givensCount(givens) <= target: break
    tentatively clear givens[index]
    if countBinairoSolutions(givens, 2) > 1: restore givens[index]
  if validateBinairo({ givens, solution }, weekday).approved: return puzzle   // validateBinairo grades internally
  // else: fall through to next attempt (fresh subSeed)
throw new BinairoGenerationError(normalizedSeed, weekday, BINAIRO_MAX_GENERATION_ATTEMPTS)
```

Properties this secures: uniqueness is **true by construction** (every removal is re-verified by the counting solver — "proved, not sampled" is structural); the emitted puzzle already passed the very validator #17 will call (generator aims, validator approves — the roles the issue names); determinism — every choice flows from `createSeededRandom(normalizedSeed)`, no wall clock, no `Math.random`, no attempt state seeded elsewhere; retry seeds are a pure derived sequence, so same seed → identical puzzle including identical retry paths. The typed error carries `seed`, `weekday`, `attempts` for #17's cron logs.

## 4. Property-based test plan (seam-1 prior art: proved, not sampled)

Style follows `test/random.test.ts`: `fc.assert(fc.property(...))`, seed arbitrary `fc.integer({ min: 0, max: 0xffffffff })` (the full uint32 domain — matches `seed >>> 0`), plain `expect` inside properties. Weekday arbitrary: `fc.constantFrom(...WEEKDAYS)`. The properties quantify over the entire seed domain × all seven weekdays and re-prove each invariant with the **independent** counting solver — the solver itself is first validated against hand-built fixtures, so the proof does not rest on the generator trusting itself.

### `test/binairo/solver.test.ts` — fixture validation of the instrument (unit, fast)

- 4×4 hand-built fixtures (rule-checked by hand in the test file, with the solution grids inline): (a) a puzzle with exactly one solution → `countBinairoSolutions` returns 1 and `solveBinairo` returns the known solution; (b) a puzzle with exactly two solutions → returns 2 with default limit, and 2 with `limit 3` (proves counting, not just boolean); (c) contradictory givens (three `1`s pre-placed in a row) → 0; (d) **a rule-4 fixture: a puzzle unique only because of rule 4** — use this hand-verified 4×4 grid (verified in step-3 review; `.` = empty):

  ```
  0 0 1 1
  1 1 0 0
  0 . 1 .
  1 . 0 .
  ```

  Under rules 1–3 exactly two completions exist: rows 3–4 = `0011`/`1100` (rows 1/3 and 2/4 identical, cols 1/2 and 3/4 identical) or rows 3–4 = `0110`/`1001` (all lines distinct). Rule 4 eliminates the first, so `countBinairoSolutions` must return **1** with rule 4 enforced — proves the solver enforces rule 4. (If replaced, the substitute must be equally hand-verified in the test file.)
- `isValidBinairoSolution`: one valid 4×4 complete grid → true; three mutants each violating exactly one rule (a run of three; a 3–1 count line; two identical rows) → false, and `findBinairoViolations` names the right `rule` and cells.
- Technique-tier fixtures: a givens grid completable by T1a/T1b/T1c alone → `requiredTier: 1`; a grid where tier-1 fixpoint stalls but one T2a (and separately one T2b) deduction unblocks it → `requiredTier: 2`; a sparse grid needing branching → `requiredTier: 3`.

### `test/binairo/generate.test.ts` — the acceptance-criteria proofs

- **P1 — generated puzzles are valid, unique, solvable and on-ramp** (`fc.assert` with `{ numRuns: 150 }`): for arbitrary `(seed, weekday)`: `generateBinairo` returns without throwing (this simultaneously proves the criteria table is *achievable* over the whole seed domain — a cap error fails the property); `solution` passes `isValidBinairoSolution`; every non-null given equals the solution cell; `countBinairoSolutions(givens, 3) === 1` (independent re-proof of **solvable** ≥1 and **unique** ==1 in one call; limit 3 so "exactly 1" is meaningful); `givensCount` within the weekday band; `gradeBinairo(givens).requiredTier` within `[minTier, maxTier]`; and `validateBinairo({ givens, solution }, weekday).approved === true` (the validator approves its own generator — the #17 contract).
- **P2 — determinism** (`{ numRuns: 100 }`): two *independent* `generateBinairo` calls with the same `(seed, weekday)` → `expect(a).toEqual(b)` (deep equality over the whole puzzle object, solution included).
- **P3 — seed normalization** (`{ numRuns: 25 }`): for arbitrary uint32 seed and weekday, `generateBinairo({ seed, weekday })` deep-equals `generateBinairo({ seed: seed + 2 ** 32, weekday })` — documents and proves the uint32 aliasing noted for #17.

Run counts are a floor, never to be lowered below 100 for P1/P2 (this is the seam-1 pattern Sudoku/Nonogram/Termo will copy).

### `test/binairo/validate.test.ts` — the approval gate itself

- Table shape (plain unit test): 7 entries keyed 1–7; bands monotonically non-increasing Monday→Sunday; `maxTier`/`minTier` non-decreasing; `minGivens <= maxGivens` everywhere; Monday `maxTier === 1`; Sunday `minTier === 2`. This pins the ramp *shape* independent of band tuning.
- Cross-day rejections (deterministic fixtures via the generator): a Monday-generated puzzle validated as Sunday → rejected with `too-easy` (and/or `too-many-givens`); a Sunday-generated puzzle validated as Monday → rejected with `too-hard` (and/or `too-few-givens`).
- Structural rejections: wrong-length grid → `malformed-grid`; the two-solution 4×4 solver fixture embedded at size 8 is not reusable — instead take a generated puzzle and clear givens until `countBinairoSolutions > 1`, expect `not-unique`; contradictory givens → `unsolvable`; tampered solution (flip one cell) → `solution-invalid` / `givens-contradict-solution`.
- Property (light, `{ numRuns: 50 }`): removing one extra given from a generated puzzle never makes the validator report `approved` with a grid the counting solver says is non-unique (validator and solver agree).

### Runtime budget

Dominant cost is P1: 150 runs × (one generate — full-grid build plus ≤64 removal steps each running a limit-2 count-solve, plus retries — plus one external count-solve and one grade). With T2a inside every count-solve this can reach tens of ms per run; the §3.3 tier-1-only-propagation latitude for `countBinairoSolutions` is the intended first lever if the target is missed. **Budget: the binairo test files complete in ≤ 10 s target, 30 s hard cap; the whole `packages/games` suite stays pre-commit-friendly (< 45 s).** If the budget is blown, fix propagation efficiency (tallies, dirty-line queues) — never lower run counts below the floors and never weaken the invariants.

## 5. File-by-file change list

Create — engine (`packages/games/src/`):
- `src/weekday.ts` — `Weekday`, `WEEKDAYS` (shared substrate, §2.1).
- `src/binairo/types.ts` — `BINAIRO_SIZE`, cell/grid/puzzle/tier types.
- `src/binairo/internal.ts` — `CellState`, total accessors `cellAt`/`setCellAt`, boundary conversions, seeded Fisher–Yates.
- `src/binairo/constraints.ts` — incremental legality checks, `isValidBinairoSolution`, `findBinairoViolations`.
- `src/binairo/techniques.ts` — T1a/T1b/T1c/T2a/T2b, tier-restricted fixpoint, contradiction detection (private).
- `src/binairo/solve.ts` — `countBinairoSolutions`, `solveBinairo`, `gradeBinairo`.
- `src/binairo/generate.ts` — `generateBinairo`, `BinairoGenerationError`, `BINAIRO_MAX_GENERATION_ATTEMPTS` (imports `../random`).
- `src/binairo/validate.ts` — `BINAIRO_WEEKDAY_CRITERIA`, `validateBinairo`, result/reason types.
- `src/binairo/index.ts` — public barrel (§2.2 surface exactly).

Create — tests (`packages/games/test/binairo/`): `solver.test.ts`, `generate.test.ts`, `validate.test.ts` (§4). The existing `test/purity.test.ts` scans `src/**` recursively — no change needed or allowed; it must pass over the new files as-is.

Edit:
- `packages/games/src/index.ts` — add only the weekday substrate export line (no game re-exports).
- `packages/games/package.json` — exports hunk (keys ordered `"."` first, then game subpaths alphabetically — record this ordering in ADR-0019 so the four parallel engine branches produce mergeable hunks):

```json
"exports": {
  ".": "./src/index.ts",
  "./binairo": "./src/binairo/index.ts"
}
```

Create — docs: `docs/adr/0019-per-game-subpath-exports-in-packages-games.md`, `docs/adr/0020-binairo-ruleset.md` (full texts in §7), `docs/plans/010-issue-16-plan-binairo-engine.md` (this document, converted: strip this scratchpad preamble's step framing, keep content).

Hard constraints while writing src (purity gate, §2 of the exploration brief): only relative imports; never the character sequences `import(` or `require(` anywhere in src files, comments and strings included (write "dynamic imports" in prose if ever needed); no new deps of any kind in `package.json`; no `vitest.config.ts` (ADR-0017); no `Date`, `Math.random`, `console`, Node or DOM globals in src; all randomness through `createSeededRandom`.

## 6. Verification commands and what proves each gate

Preamble for every shell: `source ~/.nvm/nvm.sh && nvm use default` (Node 24.18.1).

During implementation (fast loop): `pnpm --filter @miolos/games test -- test/binairo/solver.test.ts` etc., and `pnpm --filter @miolos/games typecheck`.

Final gates (evidence rule — paste real output in the PR, never "should pass"):
- `pnpm typecheck` — exit 0 including `@miolos/games` running **both** `tsc -p tsconfig.json` (the `types: []` + `lib ES2023` purity backstop over src) and `tsc -p test/tsconfig.json`. Proves strict/`noUncheckedIndexedAccess` compliance and that src references no Node/DOM types.
- `pnpm lint` — exit 0 with `--max-warnings 0`; the games eslint block (`no-restricted-imports`, `no-restricted-syntax`) passing over the new files is the second purity layer.
- `pnpm test` — full suite green. The output must show: `test/purity.test.ts` passing (THE mechanical zero-RN/Node-deps check named in the acceptance criteria, now covering the binairo files) and the three binairo test files with their property counts. Note total runtime against the §4 budget.
- `npx impeccable detect` — not applicable (no UI files touched); state exactly that in the PR rather than omitting it.
- Pre-commit (Husky + lint-staged + typecheck + tests) runs on every commit; never `--no-verify`.

## 7. ADR drafts (full text — commit verbatim, numbers reserved)

### `docs/adr/0019-per-game-subpath-exports-in-packages-games.md`

```markdown
# 0019 — Per-game subpath exports in packages/games

Status: accepted
Date: 2026-07-31

## Context

ADR-0011 requires per-game code-splitting in the web bundle: the Sudoku
generator must not ride along on the Binairo page. `@miolos/games` exposed a
single root export (`"."`). If game modules were re-exported from the root
barrel, every consumer of any game would statically reach all games, and
splitting would depend on tree-shaking heuristics — fragile, and invisible
when it breaks. Four game engines (Binairo, Sudoku, Nonogram, Termo) are
being built on parallel branches and need a mergeable convention now.

## Decision

- Each game lives in `packages/games/src/<game>/` with its public API in
  `src/<game>/index.ts`.
- `package.json` `exports` maps one subpath per game:
  `"./<game>": "./src/<game>/index.ts"`. Keys are ordered `"."` first, then
  game subpaths alphabetically, so parallel branches produce mergeable hunks.
- The root barrel `src/index.ts` exports shared substrate only (seeded PRNG,
  `Weekday`) and never re-exports a game module.
- Consumers import `@miolos/games/<game>` (e.g. `@miolos/games/binairo`);
  `apps/web` resolves this with `moduleResolution: bundler` against the
  source-level exports map — no build step, matching the existing setup.

## Consequences

- The module boundary, not tree-shaking, guarantees per-game splitting.
- Cross-game imports would have to be written explicitly as relative paths
  across game directories; reviewers treat any such import as a smell.
- The purity gates (test/purity.test.ts raw-text scan, eslint games block,
  `types: []` tsconfig backstop) already scan `src/**` recursively and apply
  to every game directory unchanged.
- The Sudoku, Nonogram and Termo engine tickets follow this convention and
  cite this ADR instead of re-deciding.
```

### `docs/adr/0020-binairo-ruleset.md`

```markdown
# 0020 — Binairo ruleset: canonical Takuzu, including unique lines

Status: accepted
Date: 2026-07-31

## Context

The design fixes the daily Binairo at 8×8 with 0/1 digits (design brief
line 85; Ateliê frames f3/f4). The canonical Takuzu ruleset has four rules:
(1) cells are 0/1; (2) no three identical digits consecutive in a row or
column; (3) each row and column holds exactly n/2 of each digit; (4) no two
rows identical, no two columns identical. Many casual Binairo apps drop
rule 4. Nothing in the spec or design decided it, and the weekday
difficulty ramp (easy Monday → hard Sunday, enforced by the validator's
approval criteria) needs enough technique depth on a small grid.

## Decision

Adopt the full canonical ruleset, rules 1–4, including unique rows and
columns (rule 4), for generation, solving and validation.

## Rationale

- On 8×8, rules 1–3 alone yield a thin technique spread; the hard end of
  the weekly ramp would need guessing. Rule 4 adds one advanced logic
  technique (duplicate-line avoidance) that extends the ramp while keeping
  the "no guessing ever required" guarantee for dailies.
- Rule 4 only shrinks solution sets, so clue removal can go deeper before
  losing uniqueness — the low-givens weekend bands stay reachable.
- It is the ruleset players know from canonical Takuzu implementations.

## Consequences

- Solver, grader and validator all enforce rule 4; the uniqueness proof in
  the property suite is relative to rules 1–4.
- The play screen (#18) must state the rule in its pt-BR rules copy.
- The difficulty instrument (technique tiers, weekday criteria table) lives
  in `packages/games/src/binairo/` and is exported for the publishing cron
  (#17) to consume.
```

## 8. Branch, commits, PR

Branch: `feat/16-binairo-engine` off `main`. Suggested commit sequence (Conventional Commits, English; pre-commit green on each):

1. `docs: plan the Binairo engine and record ADR-0019/0020 (#16)` — plan doc + both ADRs.
2. `feat(games): Binairo engine — generator, solver, validator with weekday ramp (#16)` — src + exports hunk + barrel line + tests. (Step 5 may split this further, e.g. solver-first TDD commits; the `/implement` skill drives it. Its trailing review/commit never replaces steps 6–8.)

PR title: `feat: Binairo engine in packages/games (#16)`, body skeleton:

```
Closes #16.

## What changed
- Binairo module at packages/games/src/binairo (generator, solver, validator), canonical Takuzu rules 1–4 (ADR-0020)
- Per-game subpath exports convention (ADR-0019); "@miolos/games/binairo"
- Weekday substrate (ISO Mon=1..Sun=7) in the root barrel; BINAIRO_WEEKDAY_CRITERIA exported for #17
- findBinairoViolations / constraints.ts — deliberate scope addition beyond the ticket's generator/solver/validator, shipped now for #18's ADR-0004 local-validation affordance (reuses the constraint code the solver needs anyway)
- Property suite proving solvable / unique / deterministic over the uint32 seed domain × all weekdays

## Evidence
### pnpm typecheck
<real output>
### pnpm lint
<real output>
### pnpm test
<real output, incl. purity.test.ts and binairo files with runtimes>
### impeccable
Not applicable — no UI files touched.

## Decisions for Fernando
None blocking. Surfaced, non-blocking:
- Engine-level hint export ("next forced deduction") deferred to #18 — falls out of the tiered solver when needed.
- Final givens-band numbers per weekday (ramp shape is fixed and tested; exact values noted here if tuned within the plan's ±4 latitude).
- Weekday type lives in the shared root barrel — other engine branches must import it, not redefine it.
```

Merge only via steps 6–8: parallel adversarial reviewers (correctness, security, quality, performance, ADR/CONTEXT adherence, issue adherence), fixes applied, all gates green with output shown.

## 9. Risks and mitigations

- **Band feasibility vs. retry cap.** Sunday's low-givens + tier-≤2 combination may reject often; P1 fails loudly if any seed exhausts 64 attempts. Mitigation: the bounded ±4 tuning latitude (§3.5) with the ramp shape locked by tests; propagation-strong removal makes low-givens uniqueness reachable. If ±4 tuning is insufficient, the §3.5 escalation path (deterministic generation-side removal targeting) is pre-authorized; cap or tier-column changes are not.
- **Property-suite runtime.** Budget in §4; fix by strengthening propagation (incremental tallies, dirty-line worklist), never by weakening invariants or run counts.
- **Merge overlap with the three parallel engine branches.** Contention points: `package.json` `exports` (mitigated by the alphabetical-key convention in ADR-0019 — conflicts stay one-line and mechanical), `src/index.ts` (this branch adds the single Weekday line; other branches must not add game exports there), and `src/weekday.ts` (other streams byte-copy §2.1 verbatim until #16 merges, then rebase — flagged to the orchestrator). Whichever branch merges second rebases; conflicts are trivial if conventions hold.
- **Grader determinism.** Fixpoints of monotone deduction rules are order-independent, and scan order is fixed anyway (§3.4); branching order in the counting solver is fixed row-major. No data-dependent heuristics anywhere.
- **Purity-gate tripwires.** The raw-text token ban catches `import(` even in comments; the plan's file list keeps all src imports relative; `Error` subclassing and `Math.imul/floor` are lib-ES2023-safe. Typecheck backstop (`types: []`) is run in the final gates, not assumed.
- **Seed aliasing at the #17 seam.** `seed >>> 0` truncation is documented on `generateBinairo` and proved by P3, so a hash-derived 53-bit seed upstream aliases loudly in review rather than silently.

## Flags for the orchestrator (not ADRs, not blocking)

- `Weekday`/`WEEKDAYS` land in the shared root barrel from this branch; instruct the Sudoku/Nonogram/Termo streams to byte-copy §2.1's `src/weekday.ts` and barrel line verbatim until #16 merges (then rebase so the copies unify), and to follow the exports-key ordering convention (ADR-0019) to keep hunks mergeable.
- The solver/constraint internals are size-parameterized (test affordance only); if a future free-play ticket wants non-8×8 Binairo, that is a product decision, not an engine change.

## Plan-review changelog

The adversarial plan review approved with 0 blocking and 7 advisory findings. Dispositions:

1. **T2b vacuous guard** — APPLIED. §3.4 T2b reworded: real guard is that A's values at B's two empty positions differ; equal-values case explicitly deferred to T1c/contradiction detection.
2. **Sunday-band escalation path** — APPLIED. §3.5 and §9 now pre-authorize deterministic generation-side removal targeting if ±4 band tuning cannot make P1 pass; cap/tier-column changes still require returning to the plan step.
3. **Rule-4 uniqueness fixture** — APPLIED. The reviewer's hand-verified 4×4 witness grid embedded verbatim in the solver.test.ts fixture (d) spec, with both rules-1–3 completions spelled out.
4. **weekday.ts merge-note wording** — APPLIED. §2.1 merge note, §9 contention list, and the orchestrator flags all now say: parallel branches byte-copy §2.1 verbatim (clean add/add merge) until #16 merges, then rebase to unify; never a divergent redefinition.
5. **P1 runtime / tier-1-only counting** — APPLIED. §3.3 grants explicit latitude for `countBinairoSolutions` to propagate tier 1 only and branch (count-preserving); §4 runtime budget names it as the first lever and drops the optimistic per-run estimate.
6. **findBinairoViolations scope surfacing** — APPLIED. PR body skeleton's "What changed" now names constraints.ts/findBinairoViolations as a deliberate scope addition for #18.
7. **Cosmetic defects** — APPLIED. §3.6 dead `grade = gradeBinairo(givens)` line dropped (validateBinairo grades internally); ADR-0019 "Sudoku (#20-ish)" replaced with "the Sudoku, Nonogram and Termo engine tickets" (no guessed issue number).

No advisory dismissed. Nothing outside the review's findings was changed.
