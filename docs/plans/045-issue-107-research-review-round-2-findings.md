# Step-3 plan review, round 2 — issue #107, plan 042 revision 2

Two reviewers — correctness/evidence, records/AC/gate — against the real tree at `eea445e`.
**Verdict: 2 × REJECT.** Both say **step 4**, not a re-plan. The architecture, the scope split, the withdrawal of the cap, D3, D4, D5 and the records section all survive re-measurement.

---

## Confirmed sound — do not re-litigate

- **The ticket's entire claim re-verified, both directions.** Six forced root runs at unmodified HEAD: **6 red / 6**, every failure `Test timed out in 5000ms` (`T-LINT-S41` ×6, `T-LINT-S9` ×4). With the five edits applied, `pnpm exec turbo run test --force` ×6: **6/6 green**, `Tasks: 6 successful`, `Cached: 0 cached`. `pnpm typecheck` 6 successful, `pnpm lint` rc=0, `git diff | grep numRuns` empty, `packages/games` still config-free. **D6's amendment is correct: the timeouts close the ticket alone.**
- **The seven-hit corpus sweep is complete on the `testTimeout` axis.** Independently re-derived: exactly **28** tests ≥ 2000 ms on run `31888933252` (next is 1969 ms), partitioned 7 over / 21 under against each test's *own* budget, every budget re-read from the tree.
- **§16 dismissal (i) upheld.** Every `apps/api` test round 1 named carries its own `}, 30_000)` or `}, 40_000)` — checked line by line by both reviewers (`cron-publish.test.ts:335`, `:536`; `publishing-service.test.ts:213`; `completions.test.ts:1017`, `:2223`). Worst is `T-API-S3` at 37.5 %. Round 1's "11+ over the line" was overstated; the correction is right.
- **§16 dismissal (ii) upheld.** ×2.5 has no derivation and is fitted to preserve 20 000 ms.
- **All five round-1 blockers fixed.** B1: the flag>env trap is durably recorded in §12.3, landmine 5 and #110, and no executable step consumes the broken command (`package.json:13` verified `"test": "turbo run test"`, no flag). B3: `ADR-0017:21` verified true as written, and #110's body carries the annotation obligation. B4: `ci.yml` untouched, listed under "Explicitly NOT touched". B5: real sweep. B2 fixed except C3 below.
- **All four §12.4 sweeps reproduce hit-for-hit**: `turbo` → `0027:151`, `0054:338`, `0054:975`; `pnpm test` → `0017:7`, `0017:21`; `testTimeout|TURBO_CONCURRENCY|concurrency` → none; `timeout` → `0043:301`, `0054:319`, `0054:1016`.
- **D5 binds at the value it ships** — `T-LINT-S41` at 9832 ms and `T-LINT-S9` at 8520 ms both passed, impossible without the file-scoped budget in force. Non-leakage correctly cited as settled (`isolate: true`, distinct PIDs), type citations exact (vitest 4.1.10).
- **`nonogram-screen.test.tsx:406`** verified exactly: 2368/5000 = 47.4 %, `grep -c timeout` = 0. This session's local max was 1959 ms (39.2 %), straddling the trigger — which makes #109's "one CI figure decides it" the right disposition.
- **AC2 / AC3 clean.** Five timeouts, five arithmetic comments; `numRuns` 150/100 byte-unchanged; ADR-0023's floor real. Arithmetic verified: isolated×4 row, the +55 % makespan, 26+25+6 = 57 `it`s, 1102 − 57 = 1045, the three `new ESLint({…})` blocks byte-identical.
- **AC1 really is local-only** — `ci.yml` is `pull_request`-triggered with no `push: [main]`.
- **#109 and #110 exist, are `ready-for-agent`, and carry their measured constraints.**
- **§5.2(a)'s gate argument is correct**: the 5000 ms default was never a chosen check but vitest's default applied by accident; all six suites still run, all 1840 tests still run, every assertion byte-identical. Replacing an accidental default with a derived budget on 57 of 1102 tests **strengthens** the signal. The contrast against rejected option D (identical latency cost for 1045 unrelated tests) is the plan's most gate-protective reasoning. The residual is named three times in the words round 1 asked for.

---

## Blocker

### C1 — D2's 35 000 ms is falsified by re-measurement, and the plan's own exit criterion 6 rejects it.

Re-measured this session by the plan's own procedure (whole suite, `--force`, idle box, take the max), timeouts applied, uncapped:

