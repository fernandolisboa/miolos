# Plan 055 — Issue #126: split the property proof, so the per-PR gate stops paying for 300 sudoku generations

**Issue:** [#126](https://github.com/fernandolisboa/miolos/issues/126)
**Branch:** `test/126-move-heavy-properties`, off `main` `370f1e1`
**Tier:** 2 — it alters what the per-PR gate proves, so it owes a plan, an ADR amendment and a review pass. Deliberately **one** plan, **one** review pass, no six-lens round, no handoff.
**Records owed:** ADR-0059 (new), ADR-0023 amended with a reciprocal `**Amended by:**`, ADR-0055 annotated at the two places that call the sudoku sites the gate's cost centre, `docs/README.md` rows, `docs/agents/test-ids.md` frontier.

---

## 1. The cost, re-derived from genuine gate logs

Four gate runs, all `cache miss, executing` on `@miolos/games:test`. `32196991090` and
`32198441929` each show `cache hit, replaying logs` on two tasks, and they are
`7eaadf9022ab3329` = **`@miolos/ui:typecheck`** and `8d902652149d00dd` =
**`@miolos/ui:test`** — checked against the saved logs and against a local
`pnpm typecheck`, not inferred. So **the `@miolos/ui` row in §1.3 is a REPLAY in two of
the four runs**; at 1.1 s nothing in this section rests on it, and `@miolos/web` is the
critical path either way. **`@miolos/games` is genuine in all four**, which is what every
figure below depends on. Downloaded with
`gh run view <id> --log | perl -pe 's/\^\[\[[0-9;]*m//g'`.

### 1.1 `@miolos/games` per file (ms)

| file | 32091557143 | 32195070489 | 32196991090 | 32198441929 | max |
|---|---:|---:|---:|---:|---:|
| `test/sudoku/generate.test.ts` | 218 546 | 167 831 | 166 670 | 171 985 | **218 546** |
| `test/sudoku/grade.test.ts` | 12 318 | 15 541 | 16 441 | 14 982 | 16 441 |
| `test/binairo/generate.test.ts` | 5 927 | 7 707 | 7 932 | 4 371 | 7 932 |
| `test/termo/word-list.test.ts` | 626 | 1 421 | 877 | 541 | 1 421 |
| `test/binairo/validate.test.ts` | 988 | 1 067 | 698 | 645 | 1 067 |
| `test/random.test.ts` | 835 | 666 | 636 | 669 | 835 |
| every other file (22 of them) | — | — | — | — | **< 700 each** |
| package total (vitest `Duration`) | 250 910 | 209 760 | 203 880 | 202 230 | 250 910 |

`test/sudoku/generate.test.ts` is **83–87 %** of the package on every run. Nothing else
is within an order of magnitude of it. The engines the issue asked to be checked —
binairo, nonogram, termo — are together under 12 s, and `grade.test.ts` is 6–8 %.

### 1.2 Inside `test/sudoku/generate.test.ts` (ms)

| test | `numRuns` | generations/run | 32091557143 | 32195070489 | 32196991090 | 32198441929 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| `P1 — determinism` | 100 | 2 | 139 492 | 106 015 | 104 639 | 105 795 | **139 492** |
| `P2 — solvability + uniqueness` | 100 | 1 + counting solver | 56 202 | 38 305 | 39 757 | 44 648 | 56 202 |
| `P3 — weekday ramp` | 35 | 1 + grade + validate | 18 320 | 17 602 | 16 374 | 15 660 | 18 320 |
| `P3 — full-week (fixed seeds)` | — | 21 | 4 391 | 5 768 | 5 783 | 5 751 | 5 783 |
| the other 7 tests | — | — | — | — | — | — | < 1 000 total |

The three property tests are **96 %** of the file and **80–83 %** of the whole package.
300 sudoku generations, on every pull request, including a docs-only one — the gate has
no `paths` filter.

### 1.3 The finding the issue did not have: `@miolos/games` is **not** the gate's critical path

Per-package vitest `Duration`, same four runs (s):

| package | 32091557143 | 32195070489 | 32196991090 | 32198441929 |
|---|---:|---:|---:|---:|
| `@miolos/ui` | 1.08 | 1.10 | 1.10 | 1.10 |
| `@miolos/core` | 34.15 | 33.28 | 28.10 | 26.15 |
| `@miolos/db` | 90.65 | 80.23 | 75.81 | 71.58 |
| `@miolos/api` | 210.22 | 207.90 | 194.54 | 187.31 |
| `@miolos/games` | 250.91 | 209.76 | 203.88 | 202.23 |
| **`@miolos/web`** | **283.14** | **249.48** | **239.72** | **231.40** |
| `pnpm test` step (turbo `Time:`) | 4m47.2 | 4m13.0 | 4m2.5 | 3m53.8 |

Six packages run concurrently on a 2-vCPU runner, so the step's wall clock is a
**makespan**, and its last finisher is `@miolos/web`, 20–32 s *after* games. Removing
games' CPU demand therefore does **not** remove that demand's wall clock from the step:
it frees CPU share for `web` and `api`, which finish earlier, and the step falls by
something between zero and the full saving. This is stated up front so the pull request
is not read as promising a four-minutes-to-one-minute gate. **The ticket's own metric is
the `@miolos/games` duration**, which is well defined; the step figure is reported beside
it as a second, weaker reading.

---

## 2. The mechanism

### 2.1 Constraint

ADR-0017 forbids a `vitest.config.ts` in `packages/games` — importing `vitest/config`
pulls vite's `.d.ts`, which references `@types/node`, into a package whose tsconfig sets
`types: []`, silently defeating the purity typecheck. `T-WEB-S229` in
`apps/web/test/fanout-cap.test.ts` guards it. So the sample size must be **selectable
in-file**.

### 2.2 Shape

A new `packages/games/test/property-runs.ts` — a test-directory helper, the
`test/sudoku/fixtures.ts` / `test/termo/arbitraries.ts` precedent, and outside
`purity.test.ts`'s scope, which scans `src/**` only. `test/tsconfig.json` already sets
`types: ["node"]`, so `process.env` typechecks there and nowhere near `src`.

```ts
export const FULL_PROPERTIES = process.env.MIOLOS_FULL_PROPERTIES === "1";
export const PR_GATE_RUNS = 25;
export function propertyRuns(full: number): number {
  return FULL_PROPERTIES ? full : Math.min(full, PR_GATE_RUNS);
}
```

- `Math.min`, not a bare `PR_GATE_RUNS`: a property already at or below 25 — sudoku
  `grade`'s cross-check, sudoku `solve`, binairo `P3` — is left exactly as it is, and
  routing one through the helper can never *raise* its PR cost.
- Read at **module scope**, once, so the value cannot drift between tests in a file.
- Call sites keep the floor visible: `numRuns: propertyRuns(100)` with
  `// 100 nightly (ADR-0023 floor) / 25 on the PR gate` beside it. The file header states
  the split in the first paragraph, so it is impossible to read the file and think the PR
  gate runs the full proof.

### 2.3 `turbo.json`

`MIOLOS_FULL_PROPERTIES` joins `MIOLOS_TEST_DB_TIMING` on the `test` task's `env` list,
for the two reasons `T-WEB-S227` already records: turbo's strict env filtering would
otherwise drop it and the instrument would be silently inert, and declaring it puts the
flag in the task hash so **toggling it invalidates the cache** — without which a
`MIOLOS_FULL_PROPERTIES=1 pnpm test` could replay a cached *reduced* run and report a
proof that never ran.

### 2.4 Scope: the sudoku generation sites only

`P1`, `P2` and `P3 — weekday ramp` in `test/sudoku/generate.test.ts`. Not binairo
(7.9 s at its worst), not nonogram (0.6 s), not termo (1.4 s), not `grade.test.ts`
(already at 25). Introducing the split where there is no measured cost would weaken the
per-PR gate to buy seconds. **The rule the ADR states: a property takes the reduced
sample only where it is a measured cost centre; everywhere else the ADR-0023 floor keeps
binding on every pull request.**

---

## 3. Sizing the reduced sample: 25, and why not less

Measured at the file's pinned `FC_SEED = 220_022` over the exact `(seedArb, weekdayArb)`
pair the three properties use (probe: `fc.sample(fc.tuple(seedArb, weekdayArb), { seed,
numRuns })`, verified byte-identical to what `fc.assert` draws):

| `numRuns` | distinct seeds | weekdays drawn | missing |
|---:|---:|---|---|
| 10 | 10 | 2,3,4,6 | 1, 5, **7** |
| 15 | 15 | 1,2,3,4,6 | 5, **7** |
| 20 | 20 | 1,2,3,4,5,6 | **7** |
| **21** | 21 | 1…7 | — (first full coverage) |
| **25** | 25 | 1…7 | — |
| 35 | 35 | 1…7 | — |
| 100 | 91 | 1…7 | — |

Three facts do the sizing:

1. **The reduced sample is a strict PREFIX of the full sample.** fast-check draws forward
   from the pinned seed, so the 25 pairs the gate checks are the first 25 of the 100 the
   nightly checks — verified, not assumed. The PR gate is a genuine subset of the proof,
   never a different sample that happens to be smaller.
2. **The sudoku criteria table is per-weekday** — seven tiers and seven clue bands — so a
   sample that never draws a weekday cannot fail on a regression confined to it. Full
   weekday coverage arrives at exactly **21** runs; 20 misses Sunday, the hardest tier.
   That is a hard floor, and it is *measured* rather than probabilistic.
3. **25 is 21 plus margin, and it is this repo's established reduced-sample value** —
   binairo `P3`, sudoku `grade`'s cross-check and sudoku `solve` all sit at 25. Shipping
   21 would make the sample's meaningfulness hostage to `FC_SEED`: change the seed and
   the boundary moves. 25 survives that.

Sanity check against the class of defect a sample *cannot* be made to catch by
construction: a regression valid on a fraction *p* of the domain is caught with
probability 1 − (1 − p)²⁵ — **92.8 %** at p = 0.1, **99.6 %** at p = 0.2, and certain for
the whole-domain breaks §5 exercises. Below 21 that arithmetic is beside the point,
because the sample stops covering the domain's own partition.

An in-file test (`the reduced PR sample still covers every weekday`) asserts fact 1 and
fact 2 mechanically, at zero generation cost, so lowering `PR_GATE_RUNS` below 21 goes
red rather than quiet.

### 3.1 Expected cost after (linear in `numRuns`, from §1.2 maxima)

| test | before (max) | runs after | expected after |
|---|---:|---:|---:|
| `P1` | 139 492 | 100 → 25 | ≈ 34 900 |
| `P2` | 56 202 | 100 → 25 | ≈ 14 100 |
| `P3 — ramp` | 18 320 | 35 → 25 | ≈ 13 100 |
| file | 218 546 | | ≈ 68 000 |
| package | 250 910 | | ≈ 100 000 |

Linear extrapolation is a prediction, not evidence. The pull request's own gate row is
the evidence, and it is what the ticket asks for.

---

## 4. The nightly workflow

`.github/workflows/properties.yml`, on `schedule` + `workflow_dispatch`, following
`buffer-alert.yml`'s idiom for a scheduled job that matters (it opens or bumps a labelled
issue rather than trusting a red run to be noticed) and `impeccable.yml`'s
`timeout-minutes` practice.

