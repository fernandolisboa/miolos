# Step-3 plan review, round 1 — issue #107, plan 042

Three reviewers — correctness, records/ADR, issue/gate — all run against the real tree in `/home/ferna/projects/miolos-wt/107` at `eea445e`.
**Verdict: 3 × REJECT.** All three said **step 4 (fix the plan)**, not a re-plan: the measurement work and the architecture hold.

Point-in-time record, input to the fix round.

---

## The plan's core judgements are confirmed. Do not undo these.

- **The fix works.** Baseline at unmodified HEAD: **3 red / 4** (`T-LINT-S9`, `T-LINT-S41`, all `Test timed out in 5000ms`). With the plan's changes simulated: **6/6 green capped, 5/5 green genuinely uncapped — 11/11.**
- **`vi.setConfig` at file scope binds and does not leak** — the plan's own designated falsifier passes. Order pinned via an append-to-file probe:
  ```
  A load pid=49020   <- file WITH vi.setConfig({testTimeout: 20_000}), runs FIRST
  B load pid=49032   <- untouched file, runs SECOND
  ✓ zz-probe-a-setconfig.test.ts > A1 sleeps 6000ms 6007ms
  × zz-probe-c-default.test.ts  > B1 sleeps 6000ms  5008ms   Error: Test timed out in 5000ms.
  ```
  **Structural reason the plan never found:** the two files ran in **different PIDs even at `fileParallelism=false`** — the default forks pool with `isolate: true` gives every file its own child process, so cross-file leakage is not merely unobserved, it is impossible under this repo's config. D5 stands and the `describe`-options fallback is not needed.
- **D7's turbo veto is true, both halves.** `pnpm exec turbo run dev --concurrency=2` → `x You have 2 persistent tasks but turbo is configured for concurrency of 2`. With `"concurrency": "2"` injected into `turbo.json`, a bare `turbo run dev` gives the identical error — the key is global. `node_modules/turbo/schema.json` carries `concurrency` at `/properties` and `/definitions/GlobalConfig/properties` and **nowhere per-task**.
- **The cap really is faster.** Same tree, back to back: capped 44/44/43/43/43/43 s; uncapped 58/58/56/58/59 s.
- **Every §2.2 CI figure is exact**, re-read from run `31888933252`: 4186 / 3477 / 2915 / 3246 / 2667 / 581 ms, `Time: 5m30.276s`, `Cached: 0 cached, 6 total`, typecheck 28.727 s, build 42.566 s, all six per-package Durations. The `(verified)` labels are honest and nothing is fabricated.
- **ADR compliance holds.** `packages/games` has only `package.json` + `tsconfig.json` (ADR-0017 safe); `numRuns` 150/100/25 untouched (ADR-0023); ADR-0017's reason quoted exactly; option E correctly rejected on comment-less-JSON grounds rather than smuggled in as literal compliance.
- **The `[ELIFECYCLE]` trap is real** (landmine 1 confirmed): `@miolos/games:test: [ELIFECYCLE] Test failed.` with **zero** `FAIL` blocks and no summary, while turbo's verdict is `Failed: @miolos/web#test` alone.
- **Structural facts:** 5 top-level describes in `eslint-db-wall.test.ts` (84/630/692/763/839), 1 each in the other two; one `vitest.config.ts` repo-wide; `.husky/pre-commit` and `ci.yml:91` both run bare `pnpm test`; `T-LINT` next-free `S47`, claimed by #106; `packages/games` carries no test ids; napkin timeout rule **is** Execution item 4, quoted verbatim correctly.
- **§7's rejection of option D is the single most gate-protective decision in the plan** — it declines a one-line fix that would have weakened the 5 s signal for 1,045 unrelated tests. Keep it.
- **The provenance discipline** — `(verified)` vs `(step 1)` on every number, with re-measurement before any edit — is the correct response to handoff 041 §4.

---

## Blockers

### B1 — §10.2 Block B does not uncap anything. **Two reviewers, independently, both reproduced it.**

Block B runs `TURBO_CONCURRENCY=10 pnpm test --force` and is described as *"the direct test of the timeouts alone, at the fan-out that produced the original failures."* Once `--concurrency=2` is on the root script, **the CLI flag beats the env var**:

