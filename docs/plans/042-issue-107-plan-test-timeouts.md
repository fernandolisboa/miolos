# Implementation plan — Issue #107: root `pnpm test` is a coin flip

**Revision 3 (step 4, after review round 2).** Written over revision 2 after round 2's two reviewers — correctness/evidence, records/AC/gate — both returned **REJECT** with one blocker, eight majors and nine minors and nits. The consolidated findings are [`docs/plans/045-issue-107-research-review-round-2-findings.md`](./045-issue-107-research-review-round-2-findings.md), left untouched as the point-in-time record of that round; round 1's are [`044-issue-107-research-review-round-1-findings.md`](./044-issue-107-research-review-round-1-findings.md). *(Both were renumbered in this revision — see §12.5 and F7.)*

Revision 2's architecture, scope split, records section and D3–D6 all survived re-measurement. Its **headline number did not**: a third measurement session exceeded the anchor a second time, and D2 moves from 35 000 ms to **40 000 ms**. §0.1 lists every decision that moved.

**Provenance rule for this document, stated first because #34 spent three review rounds on it (handoff 041 §4).** Numbers below carry a session label and they are not interchangeable:

- **(verified)** — read in this session out of the tree, out of `node_modules`, or out of gate run [`31888933252`](https://github.com/fernandolisboa/miolos/actions/runs/31888933252)'s log. Reproducible by the command quoted beside it.
- **(round 1)**, **(round 2)**, **(round 3)** — contended or isolated wall times measured on this box by step 3's reviewers (rounds 1 and 2) or by this step-4 session (round 3), against the real tree, with this plan's edits simulated where the label says so. Rounds 1 and 2 are the **only** uncensored contended figures that exist: at unmodified HEAD a test killed at 5 000 ms reports 5 000 ms, so the population's true maximum is unobservable there (§9 step 0 cannot produce it, and revision 1's anchor was wrong for exactly that reason).
- **(step 1)** — from `107-step1-exploration.md`, an uncommitted scratchpad. Local wall times from one 8-core WSL2 box in one session. Retained where nothing better exists; **superseded by a later session's figure wherever both exist**, and never used as an anchor again.

**And the standing caveat on every contended figure, because it is what two revisions got wrong.** A contended local time is a draw from a heavy-tailed scheduling distribution. The maximum of *n* such draws is a sample statistic that grows with *n*, and this ticket has watched it grow twice across three measurement sessions: **4983 ms (n=3, censored) → 7907 ms (n=5) → 9832 ms (n=11)**. Every "worst case" below is therefore *the worst case observed so far*, not a bound. D1 and ADR-0055 decision 2 say so in those words, and the ×4 multiplier and the round-up-to-5000 exist to absorb exactly that residual.

**One correction to the issue, up front.** #107 says *"CI is not currently affected — the margin is unmeasured."* It is measured now, and it is thin. On the last green gate run, `T-LINT-1` ran at **4186 ms against the 5000 ms default — 83.7 % of budget, 814 ms of margin** (verified; §2.2). §12.6 records the obligation to say so on the issue.

---

## 0. What changed, revision by revision

Every decision that moved is listed here rather than silently rewritten. Decision numbers **do not shift**: a withdrawn decision keeps its number and says so.

### 0.1 Revision 3 (this one) — driven by round 2's findings

| Decision | Revision 2 | Revision 3 | Driver |
|---|---|---|---|
| **D1** | anchor rule + trigger + operational "contended local"; `budget / 4` written as a **pre-merge blocker** | **Unchanged in substance, three things added and one demoted.** (a) The estimator's **residual is written down**: the anchor is a sample maximum from a heavy-tailed distribution and a later session may exceed it. (b) The **population-maximum rule** is stated as a rule, not shown by example. (c) **×4 is declared retained for continuity with the shipped corpus, not derived.** (d) `budget / 4` is **demoted** from a merge blocker to the diagnose-and-record obligation ADR-0055 decision 4 already calls it. (e) The trigger's **`hookTimeout` half is declared unswept**; the sweep covers `testTimeout` only. (f) `P3`'s exemption is stated on **both** axes — it clears at **35.5 %**, not 11.6 % | C1, C2, C4, C5, F5 |
| **D2** | wall trio at **35 000 ms**, anchored on `T-LINT-S41` 7907 ms *(round 1, n=5)* | wall trio at **40 000 ms**, anchored on `T-LINT-S41` **9832 ms** *(pooled rounds 1+2, n=11)* — `9832 × 4 = 39 328 → 40 000`. `budget / 4` moves 8750 → **10 000 ms** | C1 |
| **D3** | binairo pair at 25 000 ms, anchored on `P2` 5696 ms *(round 1)* | **25 000 ms survives, re-confirmed at n=11** — the pooled maximum is `P2` **5922 ms** *(round 2)* and `5922 × 4 = 23 688 → 25 000`. Not a re-derivation: the same number falls out of a larger sample. `budget / 4` stays **6250 ms** | C1 |
| **D4** | *"only **two** of the six carry an arithmetic comment"*; the bare four *"`}, 60000);` / `}, 240_000);`"* | **Three** of six carry one (`generate.test.ts:61`, `:95`, `grade.test.ts:174`); the **three** bare ones are **all** `}, 60000)`. The argument — that the arithmetic comment is the minority practice this ticket should grow — survives at 3/6 | F3 |
| **D5** | `vi.setConfig({ testTimeout: 35_000 })` | `vi.setConfig({ testTimeout: 40_000 })`. Nothing else moves | C1 |
| **D6–D9** | amended / withdrawn as recorded in §0.2 | **unchanged** — round 2 re-verified 6/6 green with the five edits applied and 6/6 red at unmodified HEAD | — |
| **§10.3 Block C** | run from the worktree, `git checkout main && git pull` | **runs from `/home/ferna/projects/miolos`**, because `git checkout main` fails in a worktree while `main` is checked out elsewhere. AC1's sole discharge no longer fails at its first command | C3 |
| **§10.4 Block D** | before/after table with a **median elapsed** column | the elapsed column is **relabelled and not used as a comparison** — a red run is truncated by turbo's sibling termination, so its elapsed time is ~35 % shorter for reasons unrelated to the fix | C6 |
| **Censoring argument** | *"a test that dies at the wall REPORTS the wall, so **every** pre-fix figure is a lower bound"* | **Restated correctly**: a completed test's figure is exact; what is right-censored is the **sample maximum**. The reason non-killed figures in a red run are *also* biased low is **turbo's sibling termination** — measured: red runs 35–40 s, green runs 57–61 s | C6 |
| **ADR-0055** | four decisions, carrying an isolated→CI factor range and derived thresholds | **four decisions, unchanged in count.** Decision 1 narrowed to the `testTimeout` axis and its count corrected; decision 2 gains the residual and the population-maximum rule and **loses** the numeric factor range to the PR body; decision 4 states its threshold as `budget / 4` only and extends its drift trigger to `packages/games/src/binairo/**` and to `eslint` / `eslint-config-next` / `typescript-eslint` version changes | C7, F4, F5, F8, F9 |
| **Findings files** | `042-review-round-1-findings.md`, `042-review-round-2-findings.md` — reusing `042`, type `review` | renumbered to **`044-issue-107-research-review-round-1-findings.md`** and **`045-issue-107-research-review-round-2-findings.md`** — canonical type `research`, and the two free numbers **after `043`**, which is #96's (§12.5). This revision's first pass took `043`/`044` and was wrong about `043` | F7 |
| **§12.7 handoffs** | *"Handoffs 039 and 041 … three statements"*, unswept | swept: **eleven statements across eight handoffs**, plus the `034 → 036 → 038 → 039 → 041` *"all of §3 stands"* chain that keeps re-ratifying `TURBO_CONCURRENCY=1`. New obligation: **the next handoff must explicitly break that chain** | F2 |

### 0.2 Revision 2 — driven by round 1's findings *(historical, unchanged)*