| test | r1 | r2 | r3 | r4 | r5 | r6 | **max** | plan's anchor |
|---|---|---|---|---|---|---|---|---|
| `T-LINT-S41` | 5411 | 7244 | 8373 | 7353 | 7059 | **9832** | **9832** | 7907 |
| `T-LINT-S9` | 5423 | **8520** | 8360 | 7567 | 6090 | 4343 | **8520** | 6680 |
| `T-LINT-1` | 3012 | 2755 | 2532 | 2876 | 2936 | 3537 | 3537 | 2856 |
| binairo `P1` | 4278 | 5051 | 4023 | 3889 | 3563 | 4182 | 5051 | 4663 |
| binairo `P2` | 4502 | 5281 | 5054 | 4945 | 5497 | **5922** | **5922** | 5696 |

**7907 ms does not reproduce as the maximum — it is exceeded twice, by two different tests.** D1 applied verbatim to the pooled eleven samples: `9832 × 4 = 39 328 → 40 000 ms`.

And §10.1's pre-merge rule (*"if any of the five exceeds `budget / 4` — 8750 ms — the budget is re-derived before the PR merges"*) **fires on run 6 of 6**, with `T-LINT-S9` at 97.4 % of it. Over Block A's ten runs that is a near-certain trip, not a check with margin.

This is MAJ-1 recurring one revision later by the same mechanism: 4983 (censored) → 7907 (n=5) → 9832 (n=11).

**Fix.** Re-derive to **40 000 ms** from the pooled samples and move every dependent number: D2's arithmetic, the three comments in §8, ADR-0055 decision 2, §10.1's threshold (10 000 ms), exit criterion 6. **D3's 25 000 ms survives** — `5922 × 4 = 23 688 → 25 000` — and should be labelled *re-confirmed at n=11*, not re-derived.

---

## Majors

### C2 — the max-of-N estimator is not converging, and D1 says so before using it.

Three sessions, three anchors: **4983 → 7907 → 9832**, each larger. D1's own definition writes the reason down — *"the max of three draws from a heavy-tailed scheduling distribution is a sample, not a maximum"* — and then prescribes that estimator, D2 consumes it, ADR-0055 decision 2 ships it as binding policy, and §10.1 makes `budget / 4` a **pre-merge blocker**. A trip-wire set at the sample max of a distribution whose sample max keeps climbing fires on every future ticket touching these files — the opposite of decision 4's *"a defect to diagnose"*.

Related: **×4 is a retained convention presented as derived.** §16 rejects ×2.5 for having no derivation, but ×4 has none either — it comes from the napkin's *"CI runners are ~3-4× slower"*, a **cross-machine** factor this plan falsifies, now applied to an already-contended local figure. The honest defence is the shipped precedent at `free-play-sudoku.test.tsx:135-140`, and that one is ×3 by the plan's own reading.

**Fix (decided, per the orchestrator):** re-derive to 40 000, **write the residual into D1 and ADR-0055 decision 2 in those words** — the anchor is a sample maximum from a heavy-tailed distribution, a later session may exceed it, and that is what the multiplier and the round-up-to-5000 absorb. Demote `budget / 4` from a merge blocker to the **diagnose-and-record** obligation decision 4 already calls it. Say plainly that ×4 is retained for continuity with the shipped corpus, not measured.

### C3 — §10.3 Block C cannot run from the directory §9 mandates. AC1 never gets discharged.

§9: *"All commands are run from `/home/ferna/projects/miolos-wt/107`."* Block C opens `git checkout main && git pull`:

```
$ git checkout main
fatal: 'main' is already used by worktree at '/home/ferna/projects/miolos'
rc=128
```

