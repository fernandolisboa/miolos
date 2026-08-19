# ADR-0059 — The property proof splits: a reduced sample per pull request, the ADR-0023 floor nightly

**Status:** Accepted — 2026-08-19 (issue [#126](https://github.com/fernandolisboa/miolos/issues/126), shipped in #131)
**Amends:** [ADR-0023](./0023-proved-not-sampled-property-testing.md) — decision layer 3's *"Run counts are a floor, never below 100 for the main validity and determinism properties"* is narrowed in **where** it binds, never in **whether** it binds. The reciprocal `**Amended by:**` header is on ADR-0023, and the sentence itself is annotated in place. Nothing about the invariants being proved, about the construction-level proof, or about the reserved word *"prove"* changes.
**Annotates:** [ADR-0055](./0055-test-timeouts-are-sized-against-contention.md) — annotations (q) and (r), at the two places that name the sudoku sites as the gate's cost centre and route to [#123](https://github.com/fernandolisboa/miolos/issues/123). This ADR is the shape change #123 held the question for. Its decisions are untouched, and the **four** in-file timeouts #109 adjudicated in `packages/games/test/sudoku/generate.test.ts` — `P1` and the `P3` ramp re-derived, `P2` and the full-week sibling retained — are deliberately **not** re-derived here. (Four, not five: five is ADR-0055's count of **#107's** shipped timeouts, and #109's fifth site, `T-WEB-S43`, was closed with no timeout at all.)
**Depends on:** [ADR-0017](./0017-vitest-and-fast-check-are-the-test-stack.md) (no `vitest.config.ts` in `packages/games`, which is what forces an in-file mechanism), [ADR-0057](./0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md) (the gate is the one uncapped runner, so its figures are the anchor).

## Context

Five consecutive test-infrastructure tickets — #107, #110, #114, #109 and #116 —
each moved a wall: timeout values, turbo's fan-out cap, vitest's worker bound,
timeout values again. None touched the cost that kept hitting those walls.

Measured on four genuine gate runs (`32091557143`, `32195070489`, `32196991090`,
`32198441929`, all `cache miss, executing` on `@miolos/games:test`; per-file and
per-test figures in [plan 055](../plans/055-issue-126-plan-the-property-split.md)
§1, which is their tracked home):

- `packages/games/test/sudoku/generate.test.ts` cost **167–219 s**, which is
  **83–87 %** of `@miolos/games` on every run.
- Its three property tests are **96 %** of that file: `P1` 105–139 s
  (`numRuns: 100`, two generations per run), `P2` 38–56 s (100 generations plus
  a counting-solver re-proof each), `P3` 16–18 s (35 more).
- **300 sudoku generations on every pull request**, including a pull request
  that touches only markdown: the gate has no `paths` filter.

The cost is real work, correctly specified. ADR-0023 floors the main validity and
determinism properties at `numRuns >= 100`, and that floor is right: a property
proved on 25 samples is a weaker claim than one proved on 100. What was wrong was
*where* the repository was paying for it — on the per-pull-request path, dozens of
times a day, to re-prove an engine that has been byte-identical since `e02d82a`.

Two facts shaped the mechanism rather than the decision:

- **ADR-0017 forbids a `vitest.config.ts` in `packages/games`** — importing
  `vitest/config` pulls vite's `.d.ts`, which references `@types/node`, into a
  package whose tsconfig sets `types: []`, silently defeating the purity
  typecheck that enforces the project's central architectural invariant. It is
  guarded by `T-WEB-S229`. So the sample size has to be selectable **in-file**.
- **The engines other than sudoku are not a cost centre.** Binairo's generator
  properties cost 4.4–7.9 s at their worst across the four runs, nonogram's
  0.6 s, termo's 1.4 s, and `test/sudoku/grade.test.ts` already samples 25.
  Checked before choosing, rather than assumed.

## Decision

**1. The proof splits in two, and both halves are named.**

| | run count | where |
|---|---|---|
| **the full proof** | ADR-0023's floor, unchanged (100, 100, 35) | `.github/workflows/properties.yml` — nightly `schedule` + `workflow_dispatch`, with `MIOLOS_FULL_PROPERTIES=1` |
| **the per-pull-request sample** | `PR_GATE_RUNS = 25` | the `gate` job, pre-commit, and every local `pnpm test` |

**ADR-0023's floor is not lowered. It binds on the run that carries the proof.**
A green `gate` is no longer the full proof and says so, in the test file's first
paragraph, in `packages/games/test/property-runs.ts`, and in the workflow's
header.

**2. The mechanism is one environment variable, read once at module scope.**

`packages/games/test/property-runs.ts` exports `propertyRuns(full)`, returning
`full` under `MIOLOS_FULL_PROPERTIES=1` and `Math.min(full, 25)` otherwise. The
constraints it satisfies:

- **In-file**, per ADR-0017 above — no config file in that package, and the
  guard that forbids one is left standing and re-asserted.
- **In `test/`, not `src/`**, so `process.env` never enters the purity program:
  `test/tsconfig.json` sets `types: ["node"]`, the package tsconfig sets
  `types: []` and includes `src` only, and `purity.test.ts` scans `src/**`. The
  `test/sudoku/fixtures.ts` and `test/termo/arbitraries.ts` precedent.
- **`Math.min`, not a bare constant**, so routing a property already at or below
  25 through the helper can never *raise* its per-pull-request cost.
- **`=== "1"`, not `Boolean(...)`**, so it fails closed to the cheap sample: an
  accidental `MIOLOS_FULL_PROPERTIES=0` cannot buy the expensive one, and
  neither can an unrecognised value.
- **Both numbers visible at every call site** — `numRuns: propertyRuns(100)`
  with the split spelled out beside it. It must be impossible to read the file
  and think the gate runs the full proof.
- **Declared on `turbo.json`'s `test` task `env` list**, beside
  `MIOLOS_TEST_DB_TIMING` and for that variable's own two reasons (`T-WEB-S227`):
  turbo's strict env filtering would otherwise drop it and leave the module
  silently inert, and the declaration puts the flag in the task hash — so
  toggling it invalidates the cache. Without that, a
  `MIOLOS_FULL_PROPERTIES=1 pnpm test` could replay a cached **reduced** run and
  report a proof that never executed.

**3. The reduced sample is 25, and it is sized rather than chosen.**

Measured at the file's pinned `FC_SEED = 220_022`, over the exact
`(seedArb, weekdayArb)` pair its properties quantify over. Three facts:

- **The reduced sample is a strict PREFIX of the full one.** fast-check draws
  forward from the pinned seed, so the gate checks the first 25 of the 100 pairs
  the nightly checks — never a different 25 that happens to be smaller. Verified,
  and re-asserted on every run by a test in the file.
- **The sudoku criteria table is per-weekday** — seven tiers, seven clue bands —
  so a sample that never draws a weekday cannot fail on a regression confined to
  it. Full weekday coverage arrives at exactly **21** runs; 20 never draws
  Sunday, which is the hardest tier. That floor is measured, not probabilistic,
  and the file asserts it at zero generation cost.
- **25 is 21 plus margin, and it is this repository's established reduced-sample
  value** already — binairo `P3`, sudoku `grade`'s cross-check, sudoku `solve`.
  Shipping 21 would make the sample's meaningfulness hostage to `FC_SEED`.

For the class of defect no sample can catch by construction — one valid on a
fraction *p* of the domain — 25 runs catch it with probability 1 − (1 − p)²⁵:
92.8 % at *p* = 0.1, 99.6 % at *p* = 0.2.

**Lowering `PR_GATE_RUNS` is not a performance lever.** Below 21 the weekday
coverage test goes red, by design.

**4. The split applies only at a measured cost centre.**

Today that is the three sudoku generation properties and nothing else. Binairo,
nonogram, termo and `grade.test.ts` keep running their full counts on **every**
pull request, because introducing the split where there is no measured cost
would weaken the gate to buy single-digit seconds. **A property joins the split
only with its own measured gate rows in the pull request that adds it.**

**5. The nightly fails loudly, and cannot be deleted in silence.**

`properties.yml` opens or bumps an issue labelled `property-alert` on failure —
`buffer-alert.yml`'s idiom, because a repository driven from a phone should not
depend on someone noticing a red scheduled run. **That label is repository
state, created with this ticket** (`gh label create property-alert`), and it is
recorded here because it cannot appear in a diff: `gh issue create --label`
fails outright against a label that does not exist, so a reader wondering why
the alert step works has one place to find the answer. The alert also fires on
a cancelled job — a 30-minute hang is exactly the silent failure this guards —
which `if: failure()` alone would not do. It runs through turbo with
`--force`, so the declaration in `turbo.json` is exercised rather than merely
asserted and no cache hit can replay a green.

`T-WEB-S232` in `apps/web/test/fanout-cap.test.ts` scans the workflow: it exists,
it is scheduled, it sets the flag, it runs `@miolos/games`, it alerts on failure —
plus a non-vacuity probe showing a commented-out `schedule:` cannot satisfy the
scan. Deleting the nightly is the one way this decision becomes a downgrade, and
a deleted workflow produces no red of its own.

**6. No release or tag trigger, and that is recorded rather than invented.**

The issue asked for "a scheduled workflow plus a pre-release trigger". This
repository has **no tags, no GitHub releases and no release workflow** — `git tag`
and `gh release list` are both empty. There is no event to hang one on.
`workflow_dispatch` is the manual equivalent. **The obligation this ADR leaves:
the ticket that introduces a release process adds its trigger to
`properties.yml` in the same pull request**, because the full proof before a
release is exactly the case the issue was reaching for.

## Rejected

- **Bigger runners.** Buys a constant factor with money and leaves the
  arithmetic in place.
- **Reducing `numRuns` outright.** Forbidden by ADR-0023 and rightly so. The
  distinction this ADR rests on is that the floor still binds — daily, on a run
  whose failure opens an issue — rather than not at all.
- **Another timeout adjustment.** That is the loop #126 exists to end; see the
  consequence below.
- **A `paths` filter on the gate**, so a markdown-only pull request skips the
  suite. It removes the cost for *some* pull requests and leaves it for the
  ones that matter, and a required status context that sometimes does not run
  is a ruleset problem (`protect-main` requires `gate`). Rejected as a
  narrower fix to a different question, and still available later.
- **A separate `vitest` project or a config file in `packages/games`.**
  ADR-0017, and `T-WEB-S229` would go red.
- **Splitting binairo, nonogram and termo too, for consistency.** Consistency
  is not the goal; cost is. See decision 4.

## Consequences

- **A green pull-request gate is a 25-run subset of the proof, not the proof.**
  Anyone citing a gate as evidence that an invariant holds is citing the wrong
  run. The nightly is the proof, and its red is a `property-alert` issue.
- **`packages/games` gets cheaper on every pull request**, and the gate's
  critical path moves. Worth stating precisely, because it is easy to over-claim:
  the six package suites run concurrently on a 2-vCPU runner, and the last
  finisher was **`@miolos/web`** (231–283 s), 20–32 s *after* `@miolos/games`.
  So the `pnpm test` step's wall clock is a makespan, and removing games' CPU
  demand frees share for `web` and `api` rather than subtracting its own wall
  time from the step. The measured before/after is in #126's pull request (#131).
- **The four in-file timeouts #109 adjudicated days ago are deliberately NOT re-derived here.**
  With `P1` no longer running 200 generations on the gate, the 625 000 ms
  ceiling becomes *generous* rather than *wrong*, and ADR-0055 decision 4 governs
  a shipped ceiling that fires nothing. Re-deriving a ceiling in the same change
  that moves its anchor is exactly the loop this ticket ends. **The follow-up,
  with its arithmetic:** once three genuine gate rows exist under the reduced
  sample, pool their maxima and apply ADR-0055 decision 2 — anchor × 4, rounded
  up to the next 5 000 ms — to `P1`, `P2` and the `P3` ramp together, in one
  sweep, with decision 1's 40 % trigger read first. Not before three rows; a
  single post-merge row is not a pooled maximum.
- **ADR-0055's honest residual gets narrower without being closed.** Its
  Consequences record that a slow drift inside a budget is invisible until
  someone reads a gate log; #109 sharpened that with the finding that the drift
  is environmental (`P1` moved 4.4× on a byte-identical generator as sibling CPU
  demand grew). The sudoku sites now run at a quarter of the sample, so the same
  environmental drift buys a quarter of the wall time — the residual is real,
  and it is four times less likely to cross a tripwire. Annotations (q) and (r).
- **A new heavy property is now a decision, not an accident.** Before this ADR,
  adding a generator property meant adding its full cost to every pull request
  silently. Now it means either accepting that cost with measurements, or
  joining the split with measurements. Either way the pull request has to say
  which.
- **The redundancy finding, recorded because it bounds what any sample can
  prove.** While building #126's anti-vacuity control, the obvious one-character
  uniqueness break — capping the per-removal re-proof so it can never see a
  second solution — **did not fail any test**. The grading ladder rejects a
  `beyond` grade on the same removal, so the uniqueness invariant is proved
  *twice* by construction and no single-site change can break it. That is
  ADR-0023's layer 1 working exactly as claimed, and it is the reason the
  reduced sample loses nothing on that axis: what the properties re-check by
  sampling is already established by construction, for every seed.