- `cron: "20 6 * * *"` — 03:20 `America/Sao_Paulo`, off the daily publish cron's hour and
  off `buffer-alert.yml`'s 07:30 UTC.
- `MIOLOS_FULL_PROPERTIES: "1"` as a job-level `env`.
- The run: `pnpm exec turbo run test --filter=@miolos/games --force`. Through turbo, so
  the `turbo.json` env declaration is exercised rather than merely asserted; `--force` so
  no cache can replay a reduced run into a green nightly.
- `timeout-minutes: 30` — the package's worst genuine gate row is 251 s and the full
  floor is what it already runs, so 30 minutes is a hang-catcher, not a budget.
- Failure step: `if: failure()`, opens or bumps an issue labelled `property-alert`
  (created for this workflow, `buffer-alert`'s shape), carrying the run URL. `permissions:
  issues: write` for that step's `GH_TOKEN`.

**No release/tag trigger.** The issue mentions "a pre-release trigger". The repo has **no
tags and no releases** (`git tag` and `gh release list` are both empty) and nothing
resembling a release workflow — so there is no event to hang one on. Recorded as absent
rather than invented; the ADR names the trigger to add on the day a release process
exists.

**Guard.** `T-WEB-S230` joins `apps/web/test/fanout-cap.test.ts`, whose `T-WEB-S226`/`227`
already scan `ci.yml` and `turbo.json` for exactly this class of silent drift: the
workflow exists, is scheduled, sets `MIOLOS_FULL_PROPERTIES=1`, runs the games suite, and
`turbo.json` declares the variable. Without it the nightly can be deleted in a tidy-up and
the repo silently keeps only the reduced sample — which is the one failure mode that turns
this ticket into a downgrade.

---

## 5. The anti-vacuity control (the acceptance criterion that matters)

Break the generator by one character, run the **reduced** sample, show it red; restore,
show it green. Both pasted in the PR body. Two breaks, one per invariant class:

- **determinism** — perturb the seeded PRNG's advance so a second call for the same
  `(seed, weekday)` diverges: `P1` must go red.
- **validity/uniqueness** — remove one clue too many (skip a re-proof), so
  `countSudokuSolutions(givens, 2) === 1` fails: `P2` must go red.

If the reduced sample does not catch a break, 25 is too small and the number goes up
before anything else proceeds.

### 5.1 What actually happened — §5 deviations, recorded rather than rewritten

**The uniqueness break did not break anything, and that is the finding.**
`countSolutionsInternal(grid, 2) > 1` → `(grid, 1) > 1` — one character, at the exact
re-proof site — left the whole file **green** (14/14, 29.2 s). The removal loop's second
guard, `grade === "beyond" || grade > criteria.tier`, rejects the same removal
independently: the grading ladder stalls on an ambiguous grid. **Uniqueness is proved
twice by construction**, so no single-site change can break it. That is ADR-0023 layer 1
working exactly as it claims, and it is why the reduced sample loses nothing on that axis
— what the property re-checks by sampling is already established for every seed. Recorded
in ADR-0023's Consequences and in ADR-0059.

**So the two controls that ran are:**

1. **Determinism** — module-level mutable state leaked into the PRNG
   (`let drift = 0;` / `let state = (seed + drift++) >>> 0;` in
   `packages/games/src/random.ts`). Two lines rather than one character, stated as such:
   a determinism regression *is* a shared-state regression, and one character cannot
   introduce shared state. **Red at 25 runs, on fast-check run 1, in 23 ms**
   (`Property failed after 1 tests`, `Counterexample: [0,1]`); file 2 failed / 12 passed
   in 3.76 s.
2. **A tier-5, Sunday-only regression** — `SUDOKU_TIER_CRITERIA[5]`'s `minClues: 22` →
   `82`, two characters, so `sudokuCriteriaForWeekday(7)` throws and nothing else moves.
   This is the control that **sizes the sample**, which §5 as written did not have:
   - at `PR_GATE_RUNS = 25`: **red**, `Property failed after 21 tests`,
     `Counterexample: [0,7]` — run 21 is exactly where the pinned draw first yields
     weekday 7, which is §3's table read back out of a live failure;
   - at `PR_GATE_RUNS = 20`: `P1`, `P2` and `P3` all go **GREEN**. The regression is
     invisible. What goes red instead is the weekday-coverage test —
     `expected [1,2,3,4,5,6] to deeply equal [1,2,3,4,5,6,7]` — which is precisely the
     tripwire that stands between 25 and a vacuous sample.

   Stated honestly: `P3 — deterministic full-week coverage for fixed seeds` also reds at
   20, because it iterates all seven weekdays over three fixed seeds. It is a second net,
   and a coarser one — it catches a regression that fires for *every* seed on a weekday,
   never one that fires for a *fraction* of seeds on it. Covering the seed × weekday
   cross-product is what the sampled properties are for, and weekday coverage is what
   lets them.

Both breaks restored; `git diff --stat packages/games/src` empty and the file green at
14/14 in 11.02 s afterwards. Backups were taken outside the repo before each edit.

---

## 6. Records

| artifact | what |
|---|---|
| `docs/adr/0059-…` | new. What the PR gate proves, what the nightly proves, why the floor still binds where it binds, the mechanism and why it is an env var, the sizing, the release-trigger absence, and the timeout follow-up |
| `docs/adr/0023-…` | `**Amended by:** ADR-0059` header + an in-place annotation on the *"never below 100"* sentence. The floor is **narrowed in where it binds, never in whether it binds** |
| `docs/adr/0055-…` | annotations **(q)** and **(r)**, continuing (j)–(p): at the decision-4 cost-driver routing and at the honest-residual Consequence, both of which name the sudoku sites as the gate's cost centre and route to #123. #126 *is* the shape change #123 held the question for |
| `docs/README.md` | rows for plan 055 and ADR-0059 |
| `docs/agents/test-ids.md` | `T-WEB` frontier `S230` → `S231`, with the reservation paragraph `T-WEB-S229` did not get |

**Not touched:** the timeouts #109 set days ago. With `P1` at ≈ 35 s the 625 000 ms
ceiling becomes *generous* rather than *wrong*, and re-deriving it here would restart
exactly the loop this ticket exists to end. Recorded in ADR-0059 as a follow-up for a
later sweep, with the arithmetic that will do it.

## 7. Exit criteria

- `pnpm typecheck --force && pnpm lint && pnpm test --force` green, under the box lock,
  output pasted.
- Before/after `@miolos/games` durations from genuine (non-replayed) gate rows.
- The anti-vacuity red and the restored green, both pasted.
- The nightly shown green on a `workflow_dispatch` run.
- Every record in §6 in the same commit as the code that falsifies the old wording.
