/**
 * THE PROPERTY SPLIT: WHAT THE PULL-REQUEST GATE PROVES, AND WHAT THE NIGHTLY
 * PROVES (#126, ADR-0059, amending ADR-0023).
 *
 * ADR-0023 floors the main validity and determinism properties at 100
 * fast-check runs. On the 2-vCPU gate runner that floor cost
 * `test/sudoku/generate.test.ts` 167–219 s on every pull request — 83–87 % of
 * `@miolos/games`, 300 sudoku generations, including on a pull request that
 * touches only markdown, because the gate has no `paths` filter. Five
 * consecutive tickets (#107, #110, #114, #109, #116) moved a wall around that
 * cost without touching it.
 *
 * SO THE FLOOR NOW BINDS SOMEWHERE ELSE, NOT LESS. ADR-0059 narrows *where*
 * ADR-0023's floor binds, never *whether* it binds:
 *
 *   MIOLOS_FULL_PROPERTIES=1  → the ADR-0023 floor, unchanged. This is what
 *                               `.github/workflows/properties.yml` runs nightly
 *                               and on `workflow_dispatch`.
 *   unset (the PR gate, and    → PR_GATE_RUNS, the reduced sample below.
 *          every local run)
 *
 * READ THIS BEFORE YOU CITE A GREEN GATE AS A PROOF: A GREEN PULL-REQUEST GATE
 * IS NOT THE FULL PROOF. It is a 25-run subset of it. The full proof is the
 * nightly, and its red is an issue labelled `property-alert`.
 *
 * WHY AN ENVIRONMENT VARIABLE. ADR-0017 forbids a `vitest.config.ts` in
 * `packages/games` — importing `vitest/config` pulls vite's `.d.ts`, which
 * references `@types/node`, into a package whose tsconfig sets `types: []`,
 * silently defeating the purity typecheck that enforces the project's central
 * invariant (guarded by `T-WEB-S229`). So the sample size has to be selectable
 * in-file, and an env var read once at module scope is the smallest thing that
 * is. It is declared on the `test` task's `env` list in `turbo.json` beside
 * `MIOLOS_TEST_DB_TIMING`, for that variable's own two reasons: turbo's strict
 * env filtering would otherwise drop it and leave this module silently inert,
 * and declaring it puts the flag in the task hash — so toggling it invalidates
 * the cache, without which a `MIOLOS_FULL_PROPERTIES=1 pnpm test` could replay
 * a cached *reduced* run and report a proof that never executed.
 *
 * THIS FILE LIVES IN `test/`, NOT `src/`, AND THAT IS LOAD-BEARING.
 * `test/tsconfig.json` sets `types: ["node"]`; `packages/games/tsconfig.json`
 * sets `types: []` and includes `src` only. `test/purity.test.ts` scans
 * `src/**`. So `process.env` here reaches nothing the purity invariant covers —
 * the `test/sudoku/fixtures.ts` and `test/termo/arbitraries.ts` precedent.
 *
 * WHERE THE SPLIT APPLIES, AND WHERE IT DELIBERATELY DOES NOT. Only at a
 * MEASURED cost centre. Today that is the three sudoku generation properties in
 * `test/sudoku/generate.test.ts` and nothing else: binairo's generator
 * properties cost 4.4–7.9 s at their worst, nonogram's 0.6 s, termo's 1.4 s,
 * and `test/sudoku/grade.test.ts` already samples 25. Routing those through
 * this helper would weaken the per-pull-request gate to buy single-digit
 * seconds. A new property joins the split only with its own measured gate rows
 * in the pull request that adds it.
 */

/**
 * `true` only for the exact string `"1"`. Not `Boolean(process.env.X)`, which
 * an accidental `MIOLOS_FULL_PROPERTIES=0` or `=false` would satisfy — this
 * flag decides whether a proof ran, so it fails closed to the cheap sample and
 * an unrecognised value never silently buys the expensive one either way.
 */
export const FULL_PROPERTIES = process.env.MIOLOS_FULL_PROPERTIES === "1";

/**
 * The reduced per-pull-request sample. **25, and it is not "whatever is fast".**
 *
 * Measured at the sudoku file's pinned `FC_SEED = 220_022`, over the exact
 * `(seedArb, weekdayArb)` pair its three properties quantify over (plan 055 §3;
 * reproduce with `fc.sample(fc.tuple(seedArb, weekdayArb), { seed, numRuns })`,
 * which draws byte-identically to `fc.assert`):
 *
 *   numRuns   distinct seeds   weekdays drawn      missing
 *   10        10               2,3,4,6             1, 5, 7
 *   15        15               1,2,3,4,6           5, 7
 *   20        20               1,2,3,4,5,6         7
 *   21        21               1…7                 — (first full coverage)
 *   25        25               1…7                 —
 *   100       91               1…7                 —
 *
 * Three facts size it:
 *
 * 1. THE REDUCED SAMPLE IS A STRICT PREFIX OF THE FULL ONE. fast-check draws
 *    forward from the pinned seed, so the 25 pairs the gate checks are the
 *    first 25 of the 100 the nightly checks — verified, not assumed. The gate
 *    is a genuine subset of the proof, never a different sample that happens
 *    to be smaller.
 * 2. THE SUDOKU CRITERIA TABLE IS PER-WEEKDAY — seven tiers, seven clue bands —
 *    so a sample that never draws a weekday cannot fail on a regression
 *    confined to it. Full weekday coverage arrives at exactly 21 runs; 20
 *    misses Sunday, which is the hardest tier. That floor is measured, not
 *    probabilistic, and `generate.test.ts` asserts it on every run.
 * 3. 25 IS 21 PLUS MARGIN, and it is this repo's established reduced-sample
 *    value already (binairo `P3`, sudoku `grade`'s cross-check, sudoku
 *    `solve`). Shipping 21 would make the sample's meaningfulness hostage to
 *    `FC_SEED`: change the seed and the boundary moves.
 *
 * For the class of defect no sample can be made to catch by construction — one
 * valid on a fraction p of the domain — 25 runs catch it with probability
 * 1 − (1 − p)^25: 92.8 % at p = 0.1, 99.6 % at p = 0.2, and certainly for a
 * whole-domain break (the anti-vacuity control in #126's pull request (#131)
 * breaks determinism and uniqueness one character at a time and shows this
 * sample red on both). Below 21 that arithmetic is beside the point, because
 * the sample has stopped covering the domain's own partition.
 *
 * LOWERING THIS NUMBER IS NOT A PERFORMANCE LEVER. Below 21 the weekday
 * coverage test goes red, which is the design.
 */
export const PR_GATE_RUNS = 25;

/**
 * The run count for a property, given the count its full proof requires.
 *
 * `Math.min` rather than a bare `PR_GATE_RUNS`: a property already at or below
 * the reduced sample is left exactly as it is, so routing one through this
 * helper can never *raise* its per-pull-request cost, and a full count below 25
 * cannot be silently inflated by the nightly either.
 *
 * @param full the ADR-0023 (or property-specific) run count, run by the nightly
 * @returns `full` under `MIOLOS_FULL_PROPERTIES=1`, otherwise `min(full, 25)`
 */
export function propertyRuns(full: number): number {
  return FULL_PROPERTIES ? full : Math.min(full, PR_GATE_RUNS);
}