```
$ TURBO_CONCURRENCY=10 pnpm exec turbo run dev --concurrency=2
  x You have 2 persistent tasks but `turbo` is configured for concurrency of 2.
```

turbo used **2**, not 10. Run as specified, Block B produced **42–44 s × 5** — identical to Block A. Only `pnpm exec turbo run test --force` moved the runs to 56–59 s.

So Block B re-runs Block A, prints five greens, and "proves" the timeouts stand alone having tested nothing but the cap. **Exit criterion 5 is unfalsifiable.** This is the laundering failure mode the ticket exists to remove, reintroduced inside its own acceptance evidence.

The obvious repair is also closed: `--concurrency` twice is a hard error —
```
$ pnpm exec turbo run dev --concurrency=2 --concurrency=10
 ERROR  the argument '--concurrency <CONCURRENCY>' cannot be used multiple times
```
so D7 as drafted makes the cap **non-overridable** on the repo's primary command, and §12.3's planned napkin clause (*"turbo has both `--concurrency` and `TURBO_CONCURRENCY`"*) would be written into the runbook as guidance that is now false for `pnpm test`.

**Fix.** Either (a) Block B runs `pnpm exec turbo run test --force` (§10.2's own prose already names `turbo run test`; only the command is wrong), or (b) D7 ships `"test": "TURBO_CONCURRENCY=2 turbo run test"`, which keeps the cap, keeps `pnpm test --concurrency=10` working as a real override, and does not error on a duplicate flag. Either way: state the precedence (flag > env) in §12.3, add a landmine, and re-check D8's rollback branches against it.

### B2 — AC1's "on `main`" is never addressed, and is unsatisfiable as planned.

The issue's AC1 is *"`pnpm test` from the root passes **10 consecutive forced runs on `main`**, output pasted."* The plan quotes it verbatim and then silently substitutes branch runs. `main` appears 19 times in the plan and **not once** in connection with the AC runs; §13 stops at merge and §15's last commit is the `ci.yml` revert. CI cannot supply it either — `ci.yml` triggers on `pull_request` only (no `push: [main]`), so AC1 is inherently a **local** measurement that exists only if someone performs it.

**Fix.** (a) State in §10.1 that Block A runs on the branch and that the branch's test-relevant tree is identical to what the squash merge puts on `main`. (b) Add a step **after merge and before closing #107**: `git checkout main && git pull`, re-run the ten-iteration loop, paste the output in the closing comment. (c) Add it to §13 as an exit criterion and §15 as a post-merge row, so step 8 cannot close the issue without it.

### B3 — §12.4's "no ADR claims anything about turbo or the test command" is falsified by ADR-0017, the ADR this plan quotes twice.

`docs/adr/0017-vitest-and-fast-check-are-the-test-stack.md:21`:
> Every workspace with tests carries `vitest` and a `test: "vitest run"` script; **Turbo fans out `pnpm test`**.

and `:7`: *"the mechanical gate depends on one from the first ticket: **`pnpm test` full suite**"*.

The plan's enumeration (*"the only hits for turbo are ADR-0027's passing mention and ADR-0054's `build.env` allowlist"*) is wrong, and the plan proposes to write that enumeration **into ADR-0055 as a verified clearance**. That is the handoff 041 §4 pattern committed in the paragraph that cites handoff 041 §4.

*(Note: one reviewer's sweep, run for `testTimeout`/`TURBO_CONCURRENCY`/`turbo run test`, came back clean and reported §12.4 as verified. The records reviewer's sweep, run for `turbo` and `pnpm test`, found the above. **The records reviewer is right — resolve by re-running both sweeps and recording the real hit list.**)*

**Fix.** Record the real hits. Then decide ADR-0017 explicitly: an annotation on its consequence line ("fan-out is capped at 2 as of ADR-0055"), or a written reason why "fans out" survives a cap. Do not ship the "none" sentence.

### B4 — D9's premise is false: the tree already records CI's core count, in the sibling of a file this plan edits.

§5 D9: *"Nothing in the repo records it [CI's core count]… An ADR must not record an inference as a fact."*

`packages/games/test/sudoku/generate.test.ts:58-60`:
```
    // CI runners run ~3-4x slower than dev machines; local P1 ~18s → allow
    // 4x + margin (60s timed out twice on GitHub's 2-core runner); numRuns
    // floor per ADR-0023. In-file pin because ADR-0017 forbids a vitest config.
```
`grep -rni "2-core\|nproc" --exclude-dir=node_modules .` returns exactly one non-plan hit, and it is that line.

D9 is the plan's riskiest and most expensive step — a temporary `.github/workflows/ci.yml` mutation, a revert commit, an extra gate cycle, plus exit criterion 10 and landmine bookkeeping — all justified by a premise the tree falsifies. Trace what consumes the number: D7's `--concurrency=2` comes from local timings, not a core count; D8 settles the CI effect empirically from the gate's own `Time:`. **Nothing depends on it.** The choice of 2 is unchanged whether the runner has 2 cores or 4, which is itself the proof.

**Fix.** Drop D9 and drop the core-count clause from ADR-0055's recorded facts. If the number is genuinely wanted, get it **without touching this PR's `ci.yml`**: push a throwaway branch with a scratch workflow, open a PR, read the run, close it unmerged. Questions 7 in §6 and exit criteria 10/15 change either way.

### B5 — the 40 % trigger was never swept against the corpus. The "P3 is the control" argument is false on the run the plan read.

D1's *"Why 40 %"*: it *"selects the five that flake and rejects binairo `P3`… `P3` is the control that shows the threshold is doing work rather than selecting everything."* The threshold is 2000 ms against the 5000 ms default. On run `31888933252` itself, `apps/api` alone carries at least eleven more over the line:

```
✓ T-API-S3: tops up a partial buffer of every game, existing rows untouched (D14)   11256ms
✓ T-API-S7: a date whose generation always fails lands in failures…                  6240ms
✓ T-API-S4: a tuned-low depth is healthy for every game, not alarming (A3)           3473ms
✓ T-API-S2: a second run generates nothing for any game (idempotent reconciliation)  3365ms
✓ T-API-S12: a wrong sudoku grid ⇒ 422; future and killed ⇒ 404…                     3277ms
… (11+ before the list is exhausted)
```

And under uncapped contention, one with **no** explicit timeout at all: `apps/web/test/nonogram-screen.test.tsx:406` — *"renders one labelled rail per row and per column"* at **2368 ms**, 47 % of budget, `grep -n timeout` on that file returns nothing.

*(`apps/api`'s heavies are safe — they already carry `}, 30_000)`; `sudoku-hint.test.ts` carries `HEAVY = 120_000`.)*

ADR-0055 decision 1 would ship a repo-wide rule the repo does not satisfy on day one. This is "sweep the PR's own additions" (handoff 041 §4) run in the other direction and not run at all: a **new repo-wide policy obliges a sweep of what it now governs.**

**Fix.** Either (a) sweep the gate log once for every test above 40 % of its applicable default — the data is a by-product of Block B, one `grep -E '✓ .*[0-9]{4,}ms'` over the logs — and record the list in ADR-0055 as the known baseline (fixing none of them is fine; **naming** them is the point); or (b) narrow decision 1 to bind prospectively on tests newly written or newly touched, with existing violations listed as known residuals alongside landmine 9. Rewrite *"Why 40 %"* against the real selection set and drop the `P3`-as-control claim.

---

## Majors

### MAJ-1 — D2's 20 000 ms violates D1's own arithmetic. The anchor is under-sampled by ~2.7×.

The trio is anchored on `T-LINT-1`'s 4983 ms (step 1, max of three samples). Five **genuinely uncapped** runs with the timeouts applied, same box, this session:

| test | plan's contended anchor (step 1) | measured worst of 5 |
|---|---|---|
| `T-LINT-S41` | 2882 ms | **7907 ms** |
| `T-LINT-S9` | 2670 ms | **6680 ms** |
| `T-LINT-1` | 4983 ms | 2856 ms |
| binairo `P1` | 4896 ms | 4663 ms |
| binairo `P2` | 4123 ms | **5696 ms** |

D1 says `budget = 4 × max(measured)` rounded up to the next 5000. Applied to 7907 ms that is **35 000 ms**, not 20 000. And `T-LINT-1` — the one test the whole D2 anchor rests on — is now the *cheapest* of the trio locally. ADR-0055 would ship decision 2 as binding policy in the same PR that breaks it on its own headline number.

This cuts **for** D2's structural argument (one number for one population, because per-file ordering is a scheduling accident) and **against** its specific value. 20 000 ms is empirically fine — 2.5× over 7907 ms, all 11 post-fix runs green. It is a rule-versus-number consistency defect, not a demonstrated flake.

**Fix.** Either re-derive the trio's number from freshly measured uncapped figures (→ 35 000 ms), or amend D1 so the multiplier is explicitly *"×4 on the CI figure, ×2.5 on an uncapped local figure"* and say so. Do not ship an ADR whose decision 2 the same diff contradicts. **D3's 25 000 ms survives**: `max(5696, 5165) × 4 = 22 784 → 25 000`.

### MAJ-2 — no path exists by which the anchor can be corrected, because a timing-out test's cost is censored.

§9 step 0 measures the *unmodified* tree, where a test that dies at 5000 ms reports 5000 ms — its true contended cost is structurally unobservable. The only place the real number appears is Block B (which is why MAJ-1's 7907 ms exists at all). But §10.2 re-derives D1 only *"if any uncapped run goes red"*. A green Block B at 39.5 % of budget produces a correct-looking answer and silently discards the measurement showing the anchor was wrong.

**Fix.** Make Block B's per-test durations a required, pasted input to D1's arithmetic and to ADR-0055 decision 2 — not just a pass/fail tally: *"paste the five tests' durations from every uncapped run; if any exceeds `budget / 4`, the budget is re-derived before merge."*

### MAJ-3 — the PR's own CI evidence will most likely be a cache replay, and D8's decision rule has no cache guard.

`ci.yml:91` runs a bare `pnpm test` — **no `--force`** — after `actions/cache/restore` of `.turbo/cache` (`:82-88`), and cache warmth accrues across pushes to the same PR (napkin item 10). §15's commits 5 and 6 touch only `docs/`, `.claude/napkin.md` and `.github/workflows/ci.yml` — none inside any package's turbo hash (`globalDependencies` is `["tsconfig.base.json"]` only). **So the last gate run of this PR — the one `protect-main` actually gates the merge on — will report the test task as cached.**

§10.4 asks for the `pnpm test` step's `Time:` and exit 15 asks for the five tests' new CI durations; both are unobtainable from a replay. The 5m30.276 s baseline is `Cached: 0 cached, 6 total`; a warm comparison is incomparable and biased *toward* "≤ +20 %, keep the cap". The plan's own landmine 2 states this rule for local runs and never applies it to the CI half.

**Fix.** D8 step 1 must require the compared gate run to show `Cached: 0 cached, 6 total`, quoted in the PR body, or the comparison is void and a cold run is needed. Exit criterion 15 must name **which** gate run executed (no `>>> FULL TURBO` on the test task), or reorder §15 so the `ci.yml` revert lands before a hash-invalidating change and the final run is cold. Extend landmine 2 to CI.

*(Assessment on the assigned question — is D8 acceptable engineering? In principle yes: a pre-committed, numeric, four-branch rollback ladder is the honest way to ship an unmeasured effect, and branch 4 is now well-supported by 5/5 truly-uncapped green. Not acceptable **as written**, solely because a rule is only as good as the measurement it consumes. Close MAJ-3 and D8 is fine.)*

### MAJ-4 — the napkin rewrite orphans ~25 shipped timeouts sized under the rule it declares falsified.

§12.1 replaces napkin item 4 because its ×4-off-local baseline under-shoots CI. Every timeout in the tree was sized by that rule and says so: `apps/api/test/account-delete.test.ts:38-41` (`}, 30_000`, and the same shape across ~20 `apps/api` files), `packages/games/test/sudoku/generate.test.ts:58-61` (`240_000`), `apps/web/test/sudoku-hint.test.ts:62` (`HEAVY = 120_000`), `apps/web/test/free-play-sudoku.test.tsx:135-140` (`20_000`, the very precedent D1 cites approvingly), `apps/web/test/sudoku-screen.test.tsx:704`.

A runbook item rewritten without a position on its own output is the record that rots.

**Fix.** One sentence in §12.1 and one in ADR-0055: shipped timeouts sized under the old rule stand until they flake, at which point they are re-derived under D1 — or whatever the real position is. State it.

### MAJ-5 — the gate-weakening question is never argued for the cap, and "a ceiling, not a target" ships with no mechanism.

`grep -n "weaken"` returns one hit, inside the *rejected* option D. CLAUDE.md's gate rule is never named. Two unargued weakenings:

1. **The cap** changes how the gate executes in pre-commit and CI. The plan argues speed and placement but never that gate *strength* is preserved. The argument is available and should be written: the cap removes a false red, not a check; all six suites still run; `Tasks: 6 successful, 6 total` is unchanged.
2. **The ceiling.** Landmine 6 and decision 7 both say *"a timeout is a ceiling, not a target… a test that grows into its ceiling is a defect to investigate."* Nothing detects growth. `T-LINT-1` can drift 4186 → 15 000 ms and stay green forever under a 20 000 ms budget.

**Compounding, and unnamed:** after this ticket **no runner anywhere executes `pnpm test` at full fan-out** — pre-commit, CI and every developer all take `--concurrency=2`, and Block B is a one-time pre-merge measurement leaving nothing standing behind it. Combined with a 4–5× budget, a wall suite degrading from 4 s to 15 s emits no signal of any kind.

**Fix.** Write the gate-strength argument explicitly for the cap. Write the residual into ADR-0055's consequences in those words, and give the next agent a **procedure** rather than an exhortation: re-read §2.2's CI duration table from the gate log whenever a wall suite or the root ESLint config is touched — **#106 is the first such occasion**, which makes it a live handoff rather than a hypothetical. Do not invent a new mechanical checker; do not leave the residual unwritten.

### MAJ-6 — D8 branch 4's cascade is under-specified, and the plan's own arithmetic predicts branch 4.

D8 says that if the cap is dropped, *"ADR-0055's decision 5 is rewritten before merge."* Dropping the cap also invalidates §12.2's napkin item 8 rewrite (whose premise is that pre-commit picks the cap up automatically and `TURBO_CONCURRENCY=1` is obsolete), ADR-0055 decision 6 (*"a red root `pnpm test` is a finding again"*), and §12.6's issue comment.

Worse, §2.2's own numbers make branch 4 likely: 1021.2 s of per-package work in a 330 s step; two lanes gives a makespan lower bound of `max(1021.2/2, 325.6) ≈ 510 s` if CPU-bound — **+55 %**, past D8's own ≤ +20 % keep threshold. D8 concedes *"anywhere between neutral and roughly +50 %"* and then writes a rule the arithmetic says will trip.

**Fix.** Enumerate the full branch-4 cascade (§12.2, decisions 5 **and** 6, §12.6), or reduce risk by making the cap a separate follow-up and shipping the timeouts — which is where the arithmetic points anyway.

### MAJ-7 — D1's restated trigger is not operationally well-formed, and this PR changes its answer.

> *"A test carries an explicit in-file timeout when its **contended local or measured CI** time exceeds **40 %** of the applicable default…"*

"Contended local" has no defined procedure: contended by what, at what concurrency, on what core count. And after D7 ships, `pnpm test` produces concurrency-2 numbers, not the uncapped six-way numbers every §2.2 figure was taken at. A future agent following the rule literally measures under the cap, gets smaller numbers, and under-sizes — the same class of error D1 exists to fix, one layer down.

**Fix.** Define the measurement: the command, the concurrency, the requirement that nothing else runs (landmine 12 already knows this), and state that CI is preferred because it is reproducible. This must be right in the napkin item and in ADR-0055 decision 2, which are the durable copies.

### MAJ-8 — ADR-0055's decision list: three bind, five are something else.

| # | Verdict |
|---|---|
| 1 (40 % trigger) | **Binds.** Keep — subject to B5. |
| 2 (anchor = highest measured, ×4, round to 5 s) | **Binds.** Keep — subject to MAJ-1. |
| 3 (file-scoped where one cost driver) | Binds weakly, a heuristic. Compress into 2. |
| 4 (`packages/games` stays in-file; no `numRuns` reduction) | **Not a decision — a citation of ADR-0017 and ADR-0023.** A second copy to keep true. Move to Context/Consequences. |
| 5 (root script caps at 2) | Binds **if it ships** — contingent on D8, see MAJ-6. |
| 6 ("a red root `pnpm test` is a finding again") | **A consequence**, largely restating CLAUDE.md's evidence rule. Move to Consequences. |
| 7 (ceiling, not target) | Binds. Keep — see MAJ-5.2. |
| 8 ("recorded facts": core count, `5m30.276s`, isolated→CI factors) | **Not a decision — a measurements appendix, and the fastest-rotting content in the document.** `5m30.276s` is stale the next time a test lands. Move to the PR body and the handoff. |

This is the plan's own diagnosis of the napkin turned on itself: §12.4 argues an ADR is needed because *"the napkin is a runbook — curated, capped… a policy that binds reviewers needs a record that does not get curated away"* — and then fills that record with a runbook's contents.

**Fix.** Ship 1, 2, 3 and 7 as decisions; 4 as a cited constraint; 6 as a consequence; 5 as a decision only once measured; 8 into the PR body and the next handoff.

---

## Minors and nits

- **m1 — D4's precedent count is wrong.** *"These four are the only in-file timeouts in the package (step 1, and consistent with what was read here)."* There are **six**: `generate.test.ts:61, 95, 114, 126` and `grade.test.ts:174, 186`. Four of the six carry **no arithmetic comment at all** (bare `}, 60000);`), so "the `grade.test.ts:174` idiom" describes 2 of 6, not the package convention — which strengthens the case for writing the arithmetic but must be said honestly. The parenthetical "consistent with what was read here" is a verification claim that is false.
- **m2 — `0056` is unsourced, asserted four times.** **Three reviewers raised this.** `grep -rn "0056"` returns nothing outside plan 042; `gh issue view 96` cites ADR-0031/0043/0053 and reserves no number; handoff 041:118 records only *"Next ADR **0055**"*. In a plan whose first section is a provenance rule, this is self-inflicted. Cite the reservation or drop the claim (§9 step 5, §12.4, exit 2, landmine 11).
- **m3 — §9 step 3's `--dry=json` dev check is not a check.** `--dry` bypasses persistent-task validation entirely and exits 0 at the very value D7 proves is broken. Delete the line; the adjacent `timeout 20 pnpm dev` is the real check and it works.
- **m4 — unrecorded landmine: step 3's `pnpm dev` dirties two tracked files.** It rewrote both `next-env.d.ts` (`-import "./.next/types/routes.d.ts"` → `+import "./.next/dev/types/routes.d.ts"`). An agent that runs step 3 and commits carries them into a PR §8 declares touches seven files. Append `git checkout -- apps/api/next-env.d.ts apps/web/next-env.d.ts` to step 3 and add a landmine.
- **m5 — §9 step 2b's probe is methodologically unsound as specified (and now moot).** "Run both files in one command" does not pin execution order, and **vitest's default sequencer runs previously-failed files first** — in three runs the untouched file executed first, giving a result that says nothing about the direction that matters. Replace step 2b with a citation of the settled evidence plus the `isolate: true` / distinct-PID reasoning, and drop the live probe (retiring landmine 4). If kept, it must pin order and assert the PIDs.
- **m6 — `timeout 20 pnpm dev` can orphan dev servers into the measurement blocks.** `timeout` kills `pnpm`; turbo's persistent `next dev` children are not guaranteed to die with it, and landmine 12 declares steps 0/10.1/10.2 contention-sensitive and 20–25 min long. Assert the box is idle (`pgrep -f "next dev|turbo run dev"` empty, pasted) before any measurement block.
- **m7 — D3's "`P1` is the more exposed on both axes" is not robust.** Five uncapped samples reverse the local axis (`P2` 5696 ms vs `P1` 4663 ms), and `P2` owns the pair's only recorded real CI failure (≥5165 ms, handoff 039). The *decision* (both get 25 000 ms) is correct and endorsed; restate the justification as D2's — the pair is one population and the local ordering is unstable between sessions.
- **m8 — §9 step 3's `pnpm test --filter @miolos/games --force`** never reaches turbo (`--filter` is pnpm's own flag, consumed by pnpm), so the stated verification is vacuous. Use `pnpm exec turbo run test --concurrency=2 --filter @miolos/games --force`.
- **m9 — the sudoku residual is left in a snapshot, which is the exact failure that produced #107.** `sudoku/generate.test.ts`'s `P1 — determinism` at 155 025 / 240 000 ms (64.6 %) is over D1's own trigger. **Excluding it from #107 is correct** — never red, not in §2.2's population, different cause (genuine cost, not contention). But recording it only in a plan and a landmine repeats handoff 039 landmine 8 verbatim — *"the durable fix is an explicit timeout … it is not filed as an issue yet"* — the sentence that made #107 necessary. Plans are point-in-time by CLAUDE.md's definition; a landmine in one is not a tracker entry. **File it as a GitHub issue this round** and cite the number.
- **m10 — the isolated baseline is unreconciled.** The headline falsification uses 383 ms *(step 1)*; issue #107's body and handoff 041 §3.1 both say **496 ms**. The conclusion survives (496 × 4 = 1984 < 4186), but the plan silently uses the lowest of three recorded figures for a number destined for the napkin and ADR-0055 as *"Measured on #107."* Reconcile, or use 496 and note 383 as a second sample.
- **m11 — merge-order claim is right; its conflict argument covers only the primary shape.** Verified: #106 names all three wall files plus `eslint.config.mjs` (which §8 lists as not touched), so the surfaces are near-disjoint and git resolves either order; **#106 has no branch and no open PR**, so #107 is ahead in practice. D5's file scope genuinely hands #106's probes the budget for free. Gap: §6.1's disjointness argument is stated only for `vi.setConfig`; if D5's fallback fires, the shape becomes `describe(name, {timeout}, fn)` on all seven describe headers in the same three files #106 is appending to. Still auto-mergeable — extend the analysis in one sentence.
- **n1 — two "verified" line numbers are off by one.** `{ numRuns: 150 }` is at `packages/games/test/binairo/generate.test.ts:65` (plan says 66) and `{ numRuns: 100 }` at `:76` (plan says 77, twice). The closing-brace lines are right.
- **n2 — step 0's failure counter double-counts.** `grep -c '^.*FAIL '` matches each failure twice (file tree + "Failed Tests" section). Landmine 1 already names turbo's `Failed:` line as the authority; use it here.
- **n3 — §8's file table cites the wrong section** for Shell item 3 (§12.3, not §12.1–12.2).
- **n4 — §7 option D under-attributes** the 1102 figure to step 1; `Tests 1102 passed (1102)` is in run `31888933252` at a line the plan already read. Label it `(verified)`.
- **n5 — §2.2's per-package block is a fenced code block turbo never prints.** The six values are correct (vitest `Duration` lines from six separate `##[group]`s) but the layout reads as a paste. Label it as assembled, or split it.
- **n6 — exit criteria 9/10/13 say `git diff main -- <path>` must be empty.** On a worktree that is only valid if local `main` is current. Specify `origin/main`.

---

## On the sharpest question asked of this plan

*Is `×4` on a **contended** figure double-counting contention that the cap simultaneously removes?*

**No — and the opposite is the live risk.** Under the cap contention essentially vanishes: the wall files collapse to 1000 / 1166 / 1480 ms and binairo to 2194 ms for the whole file. If the cap were the only thing shipping, any number above ~3000 ms would do and the arithmetic would be theatre. But the timeouts exist for the worlds the cap does *not* abolish — CI's 2-core fan-out (where the cap barely bites, since turbo caps *packages* while vitest's own `maxWorkers` already collapses to 1), `turbo run test` typed directly, and D8's own branch 4 where the cap is rolled back. In all three the contended figure is the correct anchor. **The construction is sound; the inputs are stale and too low by up to 2.7× (MAJ-1)** — the reverse of the double-counting worry.