Block C is the **sole** discharge of AC1, the sole fix for round-1 B2, and what exit criterion 5 and §15 row 6 make step 8 unable to skip. It fails at its first command. *(This is a consequence of running #107 and #96 in parallel worktrees — the constraint is real and must be written into the plan rather than assumed away.)*

**Fix.** State the directory explicitly: Block C runs from `/home/ferna/projects/miolos` (or the worktree is removed first), the `pgrep` idle assertion is taken there, and `git log --oneline -1` shows the squash commit.

### C4 — binairo `P3`'s exemption is argued on one of the two axes D1's trigger names.

D1's trigger is *"contended local **or** measured CI"*. `P3` is exempted at **11.6 %** — the CI figure only — and D1 leans on it: *"it rejects twenty-one, including binairo `P3` (581 ms, 11.6 %). That is a threshold doing work."* The contended-local figure was in exactly the prescribed run and never taken:

```
binairo P3, uncapped contended local, 6 runs:
  742  875  1776  1730  1151  339 ms   → max 1776 ms = 35.5 % of 5000
```

Under the trigger, but by 4.5 points, not 28. The one test used to show the threshold rejects things was argued from the smaller of two available numbers.

**Fix.** State both axes and say `P3` clears at 35.5 %. If the argument is weaker, it is weaker — the sweep's credibility is §2.3's point.

### C5 — the sweep covers only the `testTimeout` axis while the trigger governs `hookTimeout` too, and §12.2 has a concrete casualty.

D1's trigger explicitly reads *"(2000 ms against the 5000 ms `testTimeout`, **4000 ms against the 10000 ms `hookTimeout`**)"* and decision 1 claims the rule *"was swept against the whole corpus"*. The sweep is `grep -E '✓ .* [0-9]+ms'` over the gate log — **vitest prints no hook durations, so the hook half is invisible to it.** Real hooks with real budgets exist: `cron-publish.test.ts:148`, `publishing-service.test.ts:129`, `completions.test.ts:85`, all `}, 30_000)` top-level `beforeAll`.

The casualty: napkin item 8's **headline** names a different flake class — *"Pre-commit's full suite flakes under turbo's parallel fan-out (**PGlite `beforeAll` timeouts**, non-deterministic)"* — and §12.2 correctly says *"do not claim this ticket fixed it"*, then in the same section deletes the `TURBO_CONCURRENCY=1` workaround because *"after this PR it does not [flake], at any concurrency"*. Both cannot stand.

**Fix.** Narrow decision 1 to *"swept on the `testTimeout` axis; the `hookTimeout` axis is unswept because vitest prints no hook durations"*. Reword §12.2: the `testTimeout` population is fixed and measured; item 8's PGlite hook class is untouched and unmeasured; the removal of `TURBO_CONCURRENCY=1` rests on the first. Say which failure classes *"a red root `pnpm test` is a finding again"* covers.

### C6 — the structural explanation for the 2.7× error is a non-sequitur, and the correct argument is one landmine away.

*"A test that dies at the wall REPORTS the wall, so **every** pre-fix figure is a lower bound"* ships verbatim into napkin item 4 and ADR-0055 decision 2. The premise is true; the inference is not — a test that **completed** at 2882 ms was never killed, and 2882 ms is exact. What is censored is the **sample maximum**: the distribution is right-censored at 5000, so the observed max understates the true max.

The valid route to "every figure in a red run is biased low" is sitting in landmine 1: *"Turbo terminates sibling tasks on the first failure."* In every red pre-fix run the other five packages are killed mid-flight, so everything that did report reported under **less** contention. The data shows it directly:

```
pre-fix (all 6 red):    38  40  35  37  37  37 s
post-fix (all 6 green): 57  58  59  60  59  61 s
```

Red runs are ~35 % shorter because turbo killed the siblings. **This also makes §10.4 Block D's "median elapsed" column meaningless** — it would compare a truncated red run against a complete green one and report the fix as a ~55 % slowdown.

**Fix.** Restate as *"the pre-fix sample maximum is right-censored at the wall"*, add the sibling-termination reason, propagate to landmine 4, napkin item 4 and ADR-0055 decision 2. Drop or relabel §10.4's elapsed column.

### C7 — the isolated→CI factor range shipped into ADR-0055 is from an uncommitted scratchpad and does not reproduce.

Decision 2's only concrete measurement claim is *"isolated→CI ×4.3 to ×10.9"*, and §12.1 writes *"`T-LINT-1` 383 ms isolated → 4186 ms on CI (×10.9)"* into the napkin. Every isolated figure is `(step 1)`. Re-measured:

```
T-LINT-1     458ms  (plan 383)  → ×9.1   (plan ×10.9)
T-LINT-S9    516ms  (plan 444)  → ×5.6   (plan ×6.6)
T-LINT-S41   518ms  (plan 457)  → ×6.7   (plan ×7.0)
binairo P1   613ms  (plan 649)  → ×5.3
binairo P2   721ms  (plan 620)  → ×3.7   (plan ×4.3)
```

Real range **×3.7 to ×9.1**, not ×4.3 to ×10.9 — and ×3.7 falls *inside* the napkin's "3-4×" claim the plan is falsifying, weakening that half for binairo. The plan's own provenance rule says `(step 1)` figures are retained *"where nothing better exists"*; something better existed for one `vitest run` per file. The headline conclusion survives (458 × 4 = 1832 against a measured 4186 is still a 2.3× under-shoot).

**Fix.** Either re-measure in §9 step 0 and relabel `(verified)`, or apply MAJ-8's own remedy and take the numeric range **out** of decision 2 into the PR body. Keep the qualitative claim.

### F2 — §12.7's handoff enumeration is falsified, and `docs/handoffs/` was never swept.

§12.7 says *"Handoffs 039 and 041 … **Three** of their statements become historical"*, and §12.9 row 13's hit is *"three named sentences"* — inside the section billed as the two-way instrument. The sweep was never run:

```
034:52   **`TURBO_CONCURRENCY=1` on every `git commit`**…
036:49   All of handoff 034 §3 stands (nvm preamble; `TURBO_CONCURRENCY=1` on every commit…
038:89   **`TURBO_CONCURRENCY=1` on every commit and on any gate run you paste as evidence.**
039:83   All of handoff 038 §3 stands…
041:69   All of handoff 038 §3 and 039 §3 stand…
019:259  **CI runners are ~3–4× slower than local, and vitest's default per-test timeout is 5 000 ms…**
021:160  **CI runners are ~3–4× slower than local; vitest's default per-test timeout is 5 000 ms.**
```

**At least eight statements across five handoffs**, and 034 → 036 → 038 → 039 → 041 form an explicit *"all of §3 stands"* chain that re-ratifies `TURBO_CONCURRENCY=1` into the current session's standing instructions. The *disposition* survives (snapshots are not edited; the living copy is napkin item 8, which §12.2 corrects) — but this is round-1 B3's pattern one corpus over.

**Fix.** Run the sweep, put the real hit list in §12.7 and §12.9 row 13, add a backward row. Then add the consequence: **the next handoff must explicitly break the `TURBO_CONCURRENCY=1` chain**, because five documents each say the previous one's §3 stands and one sentence in a plan is not enough weight against that.

### F3 — D4's "only two of the six carry an arithmetic comment" is false.

`packages/games/test/sudoku/generate.test.ts:93-95` carries one (*"local P2 ~9s → allow 4x + the same margin as P1"*). **Three of six** carry arithmetic (`:61`, `:95`, `grade.test.ts:174`); the three bare ones are `generate.test.ts:114`, `:126`, `grade.test.ts:186`, all `}, 60000)` — so the *"`/ }, 240_000);`"* half is wrong too. Revision 2 corrected round 1's m1 (four → six, right) and introduced a fresh false verification claim in the same paragraph.

**Fix.** *"Three of the six carry an arithmetic comment; the three bare ones are all `}, 60000)`."* The argument survives.

### F4 — decision 4's drift procedure misses both real drift sources.

The trigger is *"any PR touching the three wall suites, `eslint.config.mjs` or `binairo/generate.test.ts`"*. But §2.4 says the wall cost is the first `lintText` loading the flat config *"and everything `eslint-config-next/core-web-vitals` and `typescript-eslint` pull in"*. **A bump to `eslint` (10.8.0), `eslint-config-next` (16.2.12) or `typescript-eslint` (8.65.0) is the dominant drift source and touches none of the five paths** — and `.github/dependabot.yml` covers only `github-actions`, so those arrive as hand-written PRs with no trigger at all. Symmetrically, binairo's cost lives in `packages/games/src/binairo/`, not its test file.

This is the load-bearing half of the gate answer: the procedure replacing the removed ceiling does not fire on either thing that causes drift.

**Fix.** Extend the trigger to `packages/games/src/binairo/**` and to any change to those three dependencies in the root `package.json`/lockfile — in decision 4, §5.2(b) and landmine 6 alike.

### F5 — the "population maximum" rule that produces *both* headline numbers is nowhere in ADR-0055.

40 000 comes from `max` over the **trio**, 25 000 from `max` over the **pair**. Decision 2 says *"the highest measured figure"* — per test. Decision 3 is file-scoping *within* a file. Nothing binds a future agent to size a fourth wall suite at the trio's maximum. The rule lives only in plan 042 §3, which CLAUDE.md defines as a point-in-time snapshot — exactly what §12.4 argues an ADR exists to prevent.

**Fix.** Add to decision 2: where several tests share one cost driver and their per-test ordering is unstable between sessions, they are one population and all take the population maximum. Cite the reversals (`T-LINT-1` worst in step 1, best now; `P2` 5696 vs `P1` 4663).

### F7 — `042-review-round-1-findings.md` breaks `docs/README.md`'s naming convention, and §12.9 row 9 did not check it.

The convention is `NNN[-issue-<n>]-<type>-<slug>.md` with a **single shared sequence** (*"next free number wins"*) and `<type>` ∈ {`handoff`, `brief`, `plan`, `spec`, `research`}. The file **reuses 042** and uses type `review`. §8 commits it, §12.5 gives it a README row, exit criteria 1 and 13 require it — and row 9's hit is only *"the rows are absent from the Current table"*. The convention itself was never checked, for a file the plan creates. *(The same applies to this round-2 findings file.)*

**Fix.** Either renumber both findings files to the next free numbers with a canonical type, or amend `docs/README.md`'s `<type>` list to include `review` in the same PR and say so as a forward row. Do not ship a new document class silently.

---

## Minors and nits

- **F8** — ADR-0055 decision 1's count does not add up: *"seven hits, five fixed here, three residuals"*. 7 = 5 + 2. The third residual is the **local-axis** hit §2.3 says the CI sweep cannot see. Correct everywhere else; wrong in the sentence that ships into the durable record.
- **F9** — ADR-0055 carries measurements its own Consequence 4 forbids (*"the measurements do not live here"*): decision 1's sweep counts, decision 2's ×4.3–×10.9 range, decision 4's 8750/6250. Defensible for decision 1 (the sweep *is* the warrant); not for the factor range or derived thresholds. State decision 4's threshold only as `budget / 4`.
- **F10** — #110 does not carry the decision-2-rewrite obligation. §3 D1 step 5 and ADR-0055's second consequence both say a shipped cap *"owes this procedure a rewrite in the same PR"* (a capped `pnpm test` produces smaller numbers and would under-size the next timeout). #110 carries the ADR-0017 annotation and the fifth-decision obligation but not this one.
- **F11** — the proposed napkin item 4 is ~200 words against a file whose item 4 is two lines and whose longest item is one paragraph. Name the two clauses that must survive at any length (anchor-is-never-isolated; pre-fix-figure-is-censored) and let ADR-0055 carry the rest.
- **F12** — #109 and #110 are `ready-for-agent` while blocked, with `Blocked by #107.` as the **last** line. `docs/agents/issue-tracker.md` puts it at the **top** of the child body. No issue in this repo currently uses GitHub's native dependency edges, so the prose line matches practice — but an agent scanning `ready-for-agent` picks up #109 and finds ADR-0055 does not exist.
- **C8** — §10.2's equivalence sentence claims more than its diff shows: the diff shows the branch differs from `origin/main` *at the moment it ran*, not what a later squash produces. Non-load-bearing because Block C measures real post-merge `main`. State what the diff shows and let Block C carry the claim.
- **C9** — §8's `numRuns` line numbers will be false once the edit lands: the plan's own comment shape inserts four lines into `P1`, so `{ numRuns: 100 }` moves to `:80`. The criterion that runs (`git diff | grep numRuns`, empty) is satisfied. Drop the line numbers.
- **C10 / n-c** — the `daily-contract.test.ts:133-155` row is missing its path and is in the wrong package: it is **`packages/core/test/`**, not `apps/api`. The only row in a fifteen-row table with no path, in a section whose point is that a sweep names its hits.
- **n-a** — §2.1's *"verified, whole file is 11 lines"* for `apps/web/vitest.config.ts`: `wc -l` returns **10**.
- **n-b** — §2.3 cites `sudoku-hint.test.ts:216`; the `it(` is at `:214`, the name at `:215`. *(Every other citation spot-checked across both reviews is exact — the wall suites, the six games timeouts, `free-play-sudoku.test.tsx`, `sudoku-screen.test.tsx`, `publishing-service.test.ts`, `cron-publish.test.ts`, `completions.test.ts`, `package.json:13`, `ci.yml:91`, `turbo.json:3`, `CLAUDE.md:64`, `test-ids.md:42`, `eslint.config.mjs` 718 lines.)*