| Decision | Revision 1 | Revision 2 | Driver |
|---|---|---|---|
| **D1** | trigger "40 % of the applicable default", *"`P3` is the control"*, "contended local" undefined | trigger unchanged and now **swept against the whole corpus**; the `P3`-as-control claim is **deleted**; "contended local" is given an operational definition (command, fan-out, idle box, 3 samples, take the max) | B5, MAJ-7 |
| **D2** | wall trio at **20 000 ms**, anchored on `T-LINT-1` 4983 ms *(step 1)* | wall trio at **35 000 ms**, anchored on `T-LINT-S41` **7907 ms** *(round 1)* — `7907 × 4 = 31 628 → 35 000` | MAJ-1 |
| **D3** | binairo pair at 25 000 ms, justified by *"`P1` is the more exposed on both axes"* | **25 000 ms survives unchanged**; the justification is restated as D2's — one population, unstable local ordering — because `P2` at 5696 ms *(round 1)* reverses the local axis | m7 |
| **D4** | *"these four are the only in-file timeouts in the package"* | **six**, at `sudoku/generate.test.ts:61, 95, 114, 126` and `sudoku/grade.test.ts:174, 186`; four of the six carry no arithmetic at all *(the count of six is right; "four carry none" is itself wrong — it is three, corrected in revision 3 per F3)* | m1 |
| **D5** | file-scoped `vi.setConfig`, with a live two-file leak probe as the designated falsifier | **unchanged in substance and now settled evidence, not a claim.** The probe is retired: round 1 pinned the order and the two files ran in **different PIDs**, so cross-file leakage is impossible under this repo's config | m5 |
| **D6** | *"ship **both** the timeouts and a cap. They are not alternatives."* | **Amended: ship the timeouts alone.** Round 1 measured **5/5 green genuinely uncapped** — the timeouts close the ticket by themselves. *(Round 2 independently re-ran both halves: 6/6 red at HEAD, 6/6 green with the edits. Confirmed in revision 3, §5.1.)* The cap is filed as **[#110](https://github.com/fernandolisboa/miolos/issues/110)** | MAJ-6, B1, MAJ-3, MAJ-5 |
| **D7** | `"test": "turbo run test --concurrency=2"` | **Withdrawn** → #110. It also made the cap non-overridable: the CLI flag beats `TURBO_CONCURRENCY`, and a duplicate `--concurrency` is a hard error | B1, MAJ-6 |
| **D8** | four-branch CI rollback ladder for the cap | **Withdrawn** → #110. Its measurement input was unobtainable (the PR's last gate run would have been a cache replay) and its own arithmetic predicted branch 4 | MAJ-3, MAJ-6 |
| **D9** | temporary `nproc` step in `ci.yml`, reverted before merge | **Withdrawn.** Its premise was false — `packages/games/test/sudoku/generate.test.ts:59` already records *"GitHub's 2-core runner"* — and nothing in the plan consumed the number | B4 |
| **§10.2 Block B** | `TURBO_CONCURRENCY=10 pnpm test --force`, "the direct test of the timeouts alone" | **Deleted.** With no cap shipping, Block A **is** the uncapped run. Block B as written re-ran Block A and proved nothing | B1 |
| **ADR-0055** | eight decisions | **four** decisions, plus cited constraints and consequences | MAJ-8 |
| **Residuals** | recorded only in §14 as landmine 9 | **filed as [#109](https://github.com/fernandolisboa/miolos/issues/109)** and cited in §1 and §14 | m9 |

Findings **dismissed**, with written reasons, are in §16 — two from round 1, none from round 2.

---

## 1. Scope & non-goals

### In scope

1. An explicit, arithmetic-documented test timeout on the three `apps/web` ESLint wall suites and on the two exposed `packages/games` Binairo properties. **This is the whole fix.**
2. The records this work makes false or incomplete: the napkin's timeout standard, the napkin's `TURBO_CONCURRENCY=1` workaround, the napkin's concurrency-lever clause, a new ADR, and `docs/README.md`.

### Explicitly out of scope

- **The concurrency cap — [#110](https://github.com/fernandolisboa/miolos/issues/110).** Revision 1 shipped it in the same PR. §5 explains at length why revision 2 does not. In one line: the timeouts alone are measured to close the ticket, the cap's CI effect is a predicted **+55 %** regression by the plan's own arithmetic, and the PR could not have measured it honestly.
- **The three tests already at or over the trigger this ticket ships — [#109](https://github.com/fernandolisboa/miolos/issues/109).** `sudoku/generate.test.ts`'s `P1 — determinism` (155 025 / 240 000 ms, **64.6 %**) and `P3 — weekday ramp` (24 114 / 60 000 ms, **40.2 %**), plus `apps/web/test/nonogram-screen.test.tsx:406` (**2368 ms** *(round 1)* = 47.4 % and **1959 ms** *(round 2)* = 39.2 % against the bare 5 000 ms default — a figure that **straddles** the trigger between two sessions, which is why #109's disposition is *"one CI figure decides it"* rather than a verdict). None has ever gone red; none shares §2.2's cause. Excluding them is correct — **recording them only in this plan would not be**, and that is precisely the mistake handoff 039 landmine 8 made about binairo `P2`, which is why #107 exists.
- **Restructuring the wall suites.** No `beforeAll` warm-up, no hoisting, no shared ESLint instance across files. §7 option C.
- **Reducing any `numRuns`.** ADR-0023 floors the main validity and determinism properties at 100 and `P2` sits exactly on the floor (verified: `{ numRuns: 100 }` at `packages/games/test/binairo/generate.test.ts:76` **in the unedited tree** — the line moves once this ticket's comments land, which is why exit 8's check is a `grep`, not a line number). Forbidden, not merely discouraged.
- **Any new test.** #107 adds no assertion, so it spends no test id (§11).
- **`npx impeccable detect`.** No UI file moves.
- **Making `pnpm test` fast.** Speed is not a goal here — it is #110's whole subject. The goal is that a green run means green and a red run means a defect.

---

## 2. What is actually broken

### 2.1 The topology (verified)

`turbo.json`'s test task is `{ "dependsOn": ["^build"] }`, and `^build` resolves to nothing — no workspace package has a `build` script except `apps/api` and `apps/web`, and neither is a dependency of a test task's package. Root `"test": "turbo run test"` (`package.json:13`). Turbo's default concurrency is 10, so **all six package suites start at once**, each running `vitest run` with vitest's non-watch default `maxWorkers = max(cpus - 1, 1)`.

Exactly one `vitest.config.ts` exists in the repo, `apps/web/vitest.config.ts`, and it sets `plugins`, `environment` and `setupFiles` only — no `testTimeout`, no `maxWorkers`, no `pool` (verified — `wc -l` returns **10**; n-a corrects revision 2's "11 lines"). Every other workspace, `packages/games` included, runs pure vitest defaults: `testTimeout` 5000 ms, `hookTimeout` 10000 ms.

`TURBO_CONCURRENCY` appears nowhere in `package.json`, `turbo.json`, `.github/workflows/` or `.husky/` (verified) — only in prose, as an ad-hoc workaround agents type by hand.

Two callers run the identical root command (verified): `.husky/pre-commit` (`lint-staged`, `pnpm typecheck`, `pnpm test`) and `.github/workflows/ci.yml:91` (`- run: pnpm test`). There is no third path and no divergence today — **a property this revision preserves by not shipping the cap.**

### 2.2 The margins, measured

Gate run `31888933252`, the last green one, read with `gh run view --log` (**all figures verified in this session**):

| test | CI | % of the 5000 ms default |
|---|---|---|
| `T-LINT-1` (`eslint-db-wall.test.ts`) | **4186 ms** | **83.7 %** |
| `T-LINT-S41` (`eslint-og-wall.test.ts`) | 3477 ms | 69.5 % |
| `T-LINT-S9` (`eslint-free-play-wall.test.ts`) | 2915 ms | 58.3 % |
| binairo `P1` | 3246 ms | 64.9 % |
| binairo `P2` | 2667 ms | 53.3 % |
| binairo `P3` | 581 ms | 11.6 % |

Same run, the whole `pnpm test` step (verified, quoted as printed at log lines 759–761):

```
Tasks:    6 successful, 6 total
Cached:   0 cached, 6 total
Time:     5m30.276s
```

The six per-package `Duration` lines are printed by six **separate** vitest summaries inside six `##[group]`s; the table below is **assembled** from them, not pasted from any single block (n5):

| package | files | tests | Duration |
|---|---|---|---|
| `@miolos/ui` | 1 | 3 | 1.45 s |
| `@miolos/core` | 23 | 205 | 41.61 s |
| `@miolos/db` | 8 | 97 | 105.51 s |
| `@miolos/api` | 26 | 246 | 259.29 s |
| `@miolos/games` | 28 | 187 | 287.75 s |
| `@miolos/web` | 75 | **1102** | 325.60 s |
| **sum** | 161 | 1840 | **1021.21 s** |

For contrast, the same run's other steps: `pnpm typecheck` **28.727 s**, `pnpm build` **42.566 s** (verified). The test step is the gate's cost centre by an order of magnitude, which is why #110 has to be measured rather than assumed harmless.

**Local figures.** Isolated single-file runs first — re-measured in this step-4 session with `pnpm --filter … exec vitest run --reporter=verbose <file>` (C7):

| test | *(step 1)* | *(round 2)* | **(round 3, this session)** |
|---|---|---|---|
| `T-LINT-1` | 383 ms | 458 ms | **460 ms** |
| `T-LINT-S41` | 457 ms | 518 ms | **507 ms** |
| `T-LINT-S9` | 444 ms | 516 ms | **517 ms** |
| binairo `P1` | 649 ms | 613 ms | **705 ms** |
| binairo `P2` | 620 ms | 721 ms | **619 ms** |
| binairo `P3` | 144 ms | — | **197 ms** |

*(m10, reconciled: the issue body and handoff 041 §3.1 both record **496 ms** for the og wall's first `lintText`, which is `T-LINT-S41`, not `T-LINT-1`. Round 3's 507 ms for the same test agrees with it. The **largest** isolated wall figure now measured anywhere is `T-LINT-S9`'s **517 ms**, and §3 D1's falsification is stated against that one — `517 × 4 = 2068 ms` against a measured **4186 ms** — rather than against `T-LINT-1`'s own 460 ms, which would be the convenient number.)*

*(And note what this table is evidence of in its own right: three sessions on the same box, same tree, no contention, spread ±20 % — `P2` 620 → 721 → 619 ms. Isolated figures are samples too. That is why §12.4 moves the derived factor range out of ADR-0055 and into the PR body: an ADR that ships a two-decimal ratio ships a number the next session falsifies.)*

Contended local, all three sessions side by side, with the pooled maximum that D2 and D3 actually anchor on:

| test | *(step 1)* n=3, timeouts absent, **censored** | *(round 1)* n=5, timeouts applied, uncapped | *(round 2)* n=6, timeouts applied, uncapped | **pooled max, n=11** |
|---|---|---|---|---|
| `T-LINT-S41` | 2882 ms | 7907 ms | **9832 ms** | **9832 ms** ← D2's anchor |
| `T-LINT-S9` | 2670 ms | 6680 ms | **8520 ms** | 8520 ms |
| `T-LINT-1` | 4983 ms | 2856 ms | 3537 ms | 3537 ms |
| binairo `P1` | 4896 ms | 4663 ms | 5051 ms | 5051 ms |
| binairo `P2` | 4123 ms | 5696 ms | **5922 ms** | **5922 ms** ← D3's anchor |
| binairo `P3` | not taken | not taken | 1776 ms | 1776 ms **(n=6 only)** — 35.5 %, under the trigger, D1 |

**Three things this table says, and revisions 1 and 2 each got one of them wrong.**

**(a) The step-1 column is not a smaller measurement of the same quantity — its *maximum* is right-censored (C6).** At unmodified HEAD a test killed at 5000 ms reports 5000 ms. A test that **completed** in that column was never killed, and its figure is exact: `T-LINT-S41`'s 2882 ms is 2882 ms. What is unobservable is the population's **maximum**, because every draw above 5000 ms is clipped to 5000 ms and reported as a failure. `T-LINT-1`'s 4983 ms is a draw that came within 17 ms of being clipped. Revision 1 anchored on the largest number a censored column can produce, which is the one number that column is guaranteed to under-report.

**(b) Non-killed figures in a red run are *also* biased low, and the reason is turbo, not the wall.** Landmine 1: turbo terminates sibling tasks on the first failure. In a red root run the other five packages are killed mid-flight, so whatever did report reported under **less** contention than a green run's tests meet. The elapsed times show it directly *(round 2, six runs each)*:

```
pre-fix  (6/6 red):    38  40  35  37  37  37 s
post-fix (6/6 green):  57  58  59  60  59  61 s
```

A red run is ~35 % shorter because it was truncated. This is why §10.4 does not compare the two halves' elapsed times, and why the whole step-1 column is retained only as history.

**(c) The largest figure this population has produced has grown at every sampling: 4983 ms (censored, n=3) → 7907 ms (n=5) → 9832 ms (n=11).** The first is a lower bound and the last two are directly comparable; the direction is one-way either way. That is what the max of *n* draws from a heavy-tailed distribution does, and it is not evidence that the last one is the true maximum. D2 anchors on 9832 ms and writes the residual down rather than pretending it is a bound.

Forced root runs at unmodified HEAD, three sessions: **3 red / 6** *(step 1)*, all three on `T-LINT-1`; **3 red / 4** *(round 1)*, on `T-LINT-S9` and `T-LINT-S41`; **6 red / 6** *(round 2)*, `T-LINT-S41` ×6 and `T-LINT-S9` ×4. Every failure `Error: Test timed out in 5000ms`. #34's round saw the same class fail on `T-LINT-S41`, `T-LINT-S9` ×2, `T-LINT-1` ×2 and binairo `P2` ×2 (issue #107 body). **Which test loses is a scheduling accident**; the population is the five above. Round 2 also ran the after-half: with the five edits applied, `pnpm exec turbo run test --force` ×6 was **6/6 green**, `Tasks: 6 successful`, `Cached: 0 cached` — which is what amends D6.

### 2.3 The corpus sweep against D1's trigger (B5) — **on the `testTimeout` axis only**

A new repo-wide policy obliges a sweep of what it now governs. Revision 1 shipped decision 1 without one. Here it is, over the whole gate run, reproducible:

```
gh run view 31888933252 --log \
  | perl -pe 's/\^\[\[[0-9;]*m//g' \
  | grep -E '✓ .* [0-9]+ms' | grep -vE '\([0-9]+ tests?\)'
```

**The sweep's reach has to be stated before its result (C5).** D1's trigger governs two budgets — 2000 ms against the 5000 ms `testTimeout` **and 4000 ms against the 10000 ms `hookTimeout`** — and this instrument can only see the first. **vitest prints no hook durations**, in any reporter, so no `beforeAll` in this repo has a measured cost on CI or anywhere else. Real hooks with real declared budgets exist and are invisible here: `apps/api/test/cron-publish.test.ts:139-148`, `publishing-service.test.ts:127-129` and `completions.test.ts:83-85` are all top-level `beforeAll(async () => {…}, 30_000)` booting PGlite. **So decision 1 ships swept on the `testTimeout` axis and explicitly unswept on the `hookTimeout` axis**, and §12.2 depends on that distinction rather than eliding it. Measuring the hook axis would need a custom reporter or `onTestFinished` instrumentation — worth a ticket, not worth inventing inside this one.

On the axis it does cover: **28 tests** ran at ≥ 2000 ms. The trigger is 40 % of the **applicable** budget — a test's own explicit timeout where it has one, vitest's 5000 ms default where it does not — so the raw millisecond ranking is not the hit list. Classified (every explicit timeout re-read from the tree in this session):

**Over the trigger — seven hits, all of them:**

| test | file | budget | CI | % |
|---|---|---|---|---|
| `T-LINT-1` | `apps/web/test/eslint-db-wall.test.ts` | 5 000 (default) | 4186 | **83.7 %** |
| `T-LINT-S41` | `apps/web/test/eslint-og-wall.test.ts` | 5 000 (default) | 3477 | **69.5 %** |
| binairo `P1` | `packages/games/test/binairo/generate.test.ts:24-67` | 5 000 (default) | 3246 | **64.9 %** |
| `T-LINT-S9` | `apps/web/test/eslint-free-play-wall.test.ts` | 5 000 (default) | 2915 | **58.3 %** |
| binairo `P2` | `packages/games/test/binairo/generate.test.ts:69-78` | 5 000 (default) | 2667 | **53.3 %** |
| sudoku `P1 — determinism` | `packages/games/test/sudoku/generate.test.ts:49-61` | 240 000 (explicit) | 155 025 | **64.6 %** |
| sudoku `P3 — weekday ramp` | `packages/games/test/sudoku/generate.test.ts:97-114` | 60 000 (explicit) | 24 114 | **40.2 %** |

**Five of the seven are exactly this ticket's population. The other two are #109.** The threshold does not select everything and it does not select nothing.

**Under the trigger, and this is where the sweep earns its keep** — the twenty-one others all clear it *against their own budgets*, and most of them clear it comfortably:

| test | budget | CI | % |
|---|---|---|---|
| `T-API-S3` (`cron-publish.test.ts:299-335`) | 30 000 | 11 256 | 37.5 % |
| sudoku `P2 — solvability` (`sudoku/generate.test.ts:75-95`) | 240 000 | 62 009 | 25.8 % |
| `T-API-S7` (`publishing-service.test.ts:192-213`) | 30 000 | 6 240 | 20.8 % |
| grade "solves generated puzzles… (cross-check)" (`sudoku/grade.test.ts:161-174`) | 60 000 | 10 815 | 18.0 % |
| `T-API-S21` (`cron-publish.test.ts:494-536`) | 30 000 | 4 348 | 14.5 % |
| `free-play-sudoku.test.tsx:139` "solves a pinned Leve puzzle" | 20 000 | 2 902 | 14.5 % |
| sudoku `P3 — full-week coverage` (`sudoku/generate.test.ts:116-126`) | 60 000 | 8 189 | 13.6 % |
| `T-API-S12` (`completions.test.ts:941-1017`) | 30 000 | 3 277 | 10.9 % |
| `publishing-service.test.ts:170-190` "covers a full week" | 30 000 | 2 947 | 9.8 % |
| `sudoku-screen.test.tsx:672-704` "swaps the conclusion in place" | 30 000 | 2 533 | 8.4 % |
| `packages/core/test/daily-contract.test.ts:132-155` (`SUDOKU_SWEEP_TIMEOUT_MS`, declared at `:63`) | 30 000 | 2 463 | 8.2 % |
| grade "reaches the recorded solution" (`sudoku/grade.test.ts:176-186`) | 60 000 | 4 157 | 6.9 % |
| `T-API-S107` (`completions.test.ts:2119-2223`) | 40 000 | 2 362 | 5.9 % |
| `apps/web/test/sudoku-hint.test.ts:215-216` "always reveals solveSudoku's own digit at that index" | 120 000 (`HEAVY`, declared at `:62`) | 5 543 | 4.6 % |
| the remaining seven `cron-publish.test.ts` cases (`T-API-S1`, `S2`, `S4`×3, `S15`, `S41`) | 30 000 each | 2 116 – 3 882 | ≤ 12.9 % |

**Round 1's B5 read this population against the bare 5 000 ms default and concluded eleven-plus `apps/api` tests were over the line. They are not** — every one of them carries `}, 30_000)` or `}, 40_000)`, verified line by line above. Round 1's own parenthetical said as much; the finding's headline overstated it. The correction is recorded here rather than argued: the sweep is the answer, and the answer is seven.

**One hit exists on the local axis that the CI sweep cannot see.** `apps/web/test/nonogram-screen.test.tsx:406` — *"renders one labelled rail per row and per column"* — ran at **2368 ms** under uncapped local contention *(round 1)* = 47.4 % of the bare default, and at **1959 ms** *(round 2)* = 39.2 %. `grep -c timeout` on that file returns **0** (verified). It is under 2000 ms on CI. The two local figures **straddle the trigger**, which is the honest state of it: filed as part of #109, verdict one CI figure away, and not decided here.

**Consequence for ADR-0055.** Decision 1 ships as a repo-wide rule **with a named baseline of known residuals**, all in #109, rather than as a policy nobody has checked. Fixing none of them in this PR is fine. Naming them is the point. The count, stated exactly because F8 caught revision 2 getting it wrong: **seven hits on the CI/`testTimeout` axis — five fixed here, two residual (sudoku `P1`, sudoku `P3`) — plus one further residual on the local axis (`nonogram-screen.test.tsx:406`) that this instrument cannot see. Three residuals, of which two came from the sweep and one did not.** And the `hookTimeout` axis is unswept entirely.

### 2.4 Why the wall suites cost what they cost (verified)

All three build `new ESLint({ cwd: repoRoot, overrideConfigFile: <root>/eslint.config.mjs, … })` at **module scope** — `eslint-db-wall.test.ts:25-37`, `eslint-free-play-wall.test.ts:19-31`, `eslint-og-wall.test.ts:42-54`, byte-identical option objects in all three. None of the three contains a single `beforeAll`, `beforeEach` or `afterAll` (verified by grep). Construction is therefore already shared per file. What is *not* shared is the **first `lintText`**, where ESLint lazily loads the 718-line flat config and everything `eslint-config-next/core-web-vitals` and `typescript-eslint` pull in.

The decisive shape: `T-LINT-1` makes exactly one `lintText` call and costs **460 ms** isolated *(round 3)*; `T-LINT-2`, also one call, costs 5 ms *(step 1)*. The cost is the load, it happens **inside the first `it`**, and a `testTimeout` therefore covers it — unlike collection-time work, which `apps/web/test/sudoku-hint.test.ts:72-75` already documents as the trap it is (*"a `vitest` timeout covers what runs in an `it`, not what runs during collection"*).

Three files, three forks, three independent flat-config loads, all scheduled at once against `packages/games`, `apps/api` and `packages/db` doing the same. That is the whole defect.

---

## 3. Decisions register — how a timeout is sized

### D1 — The multiplier anchors on the **highest measured figure**, CI first, contended local second. Never on an isolated run.

The napkin's Execution item 4 says (verified, quoted exactly):

> **[2026-08-01] GitHub CI runners are ~3-4x slower than the dev machine — heavy property tests near their timeout flake on main**
> Do instead: size in-file test timeouts at local wall time × 4 with margin; any test >10s locally gets an explicit timeout with the arithmetic in a comment (vitest default 5s; no vitest.config.ts in games per ADR-0017).

**As written, that rule is falsified twice by this ticket, and both halves have to move.**

**(a) The baseline is ambiguous, and the reading that looks natural is wrong.** "Local wall time" reads as the number you get running the file, which is the *isolated* number. Applied to isolated figures the rule under-shoots measured CI by a factor of 2–3:

| test | isolated *(round 3)* | isolated × 4 | measured CI (verified) | isolated→CI factor |
|---|---|---|---|---|
| `T-LINT-1` | 460 ms | 1840 ms | **4186 ms** | ×9.1 |
| `T-LINT-S41` | 507 ms | 2028 ms | 3477 ms | ×6.9 |
| `T-LINT-S9` | 517 ms | 2068 ms | 2915 ms | ×5.6 |
| binairo `P1` | 705 ms | 2820 ms | 3246 ms | ×4.6 |
| binairo `P2` | 619 ms | 2476 ms | 2667 ms | ×4.3 |

A rule whose output (1840 ms, or 2068 ms applied to the largest isolated wall figure measured anywhere) is below the observed reality (4186 ms) is not a safety margin, it is a false one. The "3-4×" in the napkin's own title is a claim about *whole-suite* slowdown, and it does not survive contact with a test whose cost is a one-time module load: `apps/web`'s suite is 325.60 s on CI (verified) against ~29 s locally *(step 1)*, ×11 — and `T-LINT-1`'s ×9.1 tracks that, not the ×4.

**The precise numbers in that last column are the least durable thing in this plan, and they are labelled accordingly (C7).** Three sessions measured the isolated half and produced three ranges: ×4.3–×10.9 *(step 1)*, ×3.7–×9.1 *(round 2)*, ×4.3–×9.1 *(round 3)* — with binairo `P2` landing *inside* the napkin's own "3-4×" claim in one of them. The qualitative finding is stable across all three and is what the rule rests on: **the walls run 5–9× their isolated cost on CI, binairo runs 4–5×, and ×4-on-isolated under-shoots every one of them.** The two-decimal range is therefore recorded in the PR body and in this plan, and **not** in ADR-0055 (§12.4, F9) — an ADR carrying a ratio that the next session re-measures differently is a record built to rot.

**(b) The trigger excludes exactly the tests that flake.** "Any test >10s locally gets an explicit timeout" would say all five of §2.2's tests need nothing at all — the worst is 649 ms isolated. Yet they are the ones going red. A trigger phrased in isolated seconds cannot see a contention problem.

**Decision.**

```
budget = 4 × max( measured CI figure , worst contended local figure )
         rounded UP to the next 5 000 ms
```

with **no isolated figure ever used as the anchor**, **one multiplier for both provenances**, and the trigger restated as:

> A test carries an explicit in-file timeout when its **contended local or measured CI** time exceeds **40 % of the applicable budget** — its own explicit timeout where it has one, vitest's default where it does not (2000 ms against the 5000 ms `testTimeout`, 4000 ms against the 10000 ms `hookTimeout`) — not when its isolated time exceeds ten seconds.

**Where several tests share one cost driver, they are one population and all take the population maximum (F5).** The anchor is not per test: if two or more tests pay the same one-time cost and their per-test ordering is unstable between measurement sessions, sizing each on its own sample pins a scheduling accident. The reversals are the evidence — `T-LINT-1` is the wall trio's worst figure in the step-1 column and its **best** in rounds 1 and 2 (4983 → 2856 → 3537 ms); binairo `P2` at 5696 ms *(round 1)* beats `P1`'s 4663 ms while `P1` is the larger on CI. So the trio takes one number and the pair takes one number, each the maximum any member has produced. **This rule produces both of this ticket's headline figures**, so it belongs in ADR-0055 decision 2 and not only here (§12.4).

**The residual in this estimator, stated plainly because two revisions have now been caught by it (C1, C2).** The anchor is the **maximum of a sample** drawn from a heavy-tailed scheduling distribution, and the maximum of a sample grows with the sample. This ticket has watched it grow twice: 4983 ms (n=3, censored) → 7907 ms (n=5) → 9832 ms (n=11). **A later session may exceed 9832 ms, and that would not falsify this rule — it is the expected behaviour of the estimator.** What absorbs it is the ×4 multiplier and the round-up to the next 5000 ms: at 40 000 ms the shipped budget sits **4.07×** over the largest figure eleven samples have produced, so the anchor would have to more than quadruple before the budget bound. The rule is *"anchor on the largest figure measured so far, then multiply"*, not *"the largest figure measured so far is the worst case"*. Revisions 1 and 2 both wrote the second thing down without noticing, and §10.1's threshold is demoted accordingly.

**How to measure "contended local", operationally (MAJ-7).** Revision 1 left this undefined, which would have let a future agent measure under whatever fan-out happened to be in force and under-size by the same class of error D1 exists to fix. The procedure is:

1. `source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm test --force` from the repo root — the **whole** suite, at turbo's default concurrency, at vitest's default `maxWorkers`. Not a `--filter`, not a single file, not `--maxWorkers=1`.
2. Nothing else running on the box. Assert it: `pgrep -f "next dev|turbo run dev|vitest"` empty, pasted.
3. **At least three runs; take the max, and pool with every earlier session's samples for the same test.** Three is the floor at which the number stops being a single lucky draw, not the point at which it becomes trustworthy — this ticket's anchor moved on both the n=5 → n=11 step and the n=3 → n=5 one. Pooling is not optional: D2's anchor is the maximum over rounds 1 **and** 2, not over the latest session alone.
4. **Prefer CI where a figure exists.** CI is reproducible and shared; one box's contended number is one box's.
5. This definition is stable only while the root fan-out is uncapped. **If [#110](https://github.com/fernandolisboa/miolos/issues/110) ever ships a cap, it owes this procedure a rewrite in the same PR** — a capped `pnpm test` produces smaller numbers, and sizing against them would under-shoot the very worlds the timeouts exist for.

**Why 40 %.** §2.3 swept the whole gate run against it, on the `testTimeout` axis. It selects **seven** tests out of the 28 that run over 2000 ms and rejects **twenty-one**, including every `apps/api` case (which run 2116–11 256 ms but against 30 000–40 000 ms budgets they already declare, the worst at 37.5 %) and both `sudoku/grade.test.ts` heavies. Five of the seven are this ticket; two are #109. That is a threshold doing work: it partitions a real corpus non-trivially, in both directions, and it disagrees with the naive millisecond ranking — `T-API-S3` at 11 256 ms is *not* a hit and `T-LINT-1` at 4186 ms is.

**And binairo `P3` clears the trigger on both axes, at 35.5 % — not at 11.6 % (C4).** Revision 2 exempted `P3` citing only its CI figure (581 ms = 11.6 %) while the trigger reads *"contended local **or** measured CI"*, and the contended-local figure was in exactly the prescribed run and never taken. It is taken now: **1776 ms max over six uncapped runs** *(round 2)* = **35.5 %** of the bare 5000 ms default. `P3` is still exempt, and it is exempt by **4.5 points, not 28**. Stating the smaller of two available numbers would have made the sweep look sharper than it is, and §2.3's credibility is the only thing decision 1 has going for it. *(Revision 1 additionally justified the threshold with "`P3` is the control that shows it is not selecting everything". That claim rested on a population of six tests, one of which was rejected, and it is deleted: a control chosen from the same six tests the rule was fitted to is not a control. The 21 rejected tests of §2.3 are the control.)*

**What the threshold has *not* been checked against: the `hookTimeout` half of its own sentence.** The trigger names 4000 ms against `hookTimeout` and no hook in this repo has a measured duration, because vitest prints none (§2.3). Decision 1 ships saying so.

**Why ×4 survives at all — and the honest defence is precedent, not derivation (C2).** Say the weak part first: **×4 is not derived.** It comes from the napkin's *"CI runners are ~3-4× slower"*, a **cross-machine** claim this ticket's own §(a) table falsifies for these five tests, and it is now being applied to an already-contended local figure, which is a different quantity again. §16 rejects a proposed ×2.5 for having no derivation; ×4 has none either, and a plan that rejected one bare constant while presenting another as measured would be doing the thing it exists to stop.

**So the defence is stated as what it actually is: ×4 is retained for continuity with the shipped corpus.** Roughly 25 in-file timeouts across this repo were sized with ×4 in their comments (§12.1 lists five by path), the napkin has carried the constant since 2026-08-01, and the alternative is to invent a second unmeasured constant so that a handful of new timeouts disagree with every old one. Continuity is a real reason; "measured" is not one, and this plan does not claim it. What *is* measured is that ×4 on the right anchor produces budgets that hold: eleven post-fix runs green across two sessions, worst figure 9832 ms against 40 000 ms.

Two things do support keeping it rather than lowering it. First, the timeouts exist for the worlds where contention is *not* removed — CI's 2-core fan-out (where vitest's own `maxWorkers` already collapses to 1), `turbo run test` typed directly, an 8-core dev box at default fan-out — so multiplying a contended anchor is not double-counting; it is buying headroom against the residual above. Second, ×4 on a contended anchor reproduces what the repo already ships: `apps/web/test/free-play-sudoku.test.tsx:135-140` (verified) sizes a 20 000 ms timeout off a ~1.5 s local test with the comment *"observed at 6-7s on starved CI runners … Local x4 plus margin over the observed CI worst case"* — 20 000 is not 1.5 s × 4, it is the observed CI worst case × ~3 rounded up hard. The shipped practice was already anchoring on the contended number; only the written rule was not. **If a future ticket derives a real multiplier from real paired data, it supersedes this by measurement, and that is the outcome to want.**

**One multiplier, not two.** Revision 1's arithmetic and its shipped number disagreed by 2.7× (MAJ-1), and one available repair was to declare the multiplier provenance-dependent — "×4 on a CI figure, ×2.5 on an uncapped local figure". **Rejected.** ×2.5 has no derivation *and* no precedent; it is the constant that makes 7907 ms come out at 20 000 ms, chosen backwards from the answer. That is the distinction between it and ×4, and it is the whole of the distinction: one bare constant has a shipped corpus behind it and the other was fitted to preserve a number the rule contradicts. D2 re-derives instead.

**Where the choice is recorded:** in the comment beside every timeout this ticket adds, as the napkin requires — each comment states its own test's measured figures, the anchor chosen, the arithmetic, and the rounding. §12 carries the napkin amendment itself.

### D2 — The wall trio shares one number, **40 000 ms**, anchored on the pooled population maximum.

```
anchor = max( T-LINT-S41 uncapped contended local  9832 ms (round 2, pooled n=11),
              T-LINT-S9  uncapped contended local  8520 ms (round 2),
              T-LINT-1   uncapped contended local  3537 ms (round 2),
              T-LINT-1   contended local           4983 ms (step 1, sample max CENSORED at 5000),
              T-LINT-1   CI                        4186 ms (verified) )   = 9832 ms
9832 × 4 = 39 328  →  40 000 ms          (budget / 4 = 10 000 ms)
```

**This is the second re-derivation, by the same mechanism, and revision 3 says so rather than presenting 40 000 as settled.** Revision 1 shipped 20 000 ms anchored on `T-LINT-1`'s **4983 ms** — a censored sample maximum taken at unmodified HEAD. Revision 2 shipped 35 000 ms anchored on `T-LINT-S41`'s **7907 ms** — an uncensored maximum over five samples. Round 2 ran six more by the same procedure and the maximum moved again, to **9832 ms** on the same test, with `T-LINT-S9` reaching **8520 ms**. Pooled over all eleven uncapped samples the anchor is 9832 ms, and D1's arithmetic gives **40 000 ms**.

**Round 2's finding is not that 35 000 was unsafe — it is that revision 2's own exit criterion rejected it.** §10.1 made `budget / 4` = 8750 ms a **pre-merge blocker**, and run 6 of round 2's six tripped it outright (9832 ms) with `T-LINT-S9` at 97.4 % of it. Over Block A's ten runs that is a near-certain trip. Two responses were available: raise the budget, or stop treating a trip-wire set at a growing sample maximum as a blocker. **This revision does both**, because each fixes half of a real problem — the number moves to match the rule (below), and §10.1's rule stops being a merge blocker and becomes the diagnose-and-record obligation ADR-0055 decision 4 already calls it.

**And the residual is carried forward explicitly, per D1.** 9832 ms is *the largest figure eleven samples have produced*, not the worst case. A twelfth session may exceed it; that is what this estimator does and it has now done it twice. 40 000 ms sits **4.07×** over it, which is the margin that absorbs the next surprise — not the claim that there will not be one. If a future session measures over 10 000 ms on a wall suite, ADR-0055 decision 4 asks for a diagnosis and a recorded figure, not an automatic re-derivation.

**Why one number for three files rather than three.** Per-file arithmetic would give 40 000 (`S41`, 9832 × 4) / 35 000 (`S9`, 8520 × 4) / 20 000 (`T-LINT-1`, 4983 × 4) — and that third figure is itself unstable, landing on 15 000 if you take `T-LINT-1`'s uncensored 3537 ms instead of its censored 4983 ms. Per-file looks more precise and it is not:

1. The three files pay the **identical** cost — one `new ESLint()` over the same 718-line root config, one first `lintText` that loads it. The option objects are byte-identical (verified, §2.4). They differ in *when they get scheduled*, not in what they do.
2. Each per-file "worst case" is the max of three to six samples from a heavy-tailed scheduling distribution — a sample, not a maximum. The three measurement sessions **reverse the ordering**: `T-LINT-1` is the trio's worst in the step-1 column and its cheapest in both rounds 1 and 2. Any per-file number would be pinning a scheduling accident.
3. #34's round already proved the population is one population: all three files failed, on different runs, in the same session (issue body).

So the honest anchor is the **highest figure any member of the population has produced**, applied to all of them — the rule D1 now states outright and §12.4 puts into ADR-0055 decision 2.

**The cost of 40 000 ms, stated plainly.** It is a large ceiling, and D5 applies it at file scope, so all 26 / 25 / 6 tests in the three files run against it — 57 tests of `apps/web`'s 1102. A genuine hang in a wall probe now reports at 40 s instead of 5 s. Three things bound that: the blast radius is *coherent* (every test in these files is an ESLint probe with the same cost profile), it stops at the file (which is the difference between this and rejected option D, §7), and the ceiling is not a target — §12.4 decision 4 and MAJ-5's procedure in §5.2 are what keep a wall suite from quietly growing into it.

Each file still carries **its own** measured numbers in its own comment, plus one sentence saying why the number is the trio's maximum. The comment is the record; the shared value is the decision.

### D3 — Binairo `P1` **and** `P2` both get a timeout, both **25 000 ms** — re-confirmed at n=11, not re-derived.

```
anchor = max( P2 contended local  5922 ms (round 2, pooled n=11),
              P2 contended local  5696 ms (round 1),
              P1 contended local  5051 ms (round 2),
              P1 contended local  4896 ms (step 1),
              P2 CI at its recorded FAILURE ≥ 5165 ms — handoff 039 item 8,
              P1 CI               3246 ms (verified),
              P2 CI               2667 ms (verified) )   = 5922 ms
5922 × 4 = 23 688  →  25 000 ms          (budget / 4 = 6 250 ms)
```

**The number does not move, and the distinction matters (C1).** D2 was re-derived because six more samples produced a larger anchor that crossed a rounding boundary. D3 was *re-confirmed*: the pooled anchor did move, 5696 → **5922 ms** *(round 2)*, but `5922 × 4 = 23 688` rounds up to the same **25 000 ms**. This is what a stable number looks like on a growing sample — the anchor rose 4 % and the budget did not move at all, because the round-up to the next 5000 ms absorbed it. 25 000 ms sits **4.22×** over the largest of eleven samples. The same residual applies as in D2: a twelfth session may exceed 5922 ms, and the budget bounds only if it more than quadruples.

**The justification, corrected in revision 2 and unchanged here (m7).** Revision 1 anchored on 5165 ms and argued that `P1` deserves a timeout because it is *"the more exposed of the two on both axes"*. The uncapped samples reverse the local axis — `P2` at 5922 ms against `P1`'s 5051 ms — and `P2` owns the pair's only recorded real CI failure. So the correct argument is D2's, not a per-test exposure ranking:

**`P1` and `P2` are one population.** Two properties over the same generator, the same arbitraries and the same seed domain, differing by 50 runs (`{ numRuns: 150 }` at `generate.test.ts:65`, `{ numRuns: 100 }` at `:76` — verified **in the unedited tree**; both lines shift when the comments land, and neither value does). Their local ordering is unstable between sessions, which is exactly what "one population, sampled twice" looks like. They get the population maximum, both of them. A fix scoped to whichever one lost today — which is how the issue came to name `P2` and not `P1` — would fail the same way in a month.

**Why the anchor is 5922 and not 5165.** Handoff 039 item 8 records `P2` timing out **at 5165 ms against the 5000 ms default** in gate run `31846743499` — a value read off a *killed* test, so the real cost that day was ≥ 5165 ms, a lower bound and not a measurement. Round 2's 5922 ms is larger and uncensored. Both point the same way; the larger, uncensored one is the anchor.

**`P3` gets nothing, and here is the number that actually decides it (C4).** 25 runs; **581 ms on CI** (verified) = 11.6 %; **1776 ms contended local**, max over six uncapped runs *(round 2)* = **35.5 %**. D1's trigger reads *"contended local **or** measured CI"*, so the governing figure is the local one, and `P3` clears by **4.5 points, not 28**. It still clears. Revision 2 cited only the 11.6 % and made the exemption look four times more comfortable than it is; saying so out loud is the point of having a trigger, and §2.3's sweep is what makes the statement mean something. If a future session pushes `P3` over 2000 ms locally, it joins the pair — and because it lives in the same file, that is one comment and one trailing argument.

**ADR-0017 compliance, restated because it is a veto.** No `vitest.config.ts` is created in `packages/games`, and none is proposed. ADR-0017's ban is reasoned, not stylistic: *"importing `vitest/config` pulls vite's `.d.ts` (which references `@types/node`) into the package's `types: []` program, silently defeating the purity typecheck backstop — discovered when the negative typecheck test unexpectedly passed"* (verified). The timeout is in-file, which is where all six of the package's existing timeouts live.

---

## 4. Decisions register — shape and placement

### D4 — `packages/games`: the trailing positional argument, matching the package's own **six** shipped timeouts.

Verified precedent inside the package, `packages/games/test/sudoku/grade.test.ts:172-174`:

```ts
    // Explicit timeout: Sundays cost ~140 ms mean (spike-measured); the pin
    // lives here because ADR-0017 forbids a vitest config.
  }, 60000);
```

**There are six in-file timeouts in the package, not four (m1):** `sudoku/generate.test.ts:61` (`240_000`), `:95` (`240_000`), `:114` (`60000`), `:126` (`60000`), and `sudoku/grade.test.ts:174` (`60000`), `:186` (`60000`). Revision 1 said four and added *"consistent with what was read here"*, which was a verification claim that was false.

**And the honest reading of that precedent cuts two ways — three of the six, not two (F3).** Re-read line by line this session:

| timeout | value | comment beside it |
|---|---|---|
| `generate.test.ts:61` | `240_000` | **yes** — `:58-60`, *"local P1 ~18s → allow 4x + margin (60s timed out twice on GitHub's 2-core runner); numRuns floor per ADR-0023"* |
| `generate.test.ts:95` | `240_000` | **yes** — `:93-94`, *"local P2 ~9s → allow 4x + the same margin as P1"* |
| `generate.test.ts:114` | `60000` | no |
| `generate.test.ts:126` | `60000` | no |
| `grade.test.ts:174` | `60000` | **yes** — `:172-173`, *"Sundays cost ~140 ms mean (spike-measured)"* |
| `grade.test.ts:186` | `60000` | no |

So the idiom describes **3 of 6**, and revision 2's *"the other four are bare `}, 60000);` / `}, 240_000);`"* was wrong twice over: there are **three** bare ones and every one of them is `}, 60000)` — no `240_000` ships without arithmetic. Revision 2 corrected round 1's count from four timeouts to six and introduced a fresh false verification claim in the same paragraph, which is the exact class of defect §12 exists to catch. The argument is unharmed: writing the arithmetic is still the minority practice at 3/6, and this ticket should grow it.

**Decision: `P1` and `P2` take the trailing positional form**, with the arithmetic comment immediately before the closing brace in exactly the `grade.test.ts:172-174` shape. Consistency within the package wins on placement; the comment is not optional here even though half of the six precedents omit it.

### D5 — The three wall files: one module-scope `vi.setConfig({ testTimeout: 40_000 })` per file.

**Verified available.** vitest **4.1.10**'s `VitestUtils.setConfig: (config: RuntimeOptions) => void` (`dist/index.d.ts:618`), and `RuntimeOptions = Partial<RuntimeConfig>` at `:229` where `RuntimeConfig = Pick<SerializedConfig, "allowOnly" | "testTimeout" | "hookTimeout" | …>` at `:224` (`dist/chunks/config.d.A1h_Y6Jt.d.ts`). `testTimeout` is a first-class member. `describe(name, options: SuiteOptions, fn)` is also available — the rejected alternative below.

*(Both paths resolve under `node_modules/.pnpm/vitest@4.1.10_…/node_modules/vitest/`, not `node_modules/vitest/` — vitest is a workspace dependency and pnpm creates no root symlink for it, so a bare `node_modules/vitest/dist/index.d.ts` is a missing file. Revision 2 cited the short form; the citation is the same file, the path was not reproducible as written.)*

**Why file scope rather than per test.**

1. **The cost is a file-level property.** One fork per file, one `new ESLint()` per file, one flat-config load per file. Expressing the budget at file scope says the true thing: *this file's tests run against a bigger budget because this file loads ESLint's flat config.*
2. **Naming a test re-creates the fragility.** Pinning 40 000 ms onto `T-LINT-1` protects `T-LINT-1`. But the load is paid by whichever test runs **first**, and the three measurement sessions disagree about which test that is. #106 is about to append `it`s to all three files; a future reorder, an `it.each`, or a `describe.concurrent` moves the payer.
3. **`eslint-db-wall.test.ts` has five top-level `describe`s** — verified at lines 84, 630, 692, 763 and 839; the other two files have one each (`eslint-free-play-wall.test.ts:62`, `eslint-og-wall.test.ts:118`). A `describe`-level option needs five edits in that file alone, seven across the trio, and a sixth `describe` added later silently drops back to 5000 ms. `vi.setConfig` has no such hole.
4. **It is one line and it sits where the explanation already lives** — directly under the `new ESLint({...})` block whose cost it is budgeting.

**Non-leakage is settled evidence, not a claim (m5).** Revision 1 called this *"the one thing that must be proved, not assumed"* and specified a live two-file probe (§9 step 2b). Round 1 ran it, and ran it correctly — which revision 1's version would not have, because vitest's default sequencer **runs previously-failed files first**, so "run both files in one command" does not pin execution order and three attempts put the untouched file first, testing the direction that does not matter. Pinned with an append-to-file order probe:

```
A load pid=49020   <- file WITH vi.setConfig({testTimeout}), runs FIRST
B load pid=49032   <- untouched file, runs SECOND
✓ zz-probe-a-setconfig.test.ts > A1 sleeps 6000ms 6007ms
× zz-probe-c-default.test.ts  > B1 sleeps 6000ms  5008ms   Error: Test timed out in 5000ms.
```

**And the structural reason is stronger than the observation:** the two files ran in **different PIDs**, because vitest's default forks pool with `isolate: true` gives every test file its own child process. `apps/web/vitest.config.ts` sets no `pool` and no `isolate` (verified — the whole file is `plugins`, `environment`, `setupFiles`). Cross-file leakage is therefore not merely unobserved under this repo's config, it is **impossible**. D5 stands, the live probe is deleted from §9, and landmine 4 retires with it.

**Rejected alternative, on the record:** `const WALL_TIMEOUT = 40_000;` + `describe(name, { timeout: WALL_TIMEOUT }, fn)` on all seven describes. It reuses two shipped shapes (`apps/web/test/sudoku-hint.test.ts:62`'s file-level named constant, and `free-play-sudoku.test.tsx:140`'s options object). It loses on points 2 and 3 above. It is **no longer a designated fallback** — the falsifier it was hedging against has been discharged — but it remains the correct shape if a future vitest release changes the isolation default.

**`vi` must be added to the vitest import** in all three files, which currently import `{ describe, expect, it }` (verified: `eslint-db-wall.test.ts:7`, `eslint-free-play-wall.test.ts:6`, `eslint-og-wall.test.ts:6`).

---

## 5. The concurrency cap: why revision 2 does not ship it

### 5.1 D6 — amended. Ship the timeouts alone.

Revision 1's D6 read: *"Ship **both** the timeouts and a cap. They are not alternatives. Neither closes the ticket alone."* **The second sentence is falsified by measurement, twice over.** Round 1 ran the plan's edits at genuinely uncapped fan-out five times — **5/5 green**, plus 6/6 capped. Round 2 re-ran the whole experiment independently: **6/6 red at unmodified HEAD** (`T-LINT-S41` ×6, `T-LINT-S9` ×4, every failure `Test timed out in 5000ms`) and, with the five edits applied, **6/6 green** at `pnpm exec turbo run test --force` with `Tasks: 6 successful` / `Cached: 0 cached`. **17 green runs across two sessions, 11 of them uncapped.** The timeouts alone close the ticket.

**D7, D8 and D9 are withdrawn.** Five independent reasons, each sufficient on its own:

1. **The plan's own arithmetic predicts the rollback (MAJ-6).** §2.2's six per-package durations sum to **1021.21 s** inside a **330 s** step. Two lanes gives a makespan lower bound of `max(1021.21/2, 325.60) ≈ 510 s` if the work is CPU-bound — **+55 %**, past D8's own ≤ +20 % keep threshold. D8 conceded *"anywhere between neutral and roughly +50 %"* and then wrote a decision rule its own numbers say will trip. Shipping a change in order to roll it back inside the same PR is not an experiment, it is two extra gate cycles.
2. **The PR could not have measured it honestly (MAJ-3).** `ci.yml:91` runs a bare `pnpm test` — **no `--force`** — after `actions/cache/restore` of `.turbo/cache` (`ci.yml:82-88`), and warmth accrues across pushes to the same PR (napkin Execution item 10). Revision 1's commits 5 and 6 touched only `docs/`, `.claude/napkin.md` and `.github/workflows/ci.yml`, none of which is inside any package's turbo hash (`turbo.json:3`, `globalDependencies` is `["tsconfig.base.json"]` only). **The last gate run — the one `protect-main` actually gates on — would have reported the test task as cached**, and a warm run compared against a `Cached: 0 cached, 6 total` baseline is biased *toward* "keep the cap". Landmine 2 stated that rule for local runs and revision 1 never applied it to the CI half.
3. **The cap as drafted was not overridable, and its own acceptance evidence tested nothing (B1).** `"test": "turbo run test --concurrency=2"` puts a CLI flag on the script, and **the CLI flag beats `TURBO_CONCURRENCY`** — reproduced independently by two reviewers: `TURBO_CONCURRENCY=10 pnpm exec turbo run dev --concurrency=2` still errors *"configured for concurrency of 2"*. So §10.2's Block B (`TURBO_CONCURRENCY=10 pnpm test --force`) ran at **2**, produced 42–44 s × 5 identical to Block A, and "proved the timeouts stand alone" having tested only the cap. Exit criterion 5 was unfalsifiable — the laundering failure mode this ticket exists to remove, reintroduced inside its own acceptance evidence. And the obvious repair is closed: a duplicate `--concurrency` is a hard error (*"cannot be used multiple times"*).
4. **The cap removes the only place the budgets are still validated (MAJ-5).** Pre-commit, CI and every developer run the same root script. Cap it and **no runner anywhere executes `pnpm test` at full fan-out**; Block B was a one-time pre-merge measurement leaving nothing standing behind it. Combined with a 4× budget, a wall suite degrading from 4 s to 15 s would emit no signal of any kind. Not shipping the cap keeps the contention the timeouts were sized against as the contention they actually meet.
5. **It is separable and the ticket does not need it.** #107's acceptance is *"`pnpm test` from the root passes 10 consecutive forced runs on `main`"*. The timeouts deliver that. The cap delivers ~15 s of local wall clock, which is worth having and is worth measuring properly — **[#110](https://github.com/fernandolisboa/miolos/issues/110)**, which carries every measured placement constraint so nothing is re-derived: the global-only `turbo.json` key, the `pnpm dev` breakage below 3, the flag-beats-env precedence, the percentage rounding to 1 on a 2-core runner, and the cold-cache requirement on any CI comparison.

**D9 separately (B4).** Its premise was false: *"Nothing in the repo records [CI's core count]"* — `packages/games/test/sudoku/generate.test.ts:58-60` says *"60s timed out twice on GitHub's 2-core runner"*, and `grep -rni "2-core\|nproc"` over the tree returns that line as its only non-plan hit. D9 was the plan's most expensive step — a temporary `ci.yml` mutation, a revert commit, an extra gate cycle, two exit criteria — and **nothing consumed the number**: D7's choice of 2 came from local timings, D8 settled the CI effect empirically. It is withdrawn on its own merits, independently of D7. If #110 wants the figure, it gets it without mutating this repo's `ci.yml`: a throwaway branch with a scratch workflow, a PR, read the run, close it unmerged.

### 5.2 Gate strength: the argument revision 1 never wrote (MAJ-5)

CLAUDE.md: *"no PR may remove or weaken [a gate]"*. Revision 1 never named that rule outside the **rejected** option D, and shipped two unargued weakenings. Both are addressed here.

**(a) Raising a test's budget is not weakening the gate — and here is why, stated rather than assumed.** The mechanical gate is `pnpm test` — full suite, green, output pasted. After this PR: all six package suites still run (`Tasks: 6 successful, 6 total`, unchanged), all 1840 tests still run, every assertion is byte-identical, and no check is removed, skipped or made conditional. What changes is the **wall clock at which five tests are killed**, from a number nobody chose (vitest's 5000 ms default) to a number derived from measurement and written down beside the test. The gate today reports **red on green code** roughly half the time; that is not strength, it is noise, and noise is what makes "re-run until green" available. Removing a false red is the opposite of weakening a check.

The one real cost is stated in D2: a genuine hang in one of those 57 tests takes 40 s to report instead of 5 s. That is a **latency** cost on failure, not a coverage or detection cost — the hang still fails the suite. Compare rejected option D (§7), which would have bought the same latency cost for 1045 *unrelated* tests to fix 57; that one **is** a weakening, and it is why option D is rejected.

**(b) "A ceiling, not a target" needs a procedure, not an exhortation.** Nothing detects growth: `T-LINT-1` can drift 4186 → 15 000 ms and stay green forever under 40 000 ms. Revision 1 wrote the exhortation twice and shipped no mechanism. This revision does not invent a new mechanical checker — CLAUDE.md's "a small improvement nobody asked for" applies, and an unasked-for gate step is exactly that — but it does hand the next agent something executable:

> **Whenever a PR touches any of the following, it re-reads §2.2's CI duration table from its own gate log and puts the five numbers in the PR body:**
>
> 1. one of the three ESLint wall suites (`apps/web/test/eslint-{db,free-play,og}-wall.test.ts`);
> 2. `eslint.config.mjs`;
> 3. `packages/games/test/binairo/generate.test.ts`;
> 4. **`packages/games/src/binairo/**`** — the binairo generator itself, where the cost the timeout budgets actually lives;
> 5. **the version of `eslint`, `eslint-config-next` or `typescript-eslint`** in the root `package.json` or `pnpm-lock.yaml`.
>
> If any of the five figures exceeds `budget / 4` — `40 000 / 4 = 10 000 ms` for the walls, `25 000 / 4 = 6 250 ms` for binairo — **that is a defect to diagnose and record, not a number to raise and not an automatic re-derivation** (D1's residual: the anchor is a sample maximum and it moves). Raising a shipped timeout requires fresh measured figures in the PR body and an updated arithmetic comment.

**Items 4 and 5 are the correction round 2 forced, and they are the load-bearing half (F4).** Revision 2's trigger named five paths, and **neither real drift source is one of them**:

- §2.4 says the wall cost is the first `lintText` loading the flat config *"and everything `eslint-config-next/core-web-vitals` and `typescript-eslint` pull in"*. A bump to **`eslint` (10.8.0, `package.json:20`), `eslint-config-next` (16.2.12, `:21`) or `typescript-eslint` (8.65.0, `:31`)** — all three verified in the root `package.json` this session — changes that cost and **touches none of `eslint.config.mjs` or the three test files**. Worse, `.github/dependabot.yml` declares exactly one `updates:` entry, `package-ecosystem: "github-actions"` (verified), so those bumps arrive as hand-written PRs — no automation, no label, and under revision 2's trigger, no obligation at all.
- Symmetrically, binairo's cost lives in `packages/games/src/binairo/`, not in its test file. A generator change that doubles the per-puzzle cost fires nothing.

A procedure that replaces a removed ceiling has to fire on what actually moves the numbers. This one now does.

**#106 is the first such occasion**, not a hypothetical: it appends `T-LINT-S47+` probes to all three wall files and edits `eslint.config.mjs`. §6.1 hands it the obligation explicitly.

The residual that remains after all of this — that a slow drift inside the budget is invisible to CI until it crosses `budget / 4` on a PR that happens to touch those files — is written into ADR-0055's consequences in those words. **What does *not* remain is revision 1's compounding version of it**, where the cap would additionally have removed full fan-out from every runner: not shipping the cap keeps the measurement surface intact, and that is one of the five reasons for §5.1.

---

## 6. The eight open questions from step 1 §11, answered

| # | Question | Decision | Where |
|---|---|---|---|
| 1 | What is the ×4 applied to? | **The highest measured figure — CI where one exists, worst contended local otherwise. Never an isolated run.** One multiplier, not two. "Contended local" now has an operational definition. The napkin's rule is falsified in both its baseline and its >10 s trigger, and is amended in the same round. | **D1**, §12.1 |
| 2 | Does `P1` get a timeout too? | **Yes** — but not because it is "more exposed": the local ordering reverses between sessions. `P1` and `P2` are one population and take the population maximum, 25 000 ms (anchor 5922 ms, re-confirmed at n=11). `P3` deliberately gets none — **35.5 % of budget on the governing local axis**, 11.6 % on CI, clear on both. | **D3** |
| 3 | Timeout, cap, or both? | **Timeouts alone. Revision 1's "both" is amended.** Rounds 1 and 2 measured 5/5 and 6/6 green genuinely uncapped, so the timeouts close the ticket by themselves; the cap's CI effect is a predicted +55 % regression this PR could not have measured honestly. Filed as **#110** with every measured constraint. | **D6**, §5 |
| 4 | Which of the three shipped shapes? | **Two answers, by package.** `packages/games`: the trailing positional `}, 25_000)` — the package's own six existing timeouts, with the arithmetic comment that three of the six carry. The wall trio: **none of the three** — module-scope `vi.setConfig`. | **D4**, **D5** |
| 5 | Suite-level or per-test? | **File-level for the walls** (`vi.setConfig`), because the cost is a file property, because `eslint-db-wall.test.ts` has **five** top-level describes so a describe option is 7 edits with a hole for the eighth, and because naming a test pins a scheduling accident. **Per-test for binairo**, because `P3` must visibly get nothing. | **D5**, **D3** |
| 6 | Merge order against #106? | **#107 first; #106 rebases onto `main` after it lands** — and inherits both the budget and §5.2's re-read obligation. | §6.1 |
| 7 | Assert CI's core count? | **No. Withdrawn (D9).** The tree already records it at `packages/games/test/sudoku/generate.test.ts:59` (*"GitHub's 2-core runner"*), and nothing in this plan consumes the number. | **D9**, §5.1 |
| 8 | Is "10 forced runs" meaningful at one concurrency? | **Moot, and better than revision 1's answer.** With no cap shipping there is only one setting, and it is the uncapped one that produced the original failures. Block A **is** the uncapped measurement; revision 1's Block B is deleted because, as specified, it silently re-ran Block A (B1). | §10 |

### 6.1 Merge order against #106 (question 6, in full)

**#107 merges first. #106 rebases onto `main` afterwards.**

The two tickets touch the same three files. The conflict surface is small and near-disjoint (verified against both issue bodies and the files):

- **#107 edits**: the `import … from "vitest"` line and a comment + one `vi.setConfig` line near the top of each wall file (`eslint-db-wall.test.ts:7` and after the block ending at `:37`; `eslint-free-play-wall.test.ts:6` / `:31`; `eslint-og-wall.test.ts:6` / `:54`).
- **#106 edits**: `eslint.config.mjs`'s pattern arrays, plus **appended** `it`s carrying new `T-LINT-S47+` ids inside the existing describes of the same three files.

A header insert and an append inside a describe do not overlap textually; git resolves both automatically in either order. **The same holds for D5's rejected `describe`-options shape** (m11): it would touch the seven `describe(` headers at `eslint-db-wall.test.ts:84, 630, 692, 763, 839`, `eslint-free-play-wall.test.ts:62` and `eslint-og-wall.test.ts:118` — header lines, still disjoint from appends inside those describes' bodies. Either shape auto-merges; the analysis does not depend on which one ships.

**The ordering preference is not about conflicts, it is about evidence.** #106's own mechanical gate is `pnpm test`. Today that command is a coin flip *(3 red / 4 at HEAD, round 1)*, so #106 cannot produce a trustworthy green without either the `TURBO_CONCURRENCY=1` workaround or re-running until green — and CLAUDE.md's evidence rule calls the second one laundering. Landing #107 first gives #106 a gate it can actually cite.

**What #106 must do:** rebase onto `main` after #107 merges, re-run its gate on the rebased tree, and — because it touches all three wall files and `eslint.config.mjs` — **discharge §5.2's re-read obligation**: put the five §2.2 tests' CI durations from its own gate run in its PR body, and treat anything over 10 000 ms (walls) or 6250 ms (binairo) as a figure to diagnose and record rather than a number to raise. It inherits the 40 000 ms budget for its new probes automatically, because D5 is file-scoped; a per-test decision would have required #106 to remember to add one. That is a second, smaller argument for D5.

**If #106 lands first anyway** (it is `ready-for-agent`, unblocked, and as of this writing has **no branch and no open PR** — verified via `git ls-remote --heads origin`): nothing in this plan changes. #107 rebases instead, the same three files, the same three inserts, and the timeout still covers #106's appended probes for the same reason.

---

## 7. Options rejected, with reasons

Recorded so the rejections are on the record rather than implied.

### Option C — hoist the shared `new ESLint()` into one `beforeAll` per file

**Rejected: it describes something already done, and the part that is not done is a worse fix.**

`new ESLint()` is already at module scope in all three files, shared across every test, and none of the three contains a single hook (verified by grep for `beforeAll|beforeEach|afterAll` — zero in all three). What *would* move cost is a warm-up `lintText` in a `beforeAll`, pushing the flat-config load out of the first `it`.

That trades a 5000 ms `testTimeout` for a 10000 ms `hookTimeout` — vitest's default. Against the pooled maximum of **9832 ms** *(round 2)* that is **1.02× headroom — 168 ms**, which is to say none: this option would have shipped a hook that goes red on the very sample that produced this plan's anchor. Revision 1 assessed it against a censored 4983 ms (2.0×), revision 2 against 7907 ms (1.26×), and each re-measurement has made it worse. **And the hook axis is the one §2.3's sweep cannot see at all**, so a hook budget here would be an undeclared 10 000 ms ceiling with no instrument watching it. Beyond the arithmetic:

1. It is still an **undeclared** budget, which is the actual defect D1 names.
2. It does **nothing** for Binairo, which is half the failing population.
3. It restructures three files that #106 is concurrently editing, turning a near-zero conflict surface into a real one.
4. It moves work into a hook, and a hook failure reports worse than a test failure.

A `beforeAll` warm-up remains a legitimate *performance* idea for a later ticket. It is not this ticket's fix.

### Option D — `testTimeout` in `apps/web/vitest.config.ts`

**Rejected on blast radius and reach — and this is the plan's most gate-protective decision.** One line, and it would cover all three wall suites at once. But:

1. **Blast radius is 75 files and 1102 tests** (both verified from `31888933252`: `Test Files 75 passed (75)`, `Tests 1102 passed (1102)` — n4: revision 1 attributed the 1102 to step 1, and it is in the CI log the plan had already read). Raising the default for every `apps/web` test means a genuine hang anywhere in the app's suite — a stuck `waitFor`, a never-resolving fetch stub, an unflushed timer — takes 40 s to report instead of 5 s, on every test, forever. The three wall suites are 57 tests of the 1102; **the other 1045 get a weakened signal for nothing.** That is the weakening CLAUDE.md's gate rule forbids, and §5.2(a) is the contrast: D5 buys the same latency cost for exactly the 57 tests that need it.
2. **It cannot reach `packages/games` at all.** Binairo is half the problem and ADR-0017 forbids the analogous fix there. A solution that only works in one of the two affected packages is a partial one that makes the remaining half easier to forget.
3. **It records nothing.** A number in a config file, away from any test, with no arithmetic and no measured figures beside it, is precisely the undeclared budget this ticket is replacing. `apps/web/vitest.config.ts` is not touched by this plan.

### Option E — CLI flags in each package's `test` script

**Rejected.** `vitest run --testTimeout=25000` in `packages/games`'s `"test"` script satisfies ADR-0017 literally — no `vitest.config.ts`, nothing imported from `vitest/config`, no `.d.ts` leak into the `types: []` program.

But it fails the napkin's actual requirement: `package.json` is JSON and **carries no comments**, so the arithmetic has nowhere to live. The number would sit naked in a script string while its justification lived in a plan that is a point-in-time snapshot. It also applies to the whole package — 28 test files, 187 tests on CI (verified) — reproducing option D's blast-radius problem one package over. The in-file precedent already shipped six times in `packages/games` (D4) is strictly better on every axis.

### Option F — `--maxWorkers` per package instead of a turbo cap

**Rejected** — and with D7 withdrawn it is rejected against #110 rather than against this PR. The napkin's Shell item 3 already uses `--maxWorkers=1` as the serialisation trick, so it is in-repo prior art. But: it needs six script edits instead of one; it puts the number in comment-free JSON (option E's defect); and it does **nothing on CI**, where vitest's own default already computes `maxWorkers = max(cpus - 1, 1) = 1` on a 2-core runner. The lever that matters is how many *packages* run at once, and that is turbo's, not vitest's. Recorded in #110.

### Option G — the status quo plus `TURBO_CONCURRENCY=1` by hand

**Rejected, and named because it is what the repo does today.** It is an env var an agent must remember to type, it does not bind pre-commit or CI, it is the *slowest* setting measured (67 s vs 56–59 s uncapped, *(step 1)*), and handoff 041 §3.1 has already had to write *"until it lands, `TURBO_CONCURRENCY=1` is not optional"* into the standing record. Removing that sentence's necessity is one of this ticket's deliverables (§12.2) — **and the timeouts alone remove it**, because what made the workaround necessary was the flake, not the fan-out.

---

## 8. Exact file list

### Created (4)

| file | content |
|---|---|
| `docs/plans/042-issue-107-plan-test-timeouts.md` | **This document.** |
| `docs/plans/044-issue-107-research-review-round-1-findings.md` | The round-1 review record. **Not edited** — a point-in-time snapshot. Renumbered from `042-review-round-1-findings.md` (F7, §12.5). |
| `docs/plans/045-issue-107-research-review-round-2-findings.md` | The round-2 review record. **Not edited.** Renumbered from `042-review-round-2-findings.md` (F7, §12.5). |
| `docs/adr/0055-test-timeouts-are-sized-against-contention.md` | ADR-0055 — four decisions; see §12.4. |

### Modified (6)

| file | change |
|---|---|
| `apps/web/test/eslint-db-wall.test.ts` | Line 7: `import { describe, expect, it, vi } from "vitest";`. After the module-scope `new ESLint({…})` block (currently ending at line 37): an arithmetic comment (its own measured figures, the trio's anchor, `9832 × 4 = 39 328 → 40 000`, the D2 reason for the shared number, a pointer to ADR-0055) followed by `vi.setConfig({ testTimeout: 40_000 });`. **No test body, no `describe`, no assertion is touched.** Own figures: 4186 ms CI (verified), 3537 ms uncapped local *(round 2)*, 4983 ms censored *(step 1)*. |
| `apps/web/test/eslint-free-play-wall.test.ts` | Same, line 6 import, insert after the block ending at line 31. Own figures: 2915 ms CI (verified), **8520 ms** uncapped local *(round 2)*. |
| `apps/web/test/eslint-og-wall.test.ts` | Same, line 6 import, insert after the block ending at line 54. Own figures: 3477 ms CI (verified), **9832 ms** uncapped local *(round 2)* — **the trio's anchor**. |
| `packages/games/test/binairo/generate.test.ts` | `P1` (closes at line 67) and `P2` (closes at line 78) each gain a trailing `}, 25_000);` in the `grade.test.ts:172-174` idiom, each preceded by a comment carrying its own measured figures, the 5922 ms anchor, `5922 × 4 = 23 688 → 25 000`, and the ADR-0017 sentence. `P3` is **not** touched, and the `P1`/`P2` comments say why (35.5 % of budget on the local axis, 11.6 % on CI, both below D1's 40 % trigger). **No `numRuns` value changes** — both `{ numRuns: 150 }` and `{ numRuns: 100 }` stay byte-identical (ADR-0023). *(No line numbers are given for them on purpose (C9): inserting four comment lines into `P1` moves `{ numRuns: 100 }` down, so any number written here would be false the moment the edit lands. The criterion that runs is `git diff … \| grep numRuns` returning empty, §9 step 1 and exit 8.)* |
| `.claude/napkin.md` | Execution item 4 rewritten; Execution item 8's `TURBO_CONCURRENCY=1` prescription corrected; Shell item 3 gains one clause. §12.1–12.3. |
| `docs/README.md` | **Four** rows appended — `plans/042-…plan…`, `plans/044-…round-1-findings`, `plans/045-…round-2-findings` and `adr/0055-…` — in the same PR as the artifacts (napkin, Parallel-Stream item 1: this was a blocking review finding in four consecutive PRs). The `<type>` list in `docs/README.md` is **not** amended; see §12.5. |

### Explicitly NOT touched

`package.json` (root) — **D7 withdrawn; `"test": "turbo run test"` is unchanged** · `.github/workflows/ci.yml` — **D9 withdrawn; no temporary step, no revert commit** · `turbo.json` · `apps/web/vitest.config.ts` (option D rejected) · `.husky/pre-commit` · `docs/agents/test-ids.md` (§11: no test added, no id spent) · `CONTEXT.md` · any `eslint.config.mjs` (that is #106) · any source file in `apps/` or `packages/*/src`.

### Deleted

None.

---

## 9. Build sequence

Every step ends with a command whose **real output is pasted** into the PR body or the step's report. "Should pass" is not a result (CLAUDE.md evidence rule; napkin Execution item 2).

All commands are run from `/home/ferna/projects/miolos-wt/107` and prefixed with:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null &&
```

**`--force` is mandatory on every root run.** Turbo replays cached logs; `Cached: 6 cached, 6 total` is evidence that inputs are unchanged, never that the checks executed (napkin Execution item 8).

**The box must be idle before any measurement block** (m6). Steps 0, 10.1 and 10.3 are contention-sensitive by construction — that is the entire subject of this ticket — and a stray dev server or a second agent invalidates them silently, producing a slower run and a wrong conclusion. Before each: `pgrep -af "next dev|turbo run dev|vitest|next-server"` must be **empty, pasted**.

**This PR's own commits trip the gate this PR is fixing, and the disposition is written here because both obvious escapes are forbidden (R2).** `.husky/pre-commit` runs `pnpm exec lint-staged && pnpm typecheck && pnpm test` (verified, §2.1) — the **full root suite, at turbo's default fan-out, with no `--force`**. §15's commit 1 lands the binairo pair **with the wall trio still unfixed**, which is to say it fires the hook against exactly the population that went **6/6 red** in round 2. Reordering commits 1 and 2 does not help; it moves the exposure to the other half of the same population. And turbo does not cache a failed task, so step 0's red runs leave `apps/web` cold and commit 1's hook re-executes it for real rather than replaying. The two moves an agent will reach for are both closed: **`--no-verify` is never available** (CLAUDE.md: pre-commit *"never bypassed with `--no-verify`"*), and "re-run until it goes green" is the laundering CLAUDE.md's evidence rule exists to forbid.

> **Disposition.** A red pre-commit on **commit 1 or commit 2** that fails on one of §2.2's five named tests with `Error: Test timed out in 5000ms` **is the known defect this PR is mid-way through fixing.** Record it in the PR body — **which test, which commit, which run** — and re-run the commit. That is not "re-running until green": the failure has a named cause, a recorded instance, and its fix in the same PR, and it is written down rather than repeated silently, which is the whole difference. **Any *other* red is a stop.** An assertion failure, a red in a package this PR does not touch, a PGlite `beforeAll` timeout (the `hookTimeout` class §12.2 explicitly does not cover), a `pnpm typecheck` or `lint-staged` failure — none of those is this defect. Do not commit through them; diagnose them.

**And the converse, which is the quieter trap.** If step 0's tenth run happens to come out green, turbo caches it, and commit 1's hook — a bare `pnpm test`, no `--force` — **replays** those logs and goes green without executing anything. `Cached: 6 cached, 6 total` out of a git hook is a gate satisfied, never a measurement (napkin Execution item 8, landmine 2). **No acceptance figure may be read out of a pre-commit run, green or red**, and a green hook is not evidence that the timeouts work. Block A is the only measurement of that, and Block A forces.

### Step 0 — the pre-fix baseline, before a single file is edited

Round 1 already measured 3 red / 4 at HEAD, and step 1 measured 3 red / 6. Neither is the before-half of this PR's before/after: the two halves must be the same shape, on the same box, in the same session, at the same run count as the AC.

```bash
git status --porcelain    # see the note below: only the three untracked docs/plans/ files
pgrep -af "next dev|turbo run dev|vitest|next-server"   # must be empty
for i in $(seq 1 10); do
  s=$SECONDS
  pnpm test --force > /tmp/107-base-$i.log 2>&1
  echo "BASE $i rc=$? elapsed=$((SECONDS-s))s"
  grep -E '^ *Failed: ' /tmp/107-base-$i.log
  grep -h 'Test timed out in' /tmp/107-base-$i.log | head -2
done
```

**What "unmodified HEAD" means here, exactly (R4).** `git status --porcelain` is **not** empty when an implement agent starts this step, and a criterion that says it must be is one the agent will either fail or quietly ignore: this plan and both findings files arrive as untracked `docs/plans/` files and are not committed until §15's commit 3. So the check is: **the output shows only the three untracked `docs/plans/04{2,4,5}-…` files — `?? docs/plans/042-issue-107-plan-test-timeouts.md`, `?? docs/plans/044-…round-1-findings.md`, `?? docs/plans/045-…round-2-findings.md` — and no tracked file is modified.** Anything else, `apps/api/next-env.d.ts` and `apps/web/next-env.d.ts` in particular (landmine 9), invalidates the baseline: step 0 must measure the tree this ticket's five edits have not yet touched. `git status --porcelain -uno` returning empty is the same statement in one command.

**The failure authority is turbo's `Failed:` line and an actual `FAIL <file> > <test>` block** — not a `grep -c 'FAIL '`, which matches each failure twice (once in the file tree, once in the "Failed Tests" section) and would have double-counted revision 1's tally (n2). Landmine 1 already names the authority; this step now uses it.

**Verification:** the tally (`N red / 10`) and the identity of every failing test, pasted. Expect roughly half red; **if all ten are green, stop and report it** — the premise of the ticket would be in question on this box today, and the CI margin in §2.2 becomes the sole justification, which changes the plan.

*Note: at 56–59 s per uncapped run this step is ~10 minutes of wall clock.*

### Step 1 — `packages/games`: the two Binairo timeouts (D3, D4)

Edit `packages/games/test/binairo/generate.test.ts` only.

```bash
pnpm --filter @miolos/games exec vitest run test/binairo/generate.test.ts
git diff --stat packages/games
git diff packages/games | grep -E '^[-+].*numRuns'    # must be EMPTY
```

**Verification:** three properties green, the diff showing **exactly two changed hunks**, and an empty `numRuns` grep (ADR-0023). Paste all three.

### Step 2 — the three wall files (D2, D5)

Edit the three `apps/web/test/eslint-*-wall.test.ts` files only.

```bash
pnpm --filter @miolos/web exec vitest run test/eslint-db-wall.test.ts test/eslint-free-play-wall.test.ts test/eslint-og-wall.test.ts
```

**Verification:** 57 tests green, pasted.

*Revision 1's step 2b — a live two-file `vi.setConfig` leak probe — is deleted. Round 1 discharged the claim with a PID-pinned probe and the structural argument (`isolate: true`, one child process per file), and revision 1's version of the probe would not have pinned execution order anyway (D5, m5). The ADR cites that evidence; no probe reaches this branch, and landmine 4 retires.*

### Step 3 — the records (§12)

ADR-0055, the napkin's three edits, `docs/README.md`'s four rows, this plan and both findings files, in one docs commit.

```bash
git diff --stat docs/ .claude/napkin.md
grep -n "TURBO_CONCURRENCY\|local wall time\|40 %\|concurrency" .claude/napkin.md
```

**Verification:** the napkin's Execution item 4 and item 8 quoted in their new form; Shell item 3's added clause quoted; the four `docs/README.md` rows shown; ADR-0055 present and numbered **0055**; both findings files present under their `044-` / `045-` names and `ls docs/plans/` showing no `042-review-*` and no `043-issue-107-*` left behind (`043` is #96's — §12.5).

### Step 4 — acceptance evidence

§10, in full.

### Step 5 — the full mechanical gate

```bash
pnpm typecheck && pnpm lint && pnpm test --force
```

**Verification:** all three outputs pasted in the PR body. `npx impeccable detect` is **not** run and the PR says why: no UI file is touched (§1).

**Before committing anything, check the two generated files** (m4): `git status --porcelain` must not list `apps/api/next-env.d.ts` or `apps/web/next-env.d.ts`. Any `pnpm dev` — including one run for an unrelated reason — rewrites both (`-import "./.next/types/routes.d.ts"` → `+import "./.next/dev/types/routes.d.ts"`). If they appear: `git checkout -- apps/api/next-env.d.ts apps/web/next-env.d.ts`.

### Step 6 — push the branch and open the pull request (R8)

Revision 3 stopped at the gate and §15 jumped from commit 3 straight to the post-merge rows, leaving the one step that turns three local commits into something Fernando can review unwritten. It is written here:

```bash
git push -u origin fix/107-test-timeouts
gh pr create --title "test: size the ESLint wall and Binairo timeouts against contention" --body-file <path-to-body>
gh pr view --json url,number    # pasted
```

**The body is the deliverable, not the branch.** CLAUDE.md: *"State what changed, what was verified with the command output inline, and any decision Fernando actually needs to make."* This PR's body carries, at minimum: §9 step 0's baseline tally, Block A's ten runs with the five per-test durations (exit 4 and 6), the typecheck/lint/test output (exit 15), the `--no-verify`-free pre-commit record including any red on commits 1–2 (exit 23), the isolated→CI factor range that ADR-0055 deliberately does not carry (§12.4), the reason `npx impeccable detect` is not run (exit 17), and the next-handoff obligation of §12.7 (exit 21). Then §10.5: the `gate` run is read once it finishes, and a cancelled one means a newer push superseded it — read the newest.

**Merging is step 8 of CLAUDE.md's flow, not this step.** The PR opens; it merges only after the step-6 reviewers are satisfied and every row of §13 is green.

---

## 10. Acceptance evidence

The AC is *"`pnpm test` from the root passes 10 consecutive forced runs **on `main`**, output pasted."* Revision 1 quoted that verbatim and then silently substituted branch runs; `main` appeared nineteen times in the document and not once in connection with the AC runs (B2). Revision 2 satisfies it literally, in two blocks, on both sides of the merge.

At 56–59 s a run *(step 1 / round 1)* each ten-run block is ~10 minutes of wall clock, which is the honest cost and is not negotiable downward.

### 10.1 Block A — 10 runs on the branch, before the PR merges

```bash
pgrep -af "next dev|turbo run dev|vitest|next-server"   # empty, pasted
for i in $(seq 1 10); do
  s=$SECONDS
  pnpm test --force > /tmp/107-after-$i.log 2>&1
  echo "AFTER $i rc=$? elapsed=$((SECONDS-s))s"
  tail -4 /tmp/107-after-$i.log
  grep -hE '✓ .*(T-LINT-1:|T-LINT-S9:|T-LINT-S41:|P1 — generated|P2 — determinism)' /tmp/107-after-$i.log
done
```

**The pattern is anchored on both axes, and the loose version of it was wrong on both (R5).** Revision 3 wrote `'✓ (T-LINT-1|T-LINT-S9|T-LINT-S41|P1 —|P2 —)'`, which over-matches twice over. `T-LINT-1` also matches **`T-LINT-10`** (`apps/web/test/eslint-db-wall.test.ts:746`, *"the table-literal bans fire at .js, .jsx and .mjs paths too"*) — a different test in the same file, silently added to the five. And `P1 —` / `P2 —` match **sudoku's** properties as well as binairo's: `packages/games/test/sudoku/generate.test.ts:49` (`P1 — determinism`), `:63` (`P1 — pinned regression`) and `:75` (`P2 — solvability`). That second one is the damaging half, because exit criterion 6 applies `budget / 4 = 6250 ms` to whatever this grep prints, and sudoku `P1` runs at **155 025 ms against its own 240 000 ms budget** (§2.3, 64.6 %, a known #109 residual) — it would read as a catastrophic breach of a threshold that does not apply to it. The corrected pattern reads the test **ids with their trailing colon**, which `T-LINT-10:` does not satisfy, and gives the binairo properties prefixes unique to their file: `P1 — generated` (`binairo/generate.test.ts:24`) and `P2 — determinism` (`:69`) — sudoku's determinism property is `P1`, not `P2`, so neither prefix collides. All five names re-read from the tree in this session. The leading `✓ .*` matches §2.3's own sweep shape: the tick is followed by the file path, not by the id.

`pnpm test --force` resolves to `turbo run test --force` — turbo's default concurrency of 10, the fan-out that produced the original failures, and the command pre-commit runs, CI runs and a developer types. **With no cap shipping, there is exactly one setting and this is it.** Revision 1's separate uncapped Block B existed only to defeat its own cap and, as specified, silently re-ran Block A at concurrency 2 (B1); it is deleted rather than repaired.

**What is pasted:** for each of the ten, the `rc`, the elapsed seconds, turbo's summary block (`Tasks: 6 successful, 6 total` / `Cached: 0 cached, 6 total` / `Time: …`), **and the five tests' individual durations**. Ten `rc=0` and ten `0 cached` lines. A single `cached` line anywhere invalidates that run — it is a log replay, not an execution (napkin Execution item 8).

**The per-test durations are a required input, not decoration (MAJ-2).** Revision 1 re-derived D1 only *"if any uncapped run goes red"*, which meant a green block at 39 % of budget would print a correct-looking answer while discarding the very measurement that showed the anchor was wrong — which is exactly what happened between step 1 and round 1, and again between round 1 and round 2. So the ten durations are pasted whatever they say. What happens next is where revision 3 differs from revision 2:

> **If any of the five exceeds `budget / 4` — 10 000 ms for the wall trio, 6250 ms for the binairo pair — the figure is diagnosed and recorded in the PR body: which test, which run, what else was on the box, and whether it is drift or a draw. It is *not* an automatic re-derivation and it does *not* block the merge.**

**Why this is no longer a pre-merge blocker (C1, C2).** Revision 2 wrote the same rule as a merge gate at 8750 ms, and round 2's sixth run tripped it outright at 9832 ms with a second test at 97.4 % of it. That is the predictable consequence of setting a trip-wire at a **sample maximum of a distribution whose sample maximum keeps climbing**: over ten runs it is a near-certain trip, and a gate that fires on the expected behaviour of its own estimator trains the next agent to route around it. ADR-0055 decision 4 already gives the correct disposition — *"a defect to investigate"*, an obligation to diagnose and record — and §10.1 now says the same thing instead of contradicting it. **What still blocks the merge is the AC: ten green runs.** A figure over `budget / 4` alongside ten green runs is a finding to write down; a figure that goes red is a red run and fails criterion 4 on its own.

At the shipped budgets the threshold has real margin again — 10 000 ms against a pooled maximum of 9832 ms is thin by design, and the honest reading is that the *next* wall figure over 10 000 ms is more likely than not, which is precisely why it records rather than blocks.

### 10.2 Block B — the branch/`main` equivalence statement

Block A runs on `fix/107-test-timeouts`. The PR body states **exactly what the diff shows and no more (C8)**: `git diff origin/main -- apps packages package.json turbo.json .github .husky` lists the four test files of §8 and nothing else, **at the moment the command ran**. That is a statement about the branch's divergence from `origin/main` at one instant — it is *not* a statement about what a later squash merge produces, because `origin/main` can move between the diff and the merge. Revision 2 wrote the stronger claim; the diff cannot carry it.

This is what makes Block A meaningful pre-merge, at the strength the evidence supports. **Block C carries the actual claim**, on real post-merge `main`, and is not substitutable.

### 10.3 Block C — 10 runs on `main`, after the merge and before the issue closes

CI cannot supply this: `ci.yml` triggers on `pull_request` only, with no `push: [main]` (verified; napkin Execution item 10 records why re-adding one is forbidden). AC1 is therefore inherently a **local** measurement that exists only if someone performs it.

**Block C runs from `/home/ferna/projects/miolos`, not from the worktree — and this is a hard constraint, not a preference (C3).** §9 says every other command in this plan runs from `/home/ferna/projects/miolos-wt/107`. Block C cannot: git refuses to check out a branch that another worktree already has, and the main clone is sitting on `main` while #107 and **#96** run in parallel worktrees.

```
$ git checkout main            # from /home/ferna/projects/miolos-wt/107
fatal: 'main' is already used by worktree at '/home/ferna/projects/miolos'
rc=128
```

Block C is the **sole** discharge of AC1, the sole fix for round-1 B2, and what exit criterion 5 and §15 row 7 make step 8 unable to skip. Under revision 2 it failed at its first command. So:

```bash
cd /home/ferna/projects/miolos                            # NOT the worktree
source ~/.nvm/nvm.sh && nvm use default >/dev/null        # §9's preamble, restated — see detail 4
git checkout main && git pull && git log --oneline -1     # the squash commit, pasted
pgrep -af "next dev|turbo run dev|vitest|next-server"     # empty, pasted — TAKEN HERE
for i in $(seq 1 10); do
  s=$SECONDS
  pnpm test --force > /tmp/107-main-$i.log 2>&1
  echo "MAIN $i rc=$? elapsed=$((SECONDS-s))s"
  tail -4 /tmp/107-main-$i.log
done
```

Four details the agent running this must not drop:

1. **The idle assertion is taken in `/home/ferna/projects/miolos`**, immediately before the loop, because that is the box these ten runs contend on. An idle check taken in the worktree half an hour earlier proves nothing about them.
2. **`git log --oneline -1` output is pasted** and must show the squash commit for this PR — that is what proves the ten runs happened on post-merge `main` rather than on a stale local `main`. `git pull` before it, not after.
3. **Do not remove or touch `/home/ferna/projects/miolos-wt/96`.** Removing the #107 worktree would also free `main`, but it destroys this branch's measurement history for no gain; running from the main clone costs nothing.
4. **The `source ~/.nvm/nvm.sh && nvm use default` preamble is restated inside the block, and that is deliberate (R7).** §9 scopes it to commands run from `/home/ferna/projects/miolos-wt/107`; Block C is the one block that `cd`s out of the worktree, and it runs in a fresh post-merge session where nothing has established a node version. `pnpm` resolving to the wrong node — or to nothing — turns ten acceptance runs into ten errors that look like a broken `main`.

**Posted as a comment on issue #107, and the issue is not closed until it is there.** §13 exit criterion 5 and §15's post-merge row make step 8 unable to skip it.

### 10.4 Block D — the before/after, honestly

One table, both halves measured in the same session on the same box. **The comparison is red/total. Elapsed time is recorded but is explicitly not a before/after comparison (C6):**

| | red / total | median elapsed *(recorded, not compared)* | source |
|---|---|---|---|
| Before, at unmodified HEAD | *(§9 step 0)* | *(truncated — see below)* | measured, not asserted |
| After, on the branch | *(block A)* | *(complete)* | |
| After, on `main` | *(block C)* | *(complete)* | |

**Why the elapsed column cannot be read as a slowdown.** Turbo terminates sibling tasks on the first failure (landmine 1), so a **red** run stops early: the other five packages are killed mid-flight and the run's wall clock is the time to the first timeout, not the time to complete the suite. Round 2 measured both halves six times each — pre-fix all red at **38 / 40 / 35 / 37 / 37 / 37 s**, post-fix all green at **57 / 58 / 59 / 60 / 59 / 61 s**. Putting those side by side as "before" and "after" would report this PR as a **~55 % slowdown**, and the fix changes no scheduling and does no extra work: the entire difference is that the red runs never finished. A red run's elapsed time is a censored measurement of a different quantity.

So the row is filled in for the record, labelled truncated, and **no conclusion is drawn from it**. The honest cost comparison is green-to-green: Block A against Block C, and §10.5's CI `Time:` against `31888933252`'s 5m30.276s.

Step 1's "3 of 6", round 1's "3 of 4" and round 2's "6 of 6" are cited as corroboration, not as the before. The before is step 0's ten runs.

### 10.5 Block E — CI

The PR's own `gate` run, with:

- the `pnpm test` step's `Time:` against `31888933252`'s **5m30.276s** (verified baseline), stated as an observation. **No decision rides on it** — D8's rollback ladder went with the cap, and the timeouts change no scheduling and no work, so the expectation is "unchanged within noise". If it moves materially, that is a finding to explain, not a threshold to apply.
- the five tests of §2.2's table with their new CI durations, checked against §10.1's `budget / 4` rule (10 000 / 6250 ms, diagnose-and-record). The timeouts make nothing faster — the expectation is that `T-LINT-1` still costs ~4 s and now has ~36 s of headroom instead of 814 ms.
- **whether the compared run is cold.** `Cached: 0 cached, 6 total` quoted, or the comparison is labelled as a replay and not used (MAJ-3, extended to CI as landmine 2 now requires).

**A cancelled `gate` is not a failure** — it means a newer push superseded it; read the newest run (napkin Execution item 10).

---

## 11. Test ids

**#107 spends none, and that is a decision, not an oversight.**

The ticket adds no assertion. Every edit is a timeout, an import or a comment. `docs/agents/test-ids.md`'s format applies to *named tests*, and no test is named here.

- **Do not allocate `T-LINT-S47`, `S48` or `S49`.** `T-LINT-S47` is the live frontier (verified: `docs/agents/test-ids.md:42`, `T-LINT` next free `S47`, last spent `S46`) and **#106 has claimed it explicitly**. Pre-reserving a range for #107 and then not spending it would burn ids for nothing and collide with a parallel ticket.
- **`packages/games` carries no ids at all** — `docs/agents/test-ids.md`: *"**`packages/games` carries no ids** — verified by grep, and new suites there keep it that way."* The Binairo edit adds none and removes none.
- **`docs/agents/test-ids.md` is not modified by this PR.** Nothing in its frontier table, spent lists or burn table changes.

No temporary probe reaches this branch (§9 step 2), so none needs an id either.

---

## 12. Records

Every item below was checked against the real file in this session. Handoff 041 §4's lesson — *"any statement written before the last commit is a statement that can rot"* — applies to this plan's own §14 and to the ticket's own additions, not only to the standing corpus. §12.9 runs the two-way check.

**Citation audit, revision 3.** Revision 2 claimed all 58 `file:line` citations were re-derived and round 2 still found four stale (`vitest.config.ts` line count, `sudoku-hint.test.ts`, the post-edit `numRuns` lines, `daily-contract.test.ts`'s path and package). Every citation in this document has now been re-extracted mechanically and re-read line by line against the tree at `eea445e`. **Three corrections landed and one finding was itself corrected:**

- `apps/web/vitest.config.ts` is **10** lines, not 11 (n-a).
- `daily-contract.test.ts` is **`packages/core/test/`**, not `apps/api`, and the `it(` opens at **`:132`**, not `:133` (C10).
- The two `numRuns` line numbers are removed from §8 and labelled *"in the unedited tree"* everywhere else, because this ticket's own comments move them (C9).
- **n-b is off by one in the other direction.** Round 2 reported `sudoku-hint.test.ts`'s `it(` at `:214` and the name at `:215`; the tree has a blank line at `:214`, `it(` at **`:215`** and the name at **`:216`**. The citation is now `:215-216`. Recorded because "the reviewer's correction was also wrong" is exactly the kind of thing that survives into revision 4 if nobody re-reads.

Exit criterion 22 requires the same audit at merge time rather than trusting this one.

### 12.1 `.claude/napkin.md`, Execution & Validation item 4 — **rewritten. The prime falsified record.**

Current text (verified verbatim, and it is item **4**, not item 3 — the napkin was re-curated on 2026-08-15 and item 3 is now the source-scan/comment-stripper entry):

> 4. **[2026-08-01] GitHub CI runners are ~3-4x slower than the dev machine — heavy property tests near their timeout flake on main**
>    Do instead: size in-file test timeouts at local wall time × 4 with margin; any test >10s locally gets an explicit timeout with the arithmetic in a comment (vitest default 5s; no vitest.config.ts in games per ADR-0017).

**Falsified in two places, both measured** (D1): the ×4 baseline (isolated → CI is ×4.3 to ×9.1 for these five tests *(round 3)*, so ×4 on the largest isolated wall figure measured anywhere produces 2068 ms against a real 4186 ms), and the >10 s trigger (which excludes all five tests that actually flake, the worst of them 705 ms isolated).

**Replacement, to be written in the napkin's own house style** (date + "Do instead", one item, still item 4). **Length discipline first (F11):** the napkin's own item 4 is two lines and its longest item is one paragraph; a ~200-word replacement would be the runbook turning into the ADR, which is the exact inversion §12.4 argues against. **Two clauses must survive at any length the curator chooses:**

1. **The anchor is never an isolated run** — it is the highest measured contended-or-CI figure.
2. **A pre-fix figure's *maximum* is censored** — a run in which anything timed out cannot tell you the worst case, so apply a provisional budget, measure, then derive.

Everything else below is compressible into ADR-0055 by reference. Draft:

> 4. **[2026-08-15] A vitest timeout sized off an ISOLATED local run under-shoots CI by 4–9× — and the ">10s locally" trigger excludes every test that actually flakes**
>    Do instead: anchor on the highest **measured** figure — CI where one exists, worst **contended** local otherwise, **never a single-file run** — then ×4, rounded up to the next 5 s, arithmetic in a comment beside the test. "Contended" = whole suite, `pnpm test --force`, turbo's default fan-out, idle box, ≥3 runs, take the max, pooled with earlier sessions. Trigger: over **40 %** of the applicable budget (2 s of `testTimeout` 5 s; 4 s of `hookTimeout` 10 s). **Never size from a run in which anything timed out** — a killed test reports the wall, so the *sample maximum* of that run is censored and turbo's sibling-kill biases the rest of it low too; #107's anchor moved 4983 → 7907 → 9832 ms across three sessions for exactly this reason. Where a whole file shares one cost driver, budget the **file** (`vi.setConfig`), not whichever test runs first. Ceiling, not target: over `budget / 4`, diagnose and record — never raise the number. No `vitest.config.ts` in games (ADR-0017); never buy time with `numRuns` (ADR-0023). Full record: ADR-0055; residuals: #109.

**Shipped timeouts sized under the old rule (MAJ-4).** ~25 in-file timeouts across the repo were sized by the rule this item declares falsified, and several say so in their own comments — `apps/api/test/account-delete.test.ts:37-41` (`}, 30_000`, *"PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower"*, and the same shape across ~20 `apps/api` files), `packages/games/test/sudoku/generate.test.ts:58-61` (`240_000`), `apps/web/test/sudoku-hint.test.ts:62` (`HEAVY = 120_000`), `apps/web/test/free-play-sudoku.test.tsx:135-140` (`20_000`, the very precedent D1 cites approvingly), `apps/web/test/sudoku-screen.test.tsx:701-704` (`30_000`). **A runbook item rewritten without a position on its own output is the record that rots, so here is the position, and it is a measured one rather than a sentence:**

> Shipped timeouts are **not** re-derived en masse. The old rule's defect was that it under-shot, and a budget that is too large is governed by the ceiling rule, not by the sizing rule. §2.3 swept the 28 tests over 2000 ms against the new trigger on a real gate run: of the tests that already **declare** a timeout, **exactly two are over 40 % of their own budget** — `sudoku/generate.test.ts`'s `P1` and `P3` — and both are filed as **#109**. Every other declared timeout is measured, named and comfortably clear, the worst at 37.5 % (`T-API-S3`). They stand as written; the next one that goes red, or that crosses `budget / 4`, is diagnosed and recorded under D1 before anyone touches the number.
>
> **Two limits on that clearance, stated so it is not read as more than it is:** the sweep sees only the `testTimeout` axis (vitest prints no hook durations), so ~20 `apps/api` `beforeAll(…, 30_000)` PGlite hooks are **unswept**; and it sees only CI, so a shipped timeout that is fine on CI and marginal under local contention would not appear — which is how `nonogram-screen.test.tsx:406` was found by hand rather than by the sweep.

*(Written above as intent; the implement agent writes the final wording and keeps the ten-item cap. If adding this pushes the category over ten, the curation rules apply — re-prioritise, do not silently drop.)*

### 12.2 `.claude/napkin.md`, Execution & Validation item 8 — corrected in place

Its first half is still true and stays: turbo caches gate runs, a cached re-run is a log replay, `--force` is required for evidence, `.turbo/cache` is not shared across machines.

**Its headline names a flake class this ticket does not touch, and revision 2 tried to have that both ways (C5).** Item 8 reads, verbatim:

> 8. **[2026-08-14] Pre-commit's full suite flakes under turbo's parallel fan-out (PGlite `beforeAll` timeouts, non-deterministic) — and turbo caches gate runs, so a cached re-run is a log replay, not evidence**
>    Do instead: prefix every commit with `TURBO_CONCURRENCY=1 git commit …` (all ten of #29's commits needed it); re-run gates for PR-body evidence with `--force`. …

Revision 2 correctly said *"do not claim this ticket fixed the PGlite hook class"* and then, in the same section, deleted the `TURBO_CONCURRENCY=1` prescription because *"after this PR it does not [flake], at any concurrency"*. Both cannot stand: the second sentence is a claim about the whole item, including the class the first sentence disclaims. What is actually established is narrower, and the correction has to be written at that width.

**What this ticket establishes, exactly:**

- The **`testTimeout` population is fixed and measured** — the five tests of §2.2, sized under D1, **17 forced root runs green across two sessions — 11 of them at full uncapped fan-out** (5/5 round 1, 6/6 round 2) plus 6/6 capped in round 1, against 3 red / 6, 3 red / 4 and 6 red / 6 at unmodified HEAD.
- The **PGlite `beforeAll` class is untouched and unmeasured.** It is a `hookTimeout` failure, no hook in this repo has a measured duration (§2.3), and ~20 `apps/api` files declare `beforeAll(…, 30_000)` that this PR does not change by a byte.
- **The removal of the `TURBO_CONCURRENCY=1` prescription rests on the first bullet only.** It is a claim about observed root-run outcomes across 17 uncapped runs — including every `apps/api` suite, hooks and all — not a claim that the hook class was diagnosed. It is an empirical clearance, and it is stated as one.

**Correction, then:** drop the workaround sentence; keep the cache-replay half intact; **keep the PGlite `beforeAll` clause in the headline** and re-word it as an open, unmeasured class rather than as the reason for a prescription that no longer exists; and add that **a red root `pnpm test` is a finding again**.

**And say which failure classes "a finding again" covers**, because an unqualified version of that sentence would re-create the laundering it removes:

- **Covered — treat as a real finding, diagnose before re-running:** any `Test timed out in Nms` in the five §2.2 tests (they now have derived budgets); any assertion failure anywhere; any red in a package this PR did not touch.
- **Not covered — still diagnose, but this ticket makes no promise:** a PGlite `beforeAll` timeout (unmeasured, `hookTimeout`), and turbo's `[ELIFECYCLE]` sibling-termination noise, which is not a test failure at all (landmine 1).

That last clause matters as much as the deletion: handoff 041 §3.1 currently instructs the whole project that *"a single red root run is not a finding"*, and that instruction becomes actively harmful once the `testTimeout` half is fixed — see §12.7, which is why the next handoff owes an explicit correction rather than another *"§3 stands"*.

For the record on cost: `TURBO_CONCURRENCY=1` is also the *slowest* setting measured *(step 1: 67 s vs 56–59 s uncapped)*, so it was buying wall clock even when it worked. And revision 1's justification for deleting it — "pre-commit picks the cap up automatically" — died with D7; nothing in this correction depends on anything shipping in `package.json`.

### 12.3 `.claude/napkin.md`, Shell & Command Reliability item 3 — one clause added

*"vitest 4 has no `--concurrency` flag"* is **true and stays** — it is about vitest, and vitest's serialisation lever is `--maxWorkers`. But it reads, in a repo that fans out through turbo, as if no concurrency lever exists at all. Add one clause carrying the three measured facts, all of which cost a reviewer real time in round 1:

> turbo has both `--concurrency` and `TURBO_CONCURRENCY`, and **the CLI flag beats the env var** — `TURBO_CONCURRENCY=10 turbo run … --concurrency=2` runs at **2**, silently, so a measurement that thinks it is overriding a script's flag is measuring the flag. Passing `--concurrency` twice is a hard error (*"cannot be used multiple times"*), so a flag on a script is **not** overridable; an env var on the script is. `turbo.json`'s top-level `concurrency` is **global** (no per-task form exists in `turbo/schema.json`) and any value below 3 breaks `pnpm dev` outright — *"You have 2 persistent tasks but turbo is configured for concurrency of 2"*. The repo ships **no** cap today; #110 owns that question.

*(This clause is why revision 1's Block B proved nothing, and it belongs in the runbook whether or not #110 ever ships. The precedence statement is the load-bearing half.)*

### 12.4 ADR-0055 — needed, and **four** decisions

CLAUDE.md: *"New technical decision of any weight → propose an ADR before implementing, even a short one."* One of this ticket's outputs clears that bar comfortably: **a repo-wide timeout-sizing policy.** D1 replaces the standard the napkin has carried since 2026-08-01, for every package, for every future test. The napkin is a *runbook* — curated, capped at ten items per category, explicitly re-prioritised on every read. A policy that binds reviewers needs a record that does not get curated away.

**Number: `0055`.** Handoff 041 §5 records *"Next ADR **0055**"* (verified). **Revision 1 asserted four times that `0056` is reserved for #96. That claim is unsourced and is dropped (m2):** `grep -rn "0056"` returns nothing outside plan 042, and `gh issue view 96` cites ADR-0031/0043/0053 and reserves no number. This ticket takes 0055; the next number is free.

**Proposed title:** *ADR-0055 — Test timeouts are sized against contention.*

**Decision list — four (MAJ-8).** Revision 1 shipped eight, of which three were not decisions at all: a citation of two other ADRs, a consequence restating CLAUDE.md's evidence rule, and a measurements appendix whose headline figure (`5m30.276s`) is stale the next time a test lands. That was this plan's own diagnosis of the napkin — *"a runbook, curated, capped"* — turned on itself: arguing an ADR is needed because a policy must not be curated away, and then filling it with a runbook's contents.

1. **The 5000 ms default is not a budget.** Any test whose **contended local or measured CI** time exceeds **40 %** of the applicable budget — its own explicit timeout where it has one, vitest's default where it does not — carries an explicit in-file timeout, with the arithmetic and both measured figures in a comment beside it. Below the trigger, no timeout. The rule was **swept before it shipped, on the `testTimeout` axis** (gate run `31888933252`, 28 tests over 2000 ms): **seven hits — five fixed here, two residual.** The **`hookTimeout` axis is unswept**, because vitest prints no hook durations; no hook in this repo has a measured cost, including ~20 `apps/api` `beforeAll(…, 30_000)` PGlite boots. A third residual, `apps/web/test/nonogram-screen.test.tsx:406`, was found by hand on the local axis, which the CI sweep also cannot see. **Three residuals in total — two from the sweep, one not — all filed as [#109](https://github.com/fernandolisboa/miolos/issues/109).**
2. **The anchor is the highest measured figure, CI first, worst contended local second — and it is a sample maximum, not a bound.** An isolated single-file run is **never** the anchor. A figure from a run in which **anything** timed out is never the anchor either: the run's *sample maximum* is right-censored at the wall, and turbo's termination of sibling tasks on first failure means the figures that did complete were taken under less contention than a full run's. **Where several tests share one cost driver and their per-test ordering is unstable between sessions, they are one population and every member takes the population maximum** — on #107 the ordering reversed twice (`T-LINT-1` worst of the trio in one session and cheapest in the next two; binairo `P2` above `P1` locally while `P1` is above `P2` on CI), so the wall trio takes one number and the binairo pair takes one number. Multiplier **×4, one multiplier for both provenances**, rounded up to the next 5 s. "Contended" means: the whole suite via `pnpm test --force` at turbo's default fan-out, nothing else on the box, ≥3 runs, take the max, **pooled with every earlier session's samples for the same test**. **The residual, stated as part of the decision:** the anchor is the maximum of a sample from a heavy-tailed scheduling distribution, so it grows with the sample and a later session may exceed it — #107's own anchor moved 4983 → 7907 → 9832 ms across three sessions. The ×4 and the round-up exist to absorb that; the rule is *"anchor on the largest figure measured so far, then multiply"*, never *"the largest figure measured so far is the worst case"*. **`×4` is retained for continuity with roughly 25 shipped in-file timeouts and the napkin's standing constant — it is not derived**, and a future ticket that derives a real multiplier from paired data supersedes it.
3. **Where a whole file shares one cost driver, the budget is file-scoped, not pinned to a test.** The three ESLint wall suites pay a one-time flat-config load in whichever test runs first, and which test that is moves with load and with any file edit — three measurement sessions disagree about which one it is. `vi.setConfig({ testTimeout })` at module scope; per-`it` where costs genuinely differ (binairo `P1`/`P2`/`P3`). File scope is safe because vitest's forks pool with `isolate: true` gives every file its own process — verified with a PID-pinned probe, not assumed.
4. **A timeout is a ceiling, not a target.** A test over **`budget / 4`** is a defect to investigate and record, never a number to raise, and never an automatic re-derivation either — decision 2's residual means a single figure over the line may be a draw rather than drift, so it is diagnosed and written down before anything moves. Raising a shipped timeout requires fresh measured figures in the PR body and an updated arithmetic comment. **The procedure:** a PR re-reads the five CI durations from its own gate log into its PR body when it touches any of — the three ESLint wall suites; `eslint.config.mjs`; `packages/games/test/binairo/generate.test.ts`; **`packages/games/src/binairo/**`**; or the **version of `eslint`, `eslint-config-next` or `typescript-eslint`** in the root `package.json`/lockfile. The last two exist because they are where drift actually originates and neither touches the first three. #106 is the first such PR.

**Cited constraints, not decisions** (revision 1's decision 4 — a second copy of two other ADRs, which is a second copy to keep true). In **Context**: ADR-0017 forbids a `vitest.config.ts` in `packages/games` and the reason is a real typecheck backstop, so games' timeouts are in-file; ADR-0023 floors the main validity and determinism properties at `numRuns` ≥ 100, so **run counts are never reduced to buy time** and `{ numRuns: 150 }` / `{ numRuns: 100 }` ship byte-identical.

**Consequences** (revision 1's decisions 5, 6 and 8):
- **A red root `pnpm test` is a finding again.** `TURBO_CONCURRENCY=1` stops being a standing pre-commit workaround and "re-run until green" stops being an available move. This largely restates CLAUDE.md's evidence rule and is recorded as an effect, not a new rule.
- **The root fan-out is deliberately left uncapped.** `"test": "turbo run test"` is unchanged, so ADR-0017's *"Turbo fans out `pnpm test`"* stays true, pre-commit and CI stay identical, and the contention the budgets were sized against remains the contention they actually meet. **#110** owns the cap and owes this ADR a fifth decision if it ships — including a rewrite of decision 2's "contended" procedure, which a cap invalidates.
- **A slow drift inside the budget is invisible until it crosses `budget / 4` on a PR that happens to touch one of decision 4's five triggers.** No mechanical checker detects growth; decision 4's procedure is a human obligation, and this is the honest residual.
- **The measurements do not live here.** `5m30.276s`, the per-package durations, the **isolated→CI factor range**, the shipped budgets' arithmetic and the corpus sweep's per-test table are in the PR body and in plan 042 §2.2–2.3, which are point-in-time records. An ADR that carries a measurements appendix is the fastest-rotting document in the repo — and the factor range in particular has now been measured three times and come out as ×4.3–×10.9, ×3.7–×9.1 and ×4.3–×9.1, which is precisely a number that does not belong in a durable record (F9, C7). **What the ADR keeps is the qualitative finding it rests on: isolated→CI runs materially above ×4 for these tests, so ×4-on-isolated under-shoots.** Decision 1's sweep counts stay, because there the sweep *is* the warrant for the rule; decision 4's threshold is stated as `budget / 4` and never as a millisecond figure, because the millisecond figure changes with every budget.

**Amendments owed to other records (B3) — the real sweep, with hits.** Revision 1 wrote *"no ADR in `docs/adr/` makes any claim about the test command, turbo's fan-out, `testTimeout`, or `TURBO_CONCURRENCY`"* and proposed to ship that as a verified clearance. **It is false**, and it was false about the ADR this plan quotes twice. Both sweeps re-run in this session:

| sweep | hits |
|---|---|
| `grep -rn "turbo" docs/adr/*.md` | `0027:151` (*"workflow, turbo task or git hook"*), `0054:338`, `0054:975` (both `turbo.json`'s `build.env` allowlist) |
| `grep -rn "pnpm test" docs/adr/*.md` | **`0017:7`**, **`0017:21`** |
| `grep -rniE "testTimeout\|TURBO_CONCURRENCY\|concurrency" docs/adr/*.md` | none |
| `grep -rni "timeout" docs/adr/*.md` | `0043:301`, `0054:319` (`[status]` timeout effect), `0054:1016` (DB pool timeout) |

**ADR-0017, decided explicitly rather than cleared.** `docs/adr/0017-vitest-and-fast-check-are-the-test-stack.md:21` reads *"Every workspace with tests carries `vitest` and a `test: "vitest run"` script; **Turbo fans out `pnpm test`**"*, and `:7` reads *"the mechanical gate depends on one from the first ticket: **`pnpm test` full suite**"*. Revision 1's cap would have made `:21` materially incomplete and owed it an annotation. **Revision 2 ships no cap, so `:21` remains true as written and no amendment is owed** — not because nothing was found, but because the thing that was found is still accurate, and ADR-0055 says which of the two it is. **#110 inherits the annotation obligation** and its issue body carries it. The other seven hits are dismissed with reasons: 0027, 0054 ×2 are passing references to turbo as a build tool with no claim about test fan-out; 0043 and 0054 ×2 are about a completion's `[status]` timeout and a DB pool timeout, a different sense of the word.

**ADR-0023 is cited and obeyed**, which owes no reciprocal `Amended by:` header — that idiom (napkin Execution item 5) binds when a record's statement is made *false*, and it is not. ADR-0055 says so explicitly, because clearing a record as untouched and being wrong is the exact failure handoff 041 §4 counts seven times, and revision 1 committed it in the paragraph that cited handoff 041 §4.

### 12.5 `docs/README.md` — **four** rows, same PR — and the two findings files are renumbered to earn them (F7)

**The convention this PR has to satisfy**, quoted from `docs/README.md` (verified): `NNN[-issue-<n>]-<type>-<slug>.md`, where `NNN` is *"a single sequence shared across every subdirectory … Next free number wins"* and `<type>` ∈ {`handoff`, `brief`, `plan`, `spec`, `research`}.

Revision 2's findings files broke it twice: they **reused `042`** (already taken by this plan) and used a `<type>` of **`review`**, which is not in the list. §8 committed them, §12.5 gave one of them a README row, exit criteria 1 and 13 required them — and §12.9 row 9's only check was *"the rows are absent from the Current table"*. The convention itself was never checked, for files this PR creates. That is round-1 B3's pattern — clearing a record without reading it — one corpus over.

**The fix is to take the numbers, not to widen the convention.** Amending `docs/README.md`'s `<type>` list to admit `review` would ship a new document class as a side effect of a timeout ticket, which is the "small improvement nobody asked for" CLAUDE.md tells us to sanity-check and drop. The renames:

| was | is |
|---|---|
| `docs/plans/042-review-round-1-findings.md` | **`docs/plans/044-issue-107-research-review-round-1-findings.md`** |
| `docs/plans/042-review-round-2-findings.md` | **`docs/plans/045-issue-107-research-review-round-2-findings.md`** |

- **`044` / `045` — and *not* `043`, which is the correction this revision's own first pass needed.** Handoff 041 §5 records *"Next plan/handoff **042**"* (verified, `041-…:118`), and reading the next two free numbers straight off that line gives `043`/`044`. **`043` is not free.** #96 is a live parallel ticket running in `/home/ferna/projects/miolos-wt/96` — the worktree landmine 14 and §10.3 already tell this ticket not to touch — and its plan is `docs/plans/043-issue-96-plan-archive-done-chip.md`, uncommitted but written. A number claimed by an in-flight ticket is taken; racing it into the same sequence slot is the same defect one corpus over. **Resolution: #107 takes `044` and `045` and leaves `043` to #96.** So this PR consumes **042, 044 and 045**, `043` belongs to #96, and the next free document is **046**. The next handoff records both facts.
- **`issue-107`** — present, because each belongs to exactly one issue.
- **`research`** — the canonical type that fits: a point-in-time investigation whose output is findings. Not `plan` (they are not plans), and `review` is not on the list.
- **They stay in `docs/plans/`**, beside the plan they review. The convention constrains `NNN`, `<type>` and `<slug>`; the directory is topical, and the repo already ships a `handoff`-typed document outside `docs/handoffs/` (`design/006-handoff-design-winner-atelie/`, verified in `docs/README.md`'s Current table). Stated here rather than left implicit, because an unstated choice is what got round 2's attention in the first place.
- **Their bodies are not edited.** They are snapshots of what two review rounds found, including where they were themselves wrong. Renaming a file is not rewriting it.

**Four rows appended to `docs/README.md`'s Current table**, in the same PR as the artifacts — `plans/042-…plan…`, `plans/044-…round-1-findings`, `plans/045-…round-2-findings`, `adr/0055-…`. Napkin Parallel-Stream item 1: *"every PR committing a plan/ADR adds its README row — this was a blocking review finding in four consecutive PRs."* Not optional, not a follow-up.

### 12.6 Issue #107 itself — a comment, because issues are living

The issue body says *"CI is not currently affected — the `gate` job has been green throughout — but the margin is unmeasured."* Measured now: **4186 ms / 5000 ms = 83.7 %** on run `31888933252` (verified). Post a comment with §2.2's table and the run link.

The same comment carries four more corrections and one obligation the work produced:

- The issue's "Fix, roughly" cites *"the napkin's Execution item 3 standard"*, which is item **4** after the 2026-08-15 re-curation — and that standard is itself falsified and rewritten by this ticket (§12.1).
- The issue offers *"either an explicit `testTimeout` … or a concurrency cap"*. The answer is **the timeouts**; the cap is separated as **#110** with the measured reasons (§5.1). Saying so on the ticket keeps the next reader from assuming the cap was forgotten.
- Three tests already sit at or over the trigger this ticket introduces and are deliberately not fixed here: **#109**.
- The sizing rule this ticket ships is swept on the **`testTimeout`** axis only; the `hookTimeout` axis has no instrument, because vitest prints no hook durations (§2.3). Anyone applying ADR-0055 to a `beforeAll` is extrapolating.
- **The obligation for the next handoff (§12.7, F2):** five handoffs — `034 → 036 → 038 → 039 → 041` — chain *"all of §3 stands"* and thereby keep re-ratifying `TURBO_CONCURRENCY=1` as standing instruction. Snapshots are not edited, so the next handoff's §3 must **break the chain explicitly** rather than ratifying 041's. Recording it on the issue as well as in this plan, because a plan is a snapshot and an issue is not — which is the whole lesson of #109.

An issue is not a point-in-time snapshot the way a plan or a handoff is; leaving a measured falsehood in the ticket that motivates the work is the same defect this plan is fixing one level up.

### 12.7 `docs/handoffs/` — **swept**. Eleven statements across eight handoffs, none amended, and one obligation handed forward

**Revision 2 asserted *"Handoffs 039 and 041 … three of their statements become historical"* and never ran a sweep (F2).** §12.9 row 13's hit was *"three named sentences"* — inside the section billed as the two-way instrument, which is round-1 B3's pattern one corpus over. Swept now, reproducibly:

```
$ grep -rn "TURBO_CONCURRENCY" docs/handoffs/
034:52   - **`TURBO_CONCURRENCY=1` on every `git commit`** — pre-commit runs the full suite and PGlite
           `beforeAll` hooks flake non-deterministically under turbo's parallel fan-out on this machine.
036:49   All of handoff 034 §3 stands (nvm preamble; `TURBO_CONCURRENCY=1` on every commit; …). New:
038:89   - **`TURBO_CONCURRENCY=1` on every commit and on any gate run you paste as evidence.**
039:83   All of handoff 038 §3 stands — the nvm preamble, `TURBO_CONCURRENCY=1` on every commit, …
041:69   All of handoff 038 §3 and 039 §3 stand — …, `TURBO_CONCURRENCY=1` on every commit, …
041:71   … Until it lands, `TURBO_CONCURRENCY=1` is not optional and a single red root run is not a finding.

$ grep -rniE "testTimeout|per-test timeout|5 ?000 ?ms|5000ms|wall time|3–4×|3-4x" docs/handoffs/
019:259  **CI runners are ~3–4× slower than local, and vitest's default per-test timeout is 5 000 ms
           with no config raising it.** … arithmetic in a comment …
021:160  **CI runners are ~3–4× slower than local; vitest's default per-test timeout is 5 000 ms.**
023:150  **`eslint-db-wall.test.ts`'s `T-LINT-1` sits near vitest's 5 000 ms default** at full
           concurrency — it passed in CI every time, but it is the thinnest budget in the suite.
039:100  landmine 8 — P2 timed out at 5165ms … "The durable fix is an explicit timeout sized at
           local wall time × 4 … it is not filed as an issue yet" … "napkin Execution & Validation item 3"
041:108  … An explicit `testTimeout` on the three wall suites (napkin Execution item 3's ×4 rule) …
```

**Eleven statements across eight handoffs** — 019, 021, 023, 034, 036, 038, 039, 041 — not three across two. Each becomes historical when this PR lands, and **none is edited** (CLAUDE.md: *"Both are point-in-time snapshots, never living specs"*):

| hit | what it says | why it is now historical |
|---|---|---|
| `019:259`, `021:160` | *"CI runners are ~3–4× slower than local; vitest's default per-test timeout is 5 000 ms"* | the ~3–4× is a whole-suite claim; for these five tests isolated→CI is ×4.3–×9.1 *(round 3)*. The 5 000 ms half stays true — it is still the default; five tests now declare otherwise |
| `023:150` | `T-LINT-1` *"is the thinnest budget in the suite"* | correct when written and now measured at 83.7 % of budget — and then fixed. `T-LINT-1` is no longer the thinnest budget |
| `034:52` | `TURBO_CONCURRENCY=1` on every commit, because *PGlite `beforeAll` hooks* flake | **the stated cause is the hook class this ticket does not touch** (§12.2). The prescription goes, the cause is not disproved |
| `036:49`, `039:83`, `041:69` | *"All of handoff NNN §3 stands"*, each re-ratifying the prefix | the chain, below |
| `038:89` | `TURBO_CONCURRENCY=1` on commits **and on pasted gate evidence** | the `--force` half survives (§12.2); the concurrency half does not |
| `039:100` | landmine 8: the ×4-off-local durable fix, *"not filed as an issue yet"*, *"napkin item 3"* | filed (#107) and landed; the ×4-off-**local** arithmetic is what §12.1 falsifies; item 3 is item 4 today |
| `041:71` | *"`TURBO_CONCURRENCY=1` is not optional and a single red root run is not a finding"* | the sentence this ticket exists to retire. Its living copy is napkin item 8, corrected in §12.2 |
| `041:108` | *"napkin Execution item 3's ×4 rule"* | wrong item number and a falsified rule |

**And here is the thing a single sentence in a plan cannot outweigh — the chain (F2).**

```
034 §3  ──"all of 034 §3 stands"──▶  036 §3
                                      │
038 §3  ──"all of 038 §3 stands"──▶  039 §3
   └────"all of 038 §3 and 039 §3 stand"────▶  041 §3
```

**Five documents, each explicitly ratifying the previous one's §3**, and 041 is the most recent handoff — which means `TURBO_CONCURRENCY=1` is not a stale line in an old file, it is **live standing instruction for the current session and the next one**. Editing snapshots is forbidden and correcting the napkin (§12.2) fixes the living copy, but neither breaks the chain: the next agent who reads 041 §3 and follows it to 039 §3 and 038 §3 finds the prefix ratified three times and nothing telling them otherwise.

> **Obligation, recorded here and owed by whoever writes the next handoff:** its §3 must **explicitly break the chain** rather than saying *"all of 041 §3 stands"*. In words: *"041 §3 stands **except** `TURBO_CONCURRENCY=1` on every commit, which #107 retired — the root suite is green uncapped, 1 is the slowest setting measured, and a red root `pnpm test` is a finding again (napkin item 8, ADR-0055)."* A blanket *"§3 stands"* in the next handoff re-ratifies a retired instruction for a sixth time, and that is the specific failure this section exists to prevent.

This is also why §12.2's correction of napkin item 8 is not optional bookkeeping: it is the only *living* copy in the whole chain, and the handoffs all point at it.

Recorded here so a future agent reading 019, 021, 023, 034, 036, 038, 039 or 041 does not "fix" a snapshot.

### 12.8 `CLAUDE.md` and `CONTEXT.md` — no change

`CLAUDE.md`'s mechanical gate line is *"`pnpm test` — full suite"* (verified, line 64). Still true, and **more true than before**: the script is byte-unchanged and the command's meaning is unchanged; only five tests' budgets move. `CONTEXT.md` is a domain glossary and contains no statement about the test command, turbo, or timeouts (verified by grep — zero hits). No domain term moves.

### 12.9 The two-way amendment check (handoff 041 §4)

*"Every checklist row has ≥1 hit, and every hit maps back to a row — never a bare count."*

**Forward — every record this PR could falsify, with its hit:**

| # | Record | Hit | Disposition |
|---|---|---|---|
| 1 | napkin Execution item 4 (timeout sizing) | `.claude/napkin.md`, item 4, both sentences | **Rewritten**, §12.1 |
| 2 | napkin Execution item 8 (`TURBO_CONCURRENCY=1`) | same file, item 8, the "prefix every commit" sentence | **Corrected**, §12.2 |
| 3 | napkin Shell item 3 (no `--concurrency` in vitest) | same file, Shell item 3 | **Clause added**, §12.3 |
| 4 | ADR-0017 consequence, fan-out | `docs/adr/0017-…:21` | **Checked, still true** — no cap ships. #110 inherits the obligation. §12.4 |
| 5 | ADR-0017 decision, no games config | `docs/adr/0017-…` Decision bullet | **Obeyed and cited** in ADR-0055 Context. §12.4 |
| 6 | ADR-0023 `numRuns` floor | `docs/adr/0023-…` Decision layer 3 | **Obeyed**; `numRuns` grep on the diff must be empty (§9 step 1, exit 7) |
| 7 | CLAUDE.md mechanical gate | `CLAUDE.md:64` | **Checked, still true**, §12.8 |
| 8 | `CONTEXT.md` | zero occurrences of `test`-command / turbo / timeout language | **Checked, nothing to change**, §12.8 |
| 9 | `docs/README.md` "Current" table **and its naming convention** | the four rows are absent; and the convention at `docs/README.md:24-30` — `NNN[-issue-<n>]-<type>-<slug>`, single shared sequence, `<type>` ∈ {handoff, brief, plan, spec, research} — which revision 2's two findings files broke | **Four rows added and both findings files renumbered to `044`/`045` with type `research`** — `043` left to #96, §12.5. The `<type>` list is **not** amended |
| 10 | `docs/agents/test-ids.md` frontier | `:42`, `T-LINT` next free `S47` | **Checked, unchanged** — no id spent, §11 |
| 11 | issue #107 body, *"CI is not currently affected"* | the "Why it matters" paragraph | **Comment posted**, §12.6 |
| 12 | issue #107 body, *"the napkin's Execution item 3 standard"* | the "Fix, roughly" paragraph | **Comment posted**, §12.6 |
| 13 | **`docs/handoffs/`** — every statement about `TURBO_CONCURRENCY`, the 5 000 ms default or the ×4 rule | **eleven statements across eight handoffs**: `019:259`, `021:160`, `023:150`, `034:52`, `036:49`, `038:89`, `039:83`, `039:100`, `041:69`, `041:71`, `041:108` — swept, listed in full in §12.7 | **Deliberately left as written** (snapshots), **plus a forward obligation**: the next handoff must break the `034→036→038→039→041` *"§3 stands"* chain explicitly, §12.7 |
| 14 | `docs/handoffs/041-…:118`, *"Next plan/handoff **042**. Next ADR **0055**."* | the numbering line | **Consumed**: this PR takes 042, **044**, **045** and ADR 0055; **`043` is #96's** (§12.5). Snapshot left as written; the next handoff records **046** / 0056 |
| 15 | `docs/plans/037-issue-31-plan-archive.md:1223` (V9) | *"napkin item 3's own arithmetic — local wall time × 4 — asks for 1.7 s against a 5 s default. A timeout is not what is wrong"* — about `T-LINT-1`, the very test this PR budgets | **Deliberately left as written** — a plan is a snapshot, and the register entry was correct about its own PR's scope. Its conclusion is superseded by #107, which is the ticket V9 declined to open. §12.7's rule applies identically |
| 16 | this plan's own §2.2/§2.3/§5 figures | every `(step 1)` figure superseded by a `(round 1)`/`(round 2)`/`(round 3)` one | **Superseded in place**, §0.1 and §2.2's four-column tables |

**Backward — every hit from every corpus sweep, mapped to a row or dismissed. Sweeps re-run in this session; output as returned:**

```
$ grep -rn "turbo" docs/adr/*.md
0027-the-hint-is-computed-on-the-client.md:151:  workflow, turbo task or git hook invokes it: plan 020 §20.2 scopes it as a
0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md:338:   `NEXT_PUBLIC_SITE_URL` is already on `turbo.json`'s `build.env` allowlist,
0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md:975:    rule is added. `turbo.json`'s `build.env` allowlist is unchanged: no new

$ grep -rn "pnpm test" docs/adr/*.md
0017-vitest-and-fast-check-are-the-test-stack.md:7:  … the mechanical gate depends on one from the first ticket: `pnpm test` full suite …
0017-vitest-and-fast-check-are-the-test-stack.md:21: … Turbo fans out `pnpm test`.

$ grep -rniE "testTimeout|TURBO_CONCURRENCY|concurrency" docs/adr/*.md
(no output)

$ grep -rni "timeout" docs/adr/*.md
0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md:301:    `[status]` timeout effect. So no transition writes both, and the
0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md:319:   its own `[status]` timeout. No transition writes both, and the stronger
0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md:1016:  timeout, a pool error or a missing `DATABASE_URL`, and the doc block usually

$ grep -rn "TURBO_CONCURRENCY" docs/handoffs/          →  034:52  036:49  038:89  039:83  041:69  041:71
$ grep -rniE "per-test timeout|5 ?000 ?ms|wall time|3–4×" docs/handoffs/
                                                       →  019:259  021:160  023:150  039:100  041:108

$ grep -rn "local wall time" docs/ .claude/ CLAUDE.md   →  .claude/napkin.md:17  docs/handoffs/039-…:100
                                                           docs/plans/037-…:1223  (+ this plan, ×3)

$ grep -cniE "turbo|testTimeout|pnpm test" CONTEXT.md   →  0
```

| Hit | Row |
|---|---|
| `docs/adr/0017-…:7` and `:21` | rows 4, 5 |
| `docs/adr/0027-…:151` (*"workflow, turbo task or git hook"*) | dismissed — turbo as a build tool, no claim about test fan-out |
| `docs/adr/0054-…:338`, `:975` (`build.env` allowlist) | dismissed — `turbo.json`'s env allowlist, untouched by this PR |
| `docs/adr/0043-…:301`, `docs/adr/0054-…:319` (`[status]` timeout) | dismissed — a completion's status timeout, a different sense of the word |
| `docs/adr/0054-…:1016` (DB pool timeout) | dismissed — same |
| `testTimeout` / `TURBO_CONCURRENCY` / `concurrency` in `docs/adr/` | **no hits** — recorded as no hits, not as a clearance |
| `docs/handoffs/034:52`, `036:49`, `038:89`, `039:83`, `041:69`, `041:71` | row 13 |
| `docs/handoffs/019:259`, `021:160`, `023:150`, `039:100`, `041:108` | row 13 |
| `docs/handoffs/041-…:118` (numbering) | row 14 |
| `docs/plans/037-…:1223` (V9) | row 15 |
| `.claude/napkin.md:17` (*"local wall time × 4"*, item 4) | row 1 |
| `.claude/napkin.md` items 8, Shell 3 | rows 2, 3 |
| `packages/games/test/sudoku/generate.test.ts:58-60` (*"GitHub's 2-core runner"*) | **row 16 / §5.1** — the hit that falsified D9 |
| `CLAUDE.md:64` | row 7 |
| `CONTEXT.md` — `grep -cniE "turbo\|testTimeout\|pnpm test"` returns `0` | row 8 — **no hits**, recorded as such |
| `docs/agents/test-ids.md:42` | row 10 |
| `docs/README.md:24-30` (the convention) + Current table | row 9 |

Every row has at least one named hit. Every hit maps to a row or carries a written dismissal. No number stands in for either list.

**What the widened sweep cost, said plainly:** revision 2 ran the ADR corpus and stopped. Adding `docs/handoffs/` turned "three statements across two handoffs" into **eleven across eight**, surfaced a five-document ratification chain nobody had noticed, and turned up two records neither previous revision had seen at all (`023:150`, `037:1223`). The instrument was fine; it was pointed at part of the corpus.

---

## 13. Exit criteria

A row may be checked only with pasted output.

1. `docs/plans/042-issue-107-plan-test-timeouts.md`, `docs/plans/044-issue-107-research-review-round-1-findings.md` and `docs/plans/045-issue-107-research-review-round-2-findings.md` committed, **each under a name that satisfies `docs/README.md:24-30`** (a free number in the shared sequence, canonical `<type>`), each with a `docs/README.md` row, and `ls docs/plans/ | grep -E '^(042-review|043-issue-107)'` returning nothing — **`043` is #96's and this PR must not take it** (F7, §12.5, R1).
2. `docs/adr/0055-…` committed as **0055**, with a `docs/README.md` row, and with **four** decisions (§12.4) — the cited constraints in Context, the consequences in Consequences, no measurements appendix.
3. §9 step 0's pre-fix baseline: 10 runs at unmodified HEAD, tally and failing-test identities pasted, the tally read from turbo's `Failed:` line rather than a `grep -c`.
4. **Block A**: 10 consecutive `rc=0` on the branch, each with `Cached: 0 cached, 6 total`, **and each with the five tests' individual durations pasted**.
5. **Block C**: 10 consecutive `rc=0` **on `main`, after the merge**, run **from `/home/ferna/projects/miolos`** (not the worktree — `git checkout main` fails there while #96's and #107's worktrees exist, C3), with `git log --oneline -1` showing the squash commit and the `pgrep` idle assertion **taken in that directory**, all pasted as a comment on #107. **#107 is not closed without it** (AC1, B2).
6. §10.1's rule discharged **in writing, in the PR body**: the five per-test durations from all ten Block A runs pasted, and any figure over `budget / 4` — **10 000 ms** for the wall trio, **6250 ms** for the binairo pair — **diagnosed and recorded** (which test, which run, what else was on the box, drift or draw). This is not a merge blocker and a figure over the line does not by itself force a re-derivation (C1/C2, ADR-0055 decision 4); ten green runs remain criterion 4's job. **What does block: a silent block A** — the durations are pasted whatever they say.
7. Every timeout added carries its arithmetic and its measured figures in a comment (issue AC 2).
8. `packages/games` keeps ≥100 fast-check runs — shown as an empty `git diff … | grep numRuns` (issue AC 3, ADR-0023).
9. No `vitest.config.ts` exists in `packages/games` — `find packages/games -maxdepth 1 -type f` pasted (ADR-0017).
10. `apps/web/vitest.config.ts` unchanged — empty `git diff origin/main -- apps/web/vitest.config.ts` pasted (option D rejected, not silently adopted).
11. **`package.json`, `turbo.json`, `.github/workflows/ci.yml` and `.husky/pre-commit` all unchanged** — empty `git diff origin/main --` pasted for each (D7, D8, D9 withdrawn; the cap is #110).
12. `apps/api/next-env.d.ts` and `apps/web/next-env.d.ts` clean — `git status --porcelain` pasted, showing neither (m4).
13. The napkin's Execution item 4 and item 8 in their new form, quoted; Shell item 3's added clause quoted, **including the flag-beats-env precedence sentence**. Item 4 must still carry the two non-negotiable clauses of §12.1 (anchor-is-never-isolated; a pre-fix run's sample maximum is censored) and item 8 must still carry its PGlite `beforeAll` clause, re-worded as an open class rather than deleted (C5, F11).
14. `docs/agents/test-ids.md` unchanged — empty `git diff origin/main --` pasted (§11: no id spent, `T-LINT-S47` left to #106).
15. `pnpm typecheck`, `pnpm lint`, `pnpm test --force` all green with output pasted.
16. The PR's `gate` run green, with the `pnpm test` step's `Time:` against **5m30.276s**, its `Cached:` line quoted so a replay is visible as one, and the five tests' new CI durations checked against criterion 6's thresholds.
17. `npx impeccable detect` **not** run, with the reason stated in the PR body (no UI touched).
18. The comment on issue #107 posted, carrying the measured margin plus all five corrections and the next-handoff obligation of §12.6.
19. **#109 and #110 exist, are labelled `ready-for-agent`, and are cited from §1, §5 and §14** — the residuals and the cap are in the tracker, not only in this snapshot (m9). Both carry **`Blocked by: #107` as the first line of the body**, per `docs/agents/issue-tracker.md`'s fallback form (F12), and **#110's body carries the decision-2-rewrite obligation** as well as the ADR-0017:21 annotation and the fifth-decision obligation (F10).
20. §14's deviation register reviewed against the tree — **every `D<n>` claim verified to have actually landed** (handoff 041 §4, instance 6: a deviation recorded for a fix that never left a working tree).
21. **The next-handoff obligation from §12.7 is written where the next session will actually read it** — in the PR body *and* in the issue #107 comment: the next handoff's §3 must explicitly retire `TURBO_CONCURRENCY=1` rather than saying *"all of 041 §3 stands"*, because `034 → 036 → 038 → 039 → 041` currently ratify it in a chain and a sentence in a plan does not outweigh five handoffs (F2).
22. **Every `file:line` citation in this plan re-derived against the tree at merge time**, not carried forward from a previous revision. Revision 2 claimed all 58 were re-derived and round 2 still found four stale (n-a, n-b, C9, C10). **The audit is manual, with a grep as its enumerator only — this criterion says so rather than implying a one-liner discharges it (R6).** `grep -oE '[a-zA-Z0-9_./-]+\.(ts|tsx|mjs|json|md|yml):[0-9]+' <plan>` enumerates the hits, but a large minority of them are **bare basenames** (`grade.test.ts:174`, `generate.test.ts:61`, `publishing-service.test.ts:127-129`) that no `sed -n` can open, and several are **ellipsised** (`docs/adr/0017-…:21`, `docs/handoffs/041-…:118`), which are not paths at all. Resolving a basename to the directory this plan means by it is a human step, and so is deciding which of two same-named files is intended. **What is pasted:** the grep output, the basename-to-path resolution, and the list of corrections — or the criterion is not met.
23. **Pre-commit green on the final commit** — the hook's own output from §15's commit 3 (`lint-staged`, `pnpm typecheck`, `pnpm test`), pasted, and **`--no-verify` used on no commit in this PR**. CLAUDE.md's mechanical gate names pre-commit explicitly and criteria 15–16 cover only the manual gate and the CI run, so without this row the one gate that runs on every commit goes unrecorded. Any red pre-commit on commit 1 or 2 is recorded in the PR body under §9's disposition — which test, which commit, which run — and a **green** hook is quoted with its `Cached:` line, because a cached replay out of a hook is not evidence the suite ran.

*(All `git diff` exit criteria specify **`origin/main`**, not `main` — on a worktree, local `main` may be stale (n6).)*

---

## 14. Risks, landmines & deviations register

*Empty of implementation deviations at plan time. The implement agent appends every deviation below — the section it deviates from, the cause, which lens or reviewer caught it, and its severity — as one numbered sequence under dated batch headers, in the `D<n> | From | To | Cause and severity` shape of plan 040 §14. **The sequence continues from `D10`**, because `D1`–`D9` are this plan's decision register (§3–§5) and a deviation must never collide with a decision number. Napkin Execution item 5 binds: a fix that changes a plan statement owes an entry here in the same round.*

*Revisions 2's and 3's own changes to `D1`–`D9` are not deviations — they are step-4 plan revisions, and they are listed in §0.1 and §0.2 rather than here.*

| # | From | To | Cause, and severity |
|---|---|---|---|
| — | *(none at plan time)* | | |

#### Batch 1 — 2026-08-15, step 5 (implement)

| # | From | To | Cause, and severity |
|---|---|---|---|
| **D10** | §9 step 0: *"Expect roughly half red; **if all ten are green, stop and report it**"* | **2 red / 10**, and only **one** of the two is this ticket's class | The baseline block ran on an idle box at default fan-out exactly as specified, and drew a milder session than any before it: rounds 1 and 2 measured 3 red / 6, 3 red / 4 and 6 red / 6. Run 3 failed on binairo **`P2 — determinism`, killed at 5869 ms** — one of §2.2's five, `Error: Test timed out in 5000ms`, the exact defect. Run 10 failed on something else entirely (D11). **Neither of §9 step 0's two branches was hit literally**: the tally is not "roughly half" and it is not "all ten green", so the stop-and-report clause does not fire — the ticket's premise is confirmed by run 3, not thrown into question. **Consequence for §10.4:** the before-half is recorded as **2 red / 10 (one in-class, one out-of-class)**, not as a coin flip, and the elapsed column is the truncated one §10.4 already refuses to compare. **Severity: low** — no decision moves. D1–D6, D2's 40 000 ms and D3's 25 000 ms are all anchored on pooled rounds 1+2 figures, which this session neither replaces nor exceeds; landmine 7 predicted exactly this session-to-session spread |
| **D11** | The plan's failure population is §2.2's **five** tests, and §9's disposition splits every red into "one of those five, with `Test timed out in 5000ms`" (record and re-run) or "anything else — **a stop**" | A **sixth, unrelated, non-timeout defect exists on `main`** and was found by §9 step 0's own baseline: `T-API-S41: runTopUp never leaks a bound parameter into the response body` (`apps/api/test/cron-publish.test.ts:568-614`) fails with an **`AssertionError`**, not a timeout, on **1 root run in 400** | Diagnosed rather than re-run, per §9's disposition. `runTopUp` draws a **fresh `randomUint32()` per attempt** (`apps/api/src/publishing/service.ts:154`, ADR-0010 — deliberately never a seed derived from `(game, date)`), so the Termo answer for the sabotaged insert is a uniform draw over the 400 rows of `content/termo/answers.csv`. Row 373 of that file is literally **`termo,termo`**. The test asserts `expect(serialized).not.toContain(answer.normalized)` against the whole `/cron/publish` response body — and that body **always** contains the substring `termo`, because it is a game key: `{"games":{"termo":{…}}}`. Checked mechanically against the observed body: of the 400 answers, **exactly one** is a substring of it, and it is `termo`. So the failure rate is **1/400 = 0.25 % per root run**, contention-independent, date-independent, and **entirely outside #107** — it predates this branch, no edit here touches it, and no timeout can fix it. **Consequence, stated because it is the one that matters: AC1 asks for ten consecutive `rc=0`, and this defect puts a `1 - 0.9975^10 = 2.5 %` chance of an out-of-class red on every ten-run block, Block A and Block C alike.** If it fires, the run is reported as what it is — a red run with a named, filed, unrelated cause — and never quietly re-rolled. Filed as **[#111](https://github.com/fernandolisboa/miolos/issues/111)** rather than recorded only here, because recording a residual in a snapshot instead of the tracker is the precise failure that produced #107 (handoff 039 landmine 8) and #109. **Severity: medium** — it does not change a single decision in this plan, and it does put the AC's own instrument at risk |
| **D14** | §10.1's extraction pattern, `grep -hE '✓ .*(T-LINT-1:\|T-LINT-S9:\|T-LINT-S41:\|P1 — generated\|P2 — determinism)'`, and the R5 paragraph that hardened it | The same five anchors, but matched **after stripping ANSI**, and with no space required after the tick: `sed -e 's/\x1b\[[0-9;]*m//g' <log> \| grep -aE '✓.*(…)'` | R5 corrected this pattern on both of the axes it thought about — `T-LINT-1` over-matching `T-LINT-10`, and `P1 —`/`P2 —` over-matching sudoku's properties — and **both corrections are right and were load-bearing** (`T-LINT-10:` really does exist, at `eslint-db-wall.test.ts:773`). It missed a third axis: the literal space in `'✓ '`. Vitest's default reporter emits the tick followed by **ANSI colour codes**, and turbo prefixes the whole line with `@miolos/web:test: `, so the rendered line is `@miolos/web:test:  <ESC>[33m<ESC>[2m✓<ESC>[22m<ESC>[39m T-LINT-1: …` — the character after `✓` is `ESC`, not a space, and the pattern matches **nothing**. Block A's first extraction returned zero lines for all ten runs against a criterion (exit 4 and 6) that treats a silent block as the one blocking failure. **No re-run was needed**: the figures were in the ten saved logs all along, so this cost an extraction pass, not a measurement block. Landmine 13 already records that `gh run view --log` needs an ANSI stripper for exactly this reason; the local reporter needs the same one and §10.1 did not say so. **Severity: low, and it is a plan defect rather than an implementation one** — recorded because the criterion it silently defeats is the one the plan calls non-negotiable |
| **D13** | §9's pre-commit disposition and §15's note that *"commit 1 fires the hook with half the fix missing … against exactly the population that went 6/6 red"* | **No red pre-commit occurred on any commit**, and the reason is mechanical rather than lucky | `.husky/pre-commit` runs `pnpm typecheck && pnpm test` over the **working tree**, not over the index. §9 steps 1 and 2 both complete — and are both individually verified — before anything is committed, so by the time commit 1 stages `packages/games` alone, the working tree already carries **all five** edits. The hook therefore ran the complete fix at commit 1 and went green (`Tasks: 6 successful, 6 total`, `Cached: 1 cached, 6 total` — five packages executed for real). Commit 2 staged the wall trio into a tree turbo had already hashed and executed, so its hook was a **`Cached: 6 cached, 6 total` / `FULL TURBO` replay in 12 ms** — a gate satisfied, never a measurement, exactly as §9's converse warns. **The staged/working-tree split is what makes §15's "half the fix missing" premise unreachable in practice**, short of committing before step 2 is written, which §9's own per-step verification forbids. `--no-verify` was used on no commit. **Severity: nit, and it resolves in the plan's favour** — the disposition it anticipated simply never had to fire |
| **D12** | §9 step 1 and exit criterion 8: `git diff packages/games \| grep -E '^[-+].*numRuns'` **must be empty** | The two new Binairo comments say *"the run count above is untouched"* and cite ADR-0023 **without using the literal token `numRuns`** | First-pass comments spelled the constraint as *"numRuns is untouched, because ADR-0023 floors it"* — which is true, is exactly what §8 asks the comment to carry, and **trips the plan's own checker**, because the grep matches any added line containing the token, not just a changed run count. The check and a comment naming the thing it checks cannot both exist, so the comment was reworded. No plan statement changes and the criterion is now met as written, with an empty grep. **Severity: nit, recorded because it is invisible until it fires** — any future ticket touching a `numRuns` line under this criterion meets the same collision, and the resolution is to reword the prose, never to weaken the grep |

### Landmines

1. **The `[ELIFECYCLE]` collateral-failure trap. Read this before diagnosing any red run.** Turbo terminates sibling tasks on the first failure, so a package can print `@miolos/games:test: [ELIFECYCLE] Test failed.` with **zero failing tests and no summary block**. Confirmed in round 1: that exact line appeared with no `FAIL` block anywhere while turbo's own verdict was `Failed: @miolos/web#test` alone. **The authority is turbo's `Failed:` line and the presence of an actual `FAIL <file> > <test>` block — never the log prefix.** This is almost certainly what produced the phantom `@miolos/api` "1 failed / 245 passed" in #34's step-7 pass 2 that the issue tells us not to chase (245 + 1 = 246 = the whole api suite, which ran green 13/13 for the verifier).
2. **`--force` or it is not evidence — locally *and* on CI.** Turbo replays cached logs and a replay is byte-identical to an execution. `Cached: 6 cached, 6 total` means inputs are unchanged, never that anything ran (napkin Execution item 8). Every local measurement uses `--force`. **CI cannot**: `ci.yml:91` runs a bare `pnpm test` after a cache restore, warmth accrues across pushes to the same PR, and a docs-only commit invalidates no package hash (`turbo.json:3`). So **any CI figure must be read together with its `Cached:` line**, and a `0 cached, 6 total` is the only kind that compares against §2.2's baseline. This is the trap that killed revision 1's D8.
3. **Which test fails moves with load.** Step 1's three failures were all `T-LINT-1`; round 1's were `T-LINT-S9` and `T-LINT-S41`; round 2's six were `T-LINT-S41` ×6 and `T-LINT-S9` ×4; #34's round saw `T-LINT-S41`, `T-LINT-S9` ×2, `T-LINT-1` ×2 and binairo `P2` ×2. **A fix scoped to whatever failed today is under-scoped** — that is precisely how the ticket came to name `P2` and not `P1`. The population is the five tests of §2.2, and D2/D3 treat them as populations for this reason.
4. **Never size a timeout from a run in which anything timed out — and get the reason right (C6).** Two distinct mechanisms, both biasing low, neither of which is *"every figure in the run is a lower bound"*: **(i)** a test killed at 5000 ms *reports* 5000 ms, so the run's **sample maximum** is right-censored — a completed figure like 2882 ms is exact, but the *largest* number the run can produce is capped at the wall, and `T-LINT-1`'s 4983 ms is a draw that came 17 ms from being capped; **(ii)** turbo terminates sibling tasks on first failure (landmine 1), so in a red run the other five packages die mid-flight and every test that *did* report reported under **less** contention — measured, red runs 35–40 s against green runs 57–61 s *(round 2)*. Revision 1's whole anchor rested on a censored maximum and came out **2.7× too small**. Apply a generous provisional budget first, measure, then derive.
5. **`turbo`'s CLI `--concurrency` beats `TURBO_CONCURRENCY`, silently.** `TURBO_CONCURRENCY=10 turbo run … --concurrency=2` runs at **2** and prints nothing about it, and a duplicate `--concurrency` is a hard error. Two round-1 reviewers reproduced it independently, and it turned revision 1's "uncapped" acceptance block into a second copy of the capped one. Relevant here even with no cap shipping, because it is exactly the shape of an unfalsifiable measurement — **and #110 will meet it head-on.**
6. **A timeout is a ceiling, not a target** (ADR-0055 decision 4). If a wall probe starts costing 15 s, that is a defect to diagnose and record, not a number to raise. The **40 000 / 25 000 ms** values must never be quietly bumped to make a red run green. **Nothing mechanical detects growth** — §5.2's re-read procedure is a human obligation, and its trigger list is **five** paths, not three: the wall suites, `eslint.config.mjs`, `binairo/generate.test.ts`, **`packages/games/src/binairo/**`**, and **the `eslint` / `eslint-config-next` / `typescript-eslint` versions** in the root `package.json`/lockfile. The last two are where drift actually comes from and neither fires on the first three; `.github/dependabot.yml` covers only `github-actions`, so those bumps arrive hand-written with no automation to catch them (F4). #106 is the first PR that owes the procedure.
7. **Local numbers are one box's numbers, and they grow with the sample.** Every contended-local figure here is from one 8-core WSL2 machine, in **three** sessions that disagree with each other about which test is worst — and whose maximum for the same test rose 4983 → 7907 → 9832 ms. Another dev box gives different numbers again. This is why D1 anchors on CI figures where they exist, why the anchor is pooled across sessions rather than replaced by the latest one, why §9 step 0 re-measures rather than citing, and why §10.1's `budget / 4` records rather than blocks.
8. **The box must be idle.** Steps 0, 10.1 and 10.3 are ~30 minutes of contention-sensitive measurement. A background build, a stray `next dev`, or a second agent invalidates them **silently** — the run is simply slower and the conclusion is wrong. `pgrep -af "next dev|turbo run dev|vitest|next-server"` empty and pasted, before each block. A `timeout 20 pnpm dev` in particular does **not** reliably kill turbo's persistent `next dev` children.
9. **`pnpm dev` dirties two tracked files** (m4). It rewrites `apps/api/next-env.d.ts` and `apps/web/next-env.d.ts` (`-import "./.next/types/routes.d.ts"` → `+import "./.next/dev/types/routes.d.ts"`). An agent that runs it for any reason and then commits carries them into a PR §8 declares touches six files. `git checkout -- apps/api/next-env.d.ts apps/web/next-env.d.ts`, and check `git status --porcelain` before every commit (exit 12).
10. **Three tests already sit at or over this ticket's own trigger and are NOT fixed here — [#109](https://github.com/fernandolisboa/miolos/issues/109).** `sudoku/generate.test.ts`'s `P1 — determinism` at 155 025 / 240 000 ms (**64.6 %**) and `P3 — weekday ramp` at 24 114 / 60 000 ms (**40.2 %**), plus `apps/web/test/nonogram-screen.test.tsx:406` at **2368 ms** *(round 1)* / **1959 ms** *(round 2)* against a bare 5000 ms default — 47.4 % and 39.2 %, **straddling** the trigger, and that file contains no timeout at all (`grep -c timeout` = 0). Covered, not comfortable, out of scope, **and filed** — because recording a residual only in a plan is what handoff 039 landmine 8 did about binairo `P2`, and it is why #107 exists.
11. **The concurrency cap is [#110](https://github.com/fernandolisboa/miolos/issues/110), not a forgotten idea.** Revision 1 shipped it; §5.1 gives the five measured reasons revision 2 does not. #110 carries every constraint already measured — the global-only `turbo.json` key, `pnpm dev` breaking below 3, flag-beats-env, percentages rounding to 1 on a 2-core runner, and the cold-cache requirement — so none of it is re-derived. **Do not re-open the question inside #107.**
12. **Do not spend `T-LINT-S47…S49`.** Pre-reserved by nobody, needed by neither ticket, and **claimed by #106**. Spending them would collide with a parallel ticket for no assertion (§11).
13. **`gh run view --log` is the source for CI test durations,** not the run summary — and its output carries literal `^[[NNm` sequences as two ASCII characters, not real escapes, so strip them with `perl -pe 's/\^\[\[[0-9;]*m//g'` (this is how §2.3's sweep was produced). A `cancelled` gate is a supersession, not a failure — read the newest run (napkin Execution item 10). **And it prints no hook durations at all**, in any reporter — the `hookTimeout` axis of D1's trigger has no instrument (§2.3, C5).
14. **`git checkout main` fails from this worktree, and §10.3 Block C depends on that (C3).** `main` is checked out in `/home/ferna/projects/miolos` while #107 and **#96** run in parallel worktrees, so git refuses — *"fatal: 'main' is already used by worktree at '/home/ferna/projects/miolos'"*, rc=128. Under revision 2, AC1's sole discharge failed at its first command. Block C runs from `/home/ferna/projects/miolos`, with the idle assertion taken there. **Do not "fix" this by removing a worktree** — `/home/ferna/projects/miolos-wt/96` belongs to another live ticket, and removing this one destroys #107's measurement history for nothing.
15. **A `pgrep -af` idle assertion matches its own shell.** Running the check inside a `zsh -c '…'` wrapper prints the wrapper's own command line, because the pattern appears in it. **Empty means "nothing but the assertion's own process"** — read the PIDs, do not read `rc`. Steps 0, 10.1 and 10.3 all depend on this being read correctly.

---

## 15. Execution order

One pull request. The work is small, the pieces are independent, and there is no deploy ordering — nothing here touches runtime code, the database, or a route.

| # | Commit | Contents |
|---|---|---|
| 0 | *(no commit)* | §9 step 0 — the pre-fix baseline at unmodified HEAD |
| 1 | `test: pin explicit timeouts on the two exposed Binairo properties` | `packages/games/test/binairo/generate.test.ts` (D3, D4) |
| 2 | `test: budget the three ESLint wall suites at file scope` | the three `apps/web/test/eslint-*-wall.test.ts` (D2, D5) |
| 3 | `docs: ADR-0055, plan 042, and the napkin's timeout standard` | ADR-0055, this plan, **both findings files under their `044-`/`045-` names**, `.claude/napkin.md`, `docs/README.md`'s four rows (§12) |
| 4 | *(no commit)* | **§9 step 6 — `git push -u origin fix/107-test-timeouts`, then `gh pr create` with the body §9 step 6 specifies** (R8). Then §10.5: read the PR's own `gate` run. The PR opens here; it merges at step 8 of CLAUDE.md's flow, after the reviewers and after every §13 row is green |

**Commits 1 and 2 both fire `.husky/pre-commit`, and commit 1 fires it with half the fix missing.** §9's disposition governs: a red on one of §2.2's five tests is recorded in the PR body and the commit is re-run; anything else is a stop; `--no-verify` is never available; and a green hook that says `Cached: 6 cached` is a replay, not evidence.

Commits 1 and 2 are independent and could be reordered; the sequence above is the one whose intermediate states are each individually verifiable by §9's per-step commands. Commit 3 lands last because ADR-0055's decision 1 records the corpus sweep and decision 2 records the anchor — and although §10.1 no longer forces a re-derivation, Block A can still produce a figure the ADR's own residual paragraph should name.

**After merge, before closing #107** — not a commit, but a required step (B2):

| # | Step | Contents |
|---|---|---|
| 5 | §10.3 Block C | **from `/home/ferna/projects/miolos`** (not the worktree — C3): the nvm preamble, `git checkout main && git pull && git log --oneline -1`, the idle assertion taken there, ten forced runs, output posted as a comment on #107 |
| 6 | §12.6 | the issue comment carrying the margin, the five corrections and the next-handoff obligation (§12.6) |
| 7 | close #107 | only with rows 5 and 6 done (exit criteria 5, 18) |

---

## 16. Findings dismissed, with reasons

**Round 2: none.** Every finding in `045-issue-107-research-review-round-2-findings.md` — **C1–C10, F2–F5, F7–F12, n-a, n-b** — is applied. *(The ids are listed as three runs rather than as "F2 through F12", which spans a gap: **there is no F6** in that document, and a range that names a finding nobody wrote is the kind of unchecked assertion §12 exists to catch.)* C7 is applied by taking **both** of its offered remedies (re-measured in §2.2 *and* the numeric range moved out of ADR-0055 into the PR body), because the re-measurement produced a third different range and thereby proved the second remedy's point.

**Round 1: two, both minor.** Everything else in `044-issue-107-research-review-round-1-findings.md` is applied.

- **Part of B5's evidence — the eleven-plus `apps/api` tests presented as over the 40 % line.** They are not. Every one of them carries `}, 30_000)` or `}, 40_000)`, verified line by line in §2.3, and the worst (`T-API-S3`, 11 256 ms) sits at 37.5 % of its own declared budget. The finding's own parenthetical said *"`apps/api`'s heavies are safe — they already carry `}, 30_000)`"*, so this is an overstated headline rather than a disagreement. **The finding's substance is fully accepted and acted on**: the sweep was genuinely never run, it is run now, and it changed ADR-0055's decision 1. Only the specific claim that `apps/api` violates the trigger is dismissed.
- **MAJ-1's second option — restating the multiplier as "×4 on the CI figure, ×2.5 on an uncapped local figure".** Dismissed as a repair; the finding's diagnosis is accepted in full and D2 re-derives — to 35 000 ms in revision 2 and to **40 000 ms** here. Reason in D1: ×2.5 has no derivation **and no precedent**, and exists only to make 7907 ms produce 20 000 ms. **Round 2 correctly pointed out that ×4 has no derivation either (C2), and D1 now says so outright** — the distinction that survives is precedent: ×4 is what ~25 shipped timeouts and the napkin already use, ×2.5 was fitted backwards from the answer it had to protect. That is a real distinction and it is now stated as the whole of the defence, rather than ×4 being presented as measured.
