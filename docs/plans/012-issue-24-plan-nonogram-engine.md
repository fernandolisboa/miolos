# Issue #24 — M2 Nonogram engine — Implementation plan

Step 2 (Plan) of the eight-step flow. Input: exploration brief `01-explore.md` (same directory), issue #24, CLAUDE.md gates. Target branch: `feat/24-nonogram-engine` off `main` (204b607). This plan is committed to the repo as `docs/plans/012-issue-24-plan-nonogram-engine.md` as the first commit of the branch.

## 0. Orchestrator-imposed conventions (fixed, not renegotiable here)

1. Game code in `packages/games/src/nonogram/`, public API at `src/nonogram/index.ts`.
2. `packages/games/package.json` `exports` gains `"./nonogram": "./src/nonogram/index.ts"`. The root barrel `src/index.ts` keeps only shared substrate (`random`) and does NOT re-export game modules (ADR-0019, landing with #16 — cite, don't draft).
3. Weekday: **ISO 8601 numbering, Monday = 1 (easiest) → Sunday = 7 (hardest)** — the shared substrate settled by the Binairo stream (#16 plan §2.1). This branch ships a **byte-identical copy** of `packages/games/src/weekday.ts` (the two branches merge to identical same-path content; whichever lands second has a trivial no-op conflict). Nonogram code imports `Weekday`/`WEEKDAYS` from `../weekday`, never redefines them. Nothing about the encoding is provisional.
4. Deterministic retries: attempt seeds derive from the base seed, capped, typed error on cap. Same (seed, weekday) → identical puzzle.
5. Picture source is ADR-worthy: draft `docs/adr/0021-nonogram-pictures-are-a-curated-motif-library.md` (number reserved; do not renumber).
6. Motif library is AI-authored IN THIS TICKET against the mechanical harness. Fernando is never the artist (MEMORY: "AI curates content, not Fernando").

## 1. Grid sizes and the weekday table

No grid size is specified in spec, handoff, ADRs, PRODUCT.md or DESIGN.md (brief §2). This plan fixes them.

**Size classes: 5×5, 8×8, 10×10, 15×15.** Rationale: 15×15 is the customary phone ceiling — on a ~360 px viewport minus clue gutters it yields ~20–22 px cells, the floor for tap targets; 5×5 is the floor for a non-trivial puzzle; 8×8 and 10×10 give a visible mid-week ramp. Four classes (not seven) keeps the motif-authoring lift tractable — each class is a separate content pool.

| Weekday (abstract) | Size | Band within class | Criteria (mechanical) |
|---|---|---|---|
| Mon = 1 (easiest) | 5×5 | whole class | size = 5, line-solvable; effort in `[0, ∞)` |
| Tue = 2 | 8×8 | easy half | size = 8, effortScore < T8 (band `[0, T8)`) |
| Wed = 3 | 8×8 | hard half | size = 8, effortScore ≥ T8 (band `[T8, ∞)`) |
| Thu = 4 | 10×10 | easy half | size = 10, effortScore < T10 (band `[0, T10)`) |
| Fri = 5 | 10×10 | hard half | size = 10, effortScore ≥ T10 (band `[T10, ∞)`) |
| Sat = 6 | 15×15 | easy half | size = 15, effortScore < T15 (band `[0, T15)`) |
| Sun = 7 (hardest) | 15×15 | hard half | size = 15, effortScore ≥ T15 (band `[T15, ∞)`) |

**Band-boundary convention (fixed): half-open intervals everywhere.** Easy band = `[0, T)` (score strictly below the threshold), hard band = `[T, ∞)` (score at or above it). A threshold-valued motif is always **hard-band**. This is exactly `DifficultyCriteria`'s `minEffort` inclusive / `maxEffort` exclusive — table and type speak the same convention.

- `effortScore(solveResult) = passes + (1 - firstPassFill)` — a pure function of the solver run (see §3.2). Higher = more propagation work = harder for a human.
- **T8, T10, T15 are named constants in `difficulty.ts`, calibrated during implementation** from the measured effort distribution of the authored library (pick the T nearest the class median such that the half-open split `[0, T)` / `[T, ∞)` leaves both sides ≥ `MIN_POOL`). Guessing them now would be fiction; the *mechanism* is fixed now and tests enforce it: every weekday pool has ≥ `MIN_POOL = 14` effective entries, and difficulty is monotone Mon→Sun under the lexicographic order (size rank, band rank). Final threshold values are recorded in ADR-0021 when calibrated.
- Ramp semantics: size is the dominant axis (Sat-easy 15×15 is more total work than Fri-hard 10×10); within a class the effort band orders the shared days. This is exactly the handoff's "rampa … via critério de aprovação do validador".

## 2. Public API (`packages/games/src/nonogram/index.ts`)

All types `readonly`/immutable. No dates, no timezones, no `Math.random` — the caller (publishing cron, free play) supplies `seed` and `weekday`.

```ts
// ../weekday.ts — SHARED substrate, byte-identical copy of the Binairo plan's file
// (issue-16 plan §2.1). Do not edit; do not redefine Weekday anywhere in nonogram/.
/** ISO 8601 day-of-week numbering: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
```

```ts
// types.ts
import type { Weekday } from "../weekday";

export type CellState = "filled" | "empty" | "unknown";
/** [row][col], true = filled. The solution grid IS the picture. */
export type NonogramSolution = ReadonlyArray<ReadonlyArray<boolean>>;

export interface NonogramClues {
  readonly size: number;
  /** Run lengths per row, top→bottom; [] for an all-empty line (UI renders "0"). */
  readonly rows: ReadonlyArray<ReadonlyArray<number>>;
  /** Run lengths per column, left→right. */
  readonly cols: ReadonlyArray<ReadonlyArray<number>>;
}

/** The payoff. Deliberately a single strippable field — see §6 (ADR-0004 seam). */
export interface NonogramReveal {
  readonly motifId: string;        // stable kebab-case English id, e.g. "anchor" (pt-BR display name lives in `name`: "Âncora")
  readonly name: string;           // pt-BR display name, e.g. "Âncora"
  readonly mirrored: boolean;      // whether the horizontal-mirror transform was applied
  readonly solution: NonogramSolution;
}

export interface NonogramPuzzle {
  readonly game: "nonogram";
  readonly seed: number;           // the input seed, uint32-coerced
  readonly weekday: Weekday;
  readonly size: number;
  readonly clues: NonogramClues;   // clues + size + weekday = the playable projection
  readonly reveal: NonogramReveal;
}

export interface SolveResult {
  readonly status: "solved" | "stuck" | "contradiction";
  readonly grid: ReadonlyArray<ReadonlyArray<CellState>>;
  readonly passes: number;         // full sweeps that made progress (see §3.2)
  readonly firstPassFill: number;  // fraction of cells determined after sweep 1, in [0,1]
}

export interface DifficultyCriteria {
  readonly size: number;
  /** Inclusive lower bound: entry qualifies iff minEffort <= score. 0 for easy bands. */
  readonly minEffort: number;
  /** Exclusive upper bound: entry qualifies iff score < maxEffort. T for easy bands, Infinity for hard/whole-class bands. Half-open [minEffort, maxEffort) — matches the §1 table exactly. */
  readonly maxEffort: number;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly failures: ReadonlyArray<string>; // machine-greppable reason codes
}

export class NonogramGenerationError extends Error {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly attempts: number;
}
```

```ts
// index.ts — the full public surface (named exports, matching barrel style)
export function generateNonogram(seed: number, weekday: Weekday): NonogramPuzzle;
export function solveNonogram(clues: NonogramClues): SolveResult;   // exported: local
// validation affordance (ADR-0004) and future "reveal a deducible cell" hint sit on
// top of this; no hint API is built in this ticket (spec puts hints server/UI-side).
export function deriveClues(solution: NonogramSolution): NonogramClues;
export function validateNonogram(puzzle: NonogramPuzzle): ValidationResult;
export function effortScore(result: SolveResult): number;
export const WEEKDAY_CRITERIA: Readonly<Record<Weekday, DifficultyCriteria>>;
// WEEKDAY_CRITERIA is keyed 1..7 (ISO), Mon = 1 easiest → Sun = 7 hardest.
export { NonogramGenerationError };
export type { Weekday } from "../weekday";  // re-export of the shared substrate
export type { CellState, NonogramSolution, NonogramClues, NonogramReveal,
  NonogramPuzzle, SolveResult, DifficultyCriteria, ValidationResult };
```

`validateNonogram` checks, in order (all reasons collected, not short-circuited): grid dimensions square and equal to `clues.size`; `deriveClues(reveal.solution)` deep-equals `clues`; `solveNonogram(clues)` returns `status: "solved"` with grid equal to the solution (line-solvability = solvable + unique + human-completable, the central property, brief §5); effort within `WEEKDAY_CRITERIA[weekday]`; `reveal.name` non-empty and `motifId` present in the library.

## 3. Algorithms

### 3.1 Clue derivation (`clues.ts`)

Run-length encode the `true` runs of each row (top→bottom) and column (left→right). All-empty line → `[]`. Trivial; pure.

### 3.2 Line solver (`solve.ts`)

Per-line deduction, classic reachability DP — O(n²·m) per line worst case, trivial at n ≤ 15:

1. **Feasibility table.** For a line of length `n` with current states `s[0..n-1]` and runs `k[0..m-1]`, compute `F(i, j)` = "cells `i..n-1` can be completed placing runs `j..m-1`", by reverse induction:
   - empty branch: `s[i] ≠ "filled"` and `F(i+1, j)`;
   - run branch: `j < m`, cells `i..i+k[j]-1` all `≠ "empty"`, and (`i+k[j] === n` and `j === m-1`) or (`s[i+k[j]] ≠ "filled"` and `F(i+k[j]+1, j+1)`);
   - base: `F(n, m) = true`; `F(n, j<m) = false`; `F(i, m)` = true iff no cell `i..n-1` is `"filled"`.
2. **Reachability marking.** BFS/DFS forward from `(0, 0)` over states where the prefix is reachable and `F` holds for the suffix. Traversing the empty branch marks `canBeEmpty[i]`; traversing the run branch marks `canBeFilled[i..i+k[j]-1]` and `canBeEmpty[i+k[j]]` (separator). Then per cell: filled-only → force `"filled"`; empty-only → force `"empty"`; neither reachable → **contradiction**; both → stays `"unknown"`.
3. **Full-grid fixpoint.** Grid starts all-`"unknown"`. Sweep = rows `0..n-1` then columns `0..n-1`, in that fixed order, Gauss–Seidel style (deductions visible immediately within the sweep — deterministic because the order is fixed). Maintain dirty flags: a line is re-solved only if one of its cells changed since its last visit (the memoization that matters at this scale; no arrangement cache needed for n ≤ 15). Loop until a sweep changes nothing (→ `"stuck"` if unknowns remain, else `"solved"`) or a contradiction is found. `passes` = number of sweeps that changed ≥ 1 cell; `firstPassFill` = determined/total after sweep 1.

Sweep-order dependence of the metrics is irrelevant because pools are built from *measured* variants (§3.4) — a mirrored variant's effort is measured on the mirrored clues, never inferred.

### 3.3 Generation (`generate.ts`)

```
generateNonogram(seed, weekday):
  criteria = WEEKDAY_CRITERIA[weekday]
  pool = weekdayPool(weekday)               // §3.4; harness-proven non-empty
  for attempt in 0..MAX_ATTEMPTS-1:         // MAX_ATTEMPTS = 8
    attemptSeed = (seed + attempt * 0x9e3779b9) >>> 0   // derived, deterministic
    rng = createSeededRandom(attemptSeed)
    entry = pool[rng.nextInt(pool.length)]  // { motif, mirrored }
    solution = entry.mirrored ? mirrorH(entry.motif.bitmap) : entry.motif.bitmap
    puzzle = { game, seed: seed >>> 0, weekday, size, clues: deriveClues(solution),
               reveal: { motifId, name, mirrored, solution } }
    if validateNonogram(puzzle).ok: return puzzle       // defense in depth
  throw new NonogramGenerationError(seed, weekday, MAX_ATTEMPTS)
```

Because every pool entry is harness-proven valid for its weekday (§4), attempt 0 always succeeds in practice; the retry loop + typed error exist for cross-engine convention uniformity (orchestrator convention 4) and as a tripwire if content and thresholds ever drift. All randomness flows through the one `SeededRandom`; `pool.length ≥ MIN_POOL > 0` so `nextInt` never sees 0.

### 3.4 Transforms and per-weekday pools (`difficulty.ts`)

- **Only transform: horizontal mirror** (`mirrorH`, reverse each row), applied only to motifs tagged `mirrorable: true`. Justification: any dihedral transform preserves line-solvability (it is a bijective relabeling of the row/column constraint system), but only the horizontal mirror reliably preserves *recognizability* — a mirrored anchor is an anchor; an upside-down cat is noise. Vertical flips, rotations, translations: rejected. Random noise/pixel perturbation: rejected — it destroys both recognizability and (frequently) line-solvability, and is exactly the unfalsifiable tuning the mechanical-gate culture forbids.
- **Pool construction.** Effective entries = every motif as-authored, plus the mirrored variant of every `mirrorable` motif. For each entry, run `solveNonogram(deriveClues(bitmap))` and compute `effortScore`; entry belongs to weekday `w` iff its size and score satisfy `WEEKDAY_CRITERIA[w]`. Computed lazily on first `generateNonogram` call per weekday and memoized in module state (pure derivation from constant data — determinism unaffected; ~200 small solves ≈ low tens of ms once, only in the code-split nonogram chunk). No generated/checked-in pool file.
- **Selection is uniform with replacement** across the pool; repeats across days are unpredictable and acceptable (see §4 sizing and ADR-0021).

## 4. Motif library (`motifs.ts` + per-class data files)

**Format** — plain TS constants (purity: no JSON imports, relative imports only):

```ts
export interface Motif {
  readonly id: string;                 // unique kebab-case English id: "anchor"
  readonly name: string;               // pt-BR: "Âncora"
  readonly size: 5 | 8 | 10 | 15;
  readonly mirrorable: boolean;        // asymmetric AND recognizable when mirrored
  readonly rows: ReadonlyArray<string>; // "#" = filled, "." = empty; length === size
}
```

Data split for reviewability: `motifs-5.ts`, `motifs-8.ts`, `motifs-10.ts`, `motifs-15.ts`, aggregated by `motifs.ts` into `export const MOTIFS: ReadonlyArray<Motif>`.

**Counts** — test-enforced floors (constants asserted by the harness), with targets the author aims for:

| Class | Floor | Target | Days/wk served | Draws/yr | Effective entries at target (~40% mirrorable) |
|---|---|---|---|---|---|
| 5×5 | 28 | 32 | 1 (Mon) | 52 | ~45 |
| 8×8 | 40 | 48 | 2 (Tue, Wed) | 104 | ~67 (~33/weekday band) |
| 10×10 | 40 | 48 | 2 (Thu, Fri) | 104 | ~67 (~33/band) |
| 15×15 | 32 | 40 | 2 (Sat, Sun) | 104 | ~56 (~28/band) |
| total | 140 | 168 | | 364 | |

Justification against one year of dailies: each weekday draws 52 puzzles/year from a pool of ~28–45 effective entries, so a given picture recurs on that weekday roughly 1–2 times a year, with first birthday-collision expected after ~6–8 weeks — acceptable because a Nonogram picture is not consumable content (seeing "Âncora" in March doesn't hand you May's solve the way a Termo word would; brief §5), the ADR-0010 seeded choice makes repeats unpredictable, and free-play reuse (ADR-0011, same generator, client seeds) makes per-motif exhaustion moot. Growing the library later is additive content work — new array entries that must pass the same harness, zero code change. Source weight: 168 motifs ≈ 50 KB of TS source (~300–450 bytes each: quoted row strings plus metadata), low tens of KB minified — still negligible in the code-split chunk, and short string-literal arrays pose no lint/prettier hazard.

**Curation constraints** (written into ADR-0021 and the `motifs.ts` header; the judged ones follow the ADR-0015 loop — AI draws, harness rejects, AI adjusts, judgment calls recorded in the ADR):

- Judged (AI, recorded): subject is a concrete, everyday object/animal/plant/food/tool/nature/Brazilian-iconography item nameable by a common pt-BR noun; no letters/digits/text, no brands, no people/faces of real persons, no offensive, violent, religious or political shapes; `mirrorable` only when the mirrored form is still recognizable.
- Mechanical (harness, binary): exact `size`×`size` shape, alphabet `{#,.}`; unique `id`s; non-empty pt-BR `name`; `mirrorable` ⇒ mirrored bitmap ≠ original; density guideline 30–65% reported as a warning-level diagnostic (the hard gate is solvability, not density); **line-solvable: `solveNonogram(deriveClues(bitmap))` is `"solved"` and reproduces the bitmap exactly — for the motif AND its mirrored variant**; class floors met; every weekday pool ≥ `MIN_POOL = 14`.

Authoring method (in-ticket): the implementer generates the pixel art in-code (AI-authored, per MEMORY), iterating against the harness run as a single test file (`pnpm --filter @miolos/games test -- nonogram/motifs` gives per-motif failure diagnostics naming the motif id and the failed check). **Stage the authoring by class:** author and harness-validate the 5×5 class first (smallest, cheapest feedback loop), lock in the drawing heuristics that survive the gate, then scale to 8×8, 10×10 and 15×15 in that order — checkpointing against the floors after each class and invoking the stop-and-flag escape (risk 2, §10) at the first class that stalls, never after authoring everything. Floors remain the merge gate; targets remain aspirational. Expect high rejection on first drafts (brief risk 2) — line-solvability favors connected motifs without checkerboard textures; cull or touch up rejects rather than weakening the gate.

## 5. Tests (all under `packages/games/test/nonogram/`, covered by `test/tsconfig.json`'s `include: ["."]`)

Stack: vitest + fast-check per ADR-0017; **no `vitest.config.ts` in the package** — hard rule. Seeds drawn as `fc.integer({ min: 0, max: 0xffffffff })` (matching `random.test.ts` prior art), weekdays as `fc.constantFrom(...WEEKDAYS)` — the shared `WEEKDAYS` constant from `src/weekday.ts`, matching the Binairo stream's test convention.

| File | Proves |
|---|---|
| `solve.test.ts` | Unit fixtures: a known hand-built 5×5 solves to its exact grid; all-empty and all-full grids; contradictory clues (e.g. rows demand 5 filled in a column whose clue is `[1]`) → `"contradiction"`; the ambiguous 2×2 checkerboard (`rows [[1],[1]], cols [[1],[1]]`) → `"stuck"`, never `"solved"` — the solver refuses to guess; partial-line forcing cases (overlap deductions, e.g. clue `[8]` on a 10-line forces cells 2–7). |
| `clues.test.ts` | `deriveClues` fixtures incl. empty-line → `[]`; property: for arbitrary small bitmaps, clue run-sums equal per-line filled counts, row/col counts equal size. |
| `motifs.test.ts` | **The content harness (a mechanical gate).** Every mechanical constraint of §4 over every motif and mirrored variant; class floors; per-weekday pool ≥ MIN_POOL; weekday criteria monotone Mon→Sun (size non-decreasing; within shared classes, band order matches weekday order); WEEKDAY_CRITERIA bands partition each class (no gap, no overlap). |
| `generate.test.ts` | **Central property, `numRuns: 200`:** ∀ (seed, weekday): `p = generateNonogram(seed, wd)`; `solveNonogram(p.clues)` is `"solved"` and its grid equals `p.reveal.solution` — one run proving solvable + unique + human-completable (issue's first criterion). Determinism (`numRuns: 100`): two calls, deep-equal (`toStrictEqual`). Reveal presence: `reveal.name` non-empty, `motifId` ∈ library, `solution` dims = size, `clues` deep-equal `deriveClues(reveal.solution)` (issue's second criterion). Uint32 coercion: `generateNonogram(-1, w)` equals `generateNonogram(0xffffffff, w)`. |
| `validate.test.ts` | Weekday criteria enforced (issue's third criterion), property `numRuns: 100`: every generated puzzle passes `validateNonogram` and `p.size === WEEKDAY_CRITERIA[wd].size` with effort in band. Rejection fixtures: tampered solution cell, mismatched clues, wrong-size grid, out-of-band effort (hand-built) — each yields `ok: false` with the right reason code. `NonogramGenerationError` shape (constructed directly; the generator path is unreachable with valid content). |
| (existing) `purity.test.ts` | Unchanged — automatically covers the new `src/nonogram/**` files (recursive scan). Zero RN/Node deps criterion. |

Budget: 15×15 line-solve is sub-millisecond; the heavy property (200 runs × generate+solve) plus the harness (~340 variant solves) should land the nonogram suite **< 15 s** and the whole `@miolos/games` suite **< 30 s** locally; if exceeded, reduce the central property to `numRuns: 150` — never below 100 — and note it in the PR.

## 6. Reveal data and the ADR-0004 seam

The acceptance criterion "generated puzzles carry the picture reveal data" is met by `puzzle.reveal` — deliberately a **single strippable field**: `{ clues, size, weekday, seed, game }` is the complete playable projection, and nothing outside `reveal` references motif data. What the API actually ships pre-completion is #17/M2-API territory: for a *published* day the solution is derivable from the clues anyway (line-solvable), so ADR-0004 (no *pre-publication* leak) is not violated either way, but withholding `reveal.name` until completion preserves the payoff moment — the engine makes that a one-field `omit`. State this in the PR so a reviewer doesn't flag the payload (brief risk 4).

## 7. File-by-file change list

| # | File | Change |
|---|---|---|
| 1 | `docs/plans/012-issue-24-plan-nonogram-engine.md` | This plan, committed verbatim (first commit). |
| 2 | `packages/games/src/weekday.ts` | Shared weekday substrate — **byte-identical copy** of the Binairo plan's file (#16 §2.1): ISO `Weekday = 1..7` + `WEEKDAYS`. Identical same-path content merges cleanly regardless of branch order. |
| 2b | `packages/games/src/nonogram/types.ts` | Types + `NonogramGenerationError` (§2); imports `Weekday` from `../weekday`. |
| 3 | `packages/games/src/nonogram/clues.ts` | `deriveClues`. |
| 4 | `packages/games/src/nonogram/solve.ts` | Line DP + fixpoint solver, `effortScore` (§3.2). |
| 5 | `packages/games/src/nonogram/motifs-{5,8,10,15}.ts` | Motif data per class (§4). |
| 6 | `packages/games/src/nonogram/motifs.ts` | `Motif` type + aggregated `MOTIFS`. |
| 7 | `packages/games/src/nonogram/difficulty.ts` | `WEEKDAY_CRITERIA`, `T8/T10/T15`, `MIN_POOL`, `mirrorH`, memoized `weekdayPool`. |
| 8 | `packages/games/src/nonogram/generate.ts` | `generateNonogram` (§3.3). |
| 9 | `packages/games/src/nonogram/validate.ts` | `validateNonogram`. |
| 10 | `packages/games/src/nonogram/index.ts` | Public barrel (§2). Root `src/index.ts` gains exactly one line: `export { WEEKDAYS, type Weekday } from "./weekday";` — content-identical to the line #16 adds, so it merges cleanly under either order. No game re-exports (ADR-0019). |
| 11 | `packages/games/package.json` | `exports` gains `"./nonogram": "./src/nonogram/index.ts"`. No dependency fields added (purity test asserts `{}`). |
| 12 | `packages/games/test/nonogram/{solve,clues,motifs,generate,validate}.test.ts` | §5. |
| 13 | `docs/adr/0021-nonogram-pictures-are-a-curated-motif-library.md` | Context: spec story 12 demands a recognizable hidden-picture payoff; random bitmaps fail it. Decision: AI-curated in-code motif library under written constraints + mechanical harness (ADR-0015 precedent), 4 size classes, floors/targets of §4, horizontal mirror as the only transform, per-weekday pools by measured solver effort, uniform seeded selection with replacement. Consequences: finite but non-consumable content; repeat cadence accepted and quantified; growth is additive; calibrated `T8/T10/T15` values recorded here once measured. |

All src imports relative; no new dev-dependencies; TypeScript stays 6.0.3 (ADR-0016); tsconfigs untouched.

## 8. Verification (evidence rule: paste real output, per gate)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use   # Node >= 24.15
pnpm typecheck   # green = strict tsc over src (types: []) AND test tsconfigs — purity backstop intact
pnpm lint        # green = eslint --max-warnings 0, incl. the games no-restricted-imports mirror
pnpm test        # green = full turbo suite: purity.test.ts still passing over new files,
                 # motif harness green (every motif line-solvable, pools ≥ MIN_POOL),
                 # central property 200 runs, determinism, weekday criteria
```

What each proves: `typecheck` — no `any`/ambient-Node leakage into the pure package; `lint` — import rules hold; `test` — the three issue acceptance criteria (central property = solvable+unique+deterministic... determinism is its own property; criteria mapping in §5) plus the content gate. Pre-commit (husky + lint-staged) runs on every commit; never `--no-verify`.

## 9. Branch, commits, PR

Branch `feat/24-nonogram-engine`. Conventional Commits, suggested sequence:

1. `docs: commit the nonogram engine implementation plan (#24)`
2. `feat(games): nonogram types, clue derivation and line solver` (+ solve/clues tests; includes the shared `src/weekday.ts` substrate copy and the root-barrel export line)
3. `feat(games): nonogram motif library with mechanical curation harness` (+ motifs tests; ADR-0021 in this commit)
4. `feat(games): nonogram generator, validator and weekday difficulty ramp` (+ generate/validate tests, exports hunk)

PR title (becomes the `main` commit message under squash merge, so it must itself be a Conventional Commit): `feat: Nonogram engine in packages/games (#24)`. Merge method: squash.

PR body skeleton:

```
## What changed
Nonogram engine in packages/games (#24): line solver, clue derivation, AI-curated
motif library (N motifs across 5/8/10/15 classes) with mechanical harness,
seeded generator with weekday ramp, validator. New "./nonogram" subpath export
(root barrel unchanged — ADR-0019, landing with #16). ADR-0021 records the
picture-source decision. Plan committed as docs/plans/012.

## Evidence
### pnpm typecheck
<output>
### pnpm lint
<output>
### pnpm test
<output>

## Acceptance criteria mapping
- solvable + unique + deterministic → generate.test.ts central property + determinism (output above)
- picture reveal data → reveal field + generate.test.ts reveal assertions
- weekday criteria enforced + zero RN/Node deps → validate.test.ts + motifs.test.ts + purity.test.ts

## Decisions for Fernando
None blocking. Surfaced (non-blocking): grid-size table 5/8/10/15 (§1 of the plan —
unspecified anywhere upstream, chosen here); motif floors 28/40/40/32 with the
repeat-cadence tradeoff in ADR-0021; reveal stripped-or-not pre-completion is
#17's call (§6). Weekday encoding is the settled shared ISO substrate (#16) —
nothing provisional.
```

Merge only with everything green (step 8 of the flow); steps 6–7 (parallel adversarial reviews, fixes) run before merge regardless of `/implement`'s own trailing review.

## 10. Risks and mitigations

1. **Motif recognizability is subjective.** Mitigate: conservative everyday subjects, pt-BR common nouns, the judged-constraint list in ADR-0021, and the mechanical harness for everything measurable; recognizability disputes are content edits, not code changes.
2. **Authoring throughput** — arbitrary pixel art frequently fails line-solvability; 140+ motifs must survive the harness. Mitigate: cheap per-motif diagnostics in the harness, connected/low-checkerboard drawing guidance, cull-don't-force policy; floors (not targets) are the merge gate. If floors prove unreachable in-ticket, stop and flag for orchestrator (content split) rather than shipping non-line-solvable pictures.
3. **Empty difficulty bands** (brief risk 3). Mitigate: thresholds calibrated from the real library with the `MIN_POOL` test making emptiness a hard failure at implementation time, not production time.
4. **Solver performance on 15×15 across property runs.** O(n²·m) per line with dirty-line skipping is sub-ms; budget in §5 with a stated fallback (reduce runs, floor 100).
5. **Merge overlap with #16/#22/#23** — exports map hunk in `package.json`, `src/weekday.ts`, and the root barrel line. Mitigate: additive one-line exports entry (trivial conflict); `weekday.ts` is a byte-identical copy of #16's file and the root-barrel line is content-identical to #16's, so both merge cleanly under either landing order; no game re-exports in the root barrel per ADR-0019.
6. **Purity traps** — no `vitest.config.ts`, motif data as `.ts`, relative imports only, no dependency fields; all triple-enforced by existing gates that this ticket must leave untouched.

## Flags for orchestrator

- If a stricter no-repeat-within-a-year guarantee is ever wanted for daily motifs, it needs server-side without-replacement state (the pure engine cannot rotate) — product decision, potential future ADR; not in #24.
- Hint machinery ("reveal a deducible cell") deliberately excluded; `solveNonogram` export is the seam the play-screen ticket can build on.

## Step-4 changelog

Dispositions of the step-3 review (`03-plan-review.md`) findings:

1. **BLOCKING — Weekday encoding conflicts with the settled Binairo substrate: FIXED.** Adopted the ISO 8601 shared substrate (Mon = 1 … Sun = 7): §0.3 rewritten (nothing provisional); §2 now ships a byte-identical copy of #16's `src/weekday.ts` and `types.ts` imports `Weekday` from `../weekday`; barrel re-exports `Weekday` from the substrate; `WEEKDAY_CRITERIA` re-keyed 1..7 (§1 table); §5 arbitraries changed to `fc.constantFrom(...WEEKDAYS)`; §7 gains row 2 (`weekday.ts`) and row 10 now adds the content-identical root-barrel line `export { WEEKDAYS, type Weekday } from "./weekday";`; §9 commit 2 and PR-body bullet updated; §10 risk 5 restated as byte-identical-merge mitigation.
2. **BLOCKING — Band boundary semantics internally contradictory: FIXED.** Adopted half-open intervals everywhere, per the review's recommendation: easy = `[0, T)` (score < T), hard = `[T, ∞)` (score ≥ T); threshold-valued motifs are hard-band. §1 table rewritten with `<` / `≥` and explicit intervals plus a stated convention paragraph; calibration rule restated in the same convention; `DifficultyCriteria` doc comments in §2 spell out inclusive-min/exclusive-max and reference the table.
3. **ADVISORY — Stage motif authoring: APPLIED.** §4 authoring method now mandates 5×5-first class-by-class authoring with per-class floor checkpoints and stop-and-flag at the first stalled class.
4. **ADVISORY — PR title/squash convention unstated: APPLIED.** §9 states the title `feat: Nonogram engine in packages/games (#24)` and squash merge.
5. **ADVISORY — Source-weight estimate understated: APPLIED.** §4 corrected to ~50 KB source / low-tens-KB minified (the ADR-0021 sketch in §7 row 13 inherits §4's figures by reference).
6. **ADVISORY — Garbled `motifId` doc-comment: APPLIED.** §2 comment now reads `e.g. "anchor" (pt-BR display name lives in \`name\`: "Âncora")`.

All 6 findings addressed; none dismissed.
