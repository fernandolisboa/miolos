# Implementation plan — Issue #109: the three timeout residuals

**Issue:** [#109](https://github.com/fernandolisboa/miolos/issues/109) — *"#107's residuals: sudoku `P1`, sudoku `P3 — weekday ramp`, and `nonogram-screen.test.tsx`"*
**Branch:** `test/109-timeout-residuals` (off `main` @ `8650cf9`)
**ADR:** none new. In-place annotations to ADR-0055, lettered (j)–(p) continuing ADR-0057's (a)–(i), and one reciprocal, unlettered annotation at ADR-0057 decision 5 (§7 R1), reported as a mapping. The one decision of weight this ticket makes — which of ADR-0055's decision 2 and decision 4 governs a shipped ceiling — is recorded as annotation (p) and its reciprocal rather than as an ADR-0058, and §3 D1 says why.
**Test ids:** none minted; `packages/games` keeps zero ids; one frontier correction in `docs/agents/test-ids.md` (§9).
**Successor issue:** one, filed at step 5 (§7 R7, drafted there) — the gate-shape successor to which the sudoku tripwires now point; its number replaces every `#<n>` in §4.1, §7 R1 (l), §7 R3 and §8.
**Sibling branch:** #116 (`docs/116-adr-status-lifecycle`, PR #122, open) touches three of the same files; §5.1 names the surfaces and the merge order.
**Revision:** 2 (step 4, applying the step-3 review — the change list is §12 "Step-4 changes"). §12 is also the deviation register for steps 5–8.

**Provenance rule, as in plans 042 and 049.** Every millisecond figure below carries where it was read:

- **(gate `<id>`)** — read in step 1, 2 or 4 out of a GitHub Actions gate log with `gh run view <id> --log`, colour codes stripped with `perl -pe 's/\^\[\[[0-9;]*m//g'` (a `gh` log download carries the **literal** three characters `^[[` before each colour code, not an ESC byte — `sed 's/\x1b\[[0-9;]*m//g'` strips nothing from it, and a figure regex such as the issue's `[0-9]{4,}ms` will not match `155025^[[2mms` without the strip; plan 042 §2.3's pattern), and checked against the run's own `cache miss, executing` / `Cached: 0 cached, 6 total` lines. Reproducible by the command in §6.4.
- **(local, #109)** — *not yet taken.* Step 5 takes them per §6.2 and writes them into the comments and the PR body. Every `<L…>` placeholder in §4 is one of these. **This plan ships no local figure of its own**, because step 2 does not run the suite.
- **(#55)** / **(plan 042)** — quoted from the commit body of `271a935` or from `docs/plans/042-…` §2.2–2.3, both point-in-time records.

---

## 0. What this plan found that the issue did not

The issue asks for a CI figure per test and a verdict. Step 1 supplied seven genuine CI samples per test. Step 2 read the gate logs **backwards** to answer the one question those seven cannot — *has the test grown, or was the budget wrong from the start?* — and the answer reframes the sudoku half of the ticket:

| gate run | date | suite size (test files, all packages) | sudoku `P1` | `P2` | `P3` ramp | full-week |
|---|---|---|---|---|---|---|
| `30683187834` (#55's own gate, `fix/sudoku-p1-ci-timeout`) | 2026-08-01 | **39** (ui 1 · core 4 · web 3 · api 7 · games 24; no `packages/db` yet) | **35 220 ms** | 14 660 | 5 824 | 1 960 |
| `30735602584` | 2026-08-02 | ui 1 · core 8 · db 4 · api 15 · web 29 (+ games) | 124 686 | 26 518 | 6 824 | 2 309 |
| `30782928416` | 2026-08-03 | — | 128 598 | 35 849 | 6 803 | 2 313 |
| `31242306419` | 2026-08-08 | — | 126 815 | 45 193 | 6 798 | 2 307 |
| `31652330711` (`main`) | 2026-08-12 | ui 1 · core 10 · db 4 · api 18 · web 39 (+ games) | 77 461 | 28 929 | 6 356 | 1 622 |
| `31658090994` | 2026-08-13 | — | 123 593 | 52 753 | 13 642 | 4 747 |
| `31758069668` | 2026-08-14 | — | 140 574 | 57 240 | 21 124 | 4 585 |
| `31888933252` (plan 042's sweep run) | 2026-08-15 | **161** (ui 1 · core 23 · db 8 · api 26 · games 28 · web 75) | **155 025** | 62 009 | 24 114 | 8 189 |
| the six later genuine runs in step 1 §7 (`P2` and full-week read at step 4) | 08-17 → 08-18 | 164 | 85 994 – 147 606 | 32 122 – 61 783 | 14 144 – 24 386 | 4 391 – 8 072 |

All rows are `Cached: 0 cached, 6 total` runs (the 08-01 row is `0 cached, 5 total` — five packages then). Every date is a different tree of the *rest* of the repo. **`packages/games/src/sudoku/**` and `packages/games/test/sudoku/**` are byte-identical across every row**: `git log --since=2026-08-01 -- packages/games/src/sudoku packages/games/test/sudoku` is empty, `fast-check` has been `4.9.0` since `204b607` (07-31), and `vitest`, Node (`.nvmrc`) and the runner class are unchanged in the same window.

**So the sudoku figures did drift — 4.4× for `P1`, 4.2× for `P3` ramp — and the driver is not the test.** On the 2-vCPU hosted runner six `vitest run` processes share two cores (ADR-0057 decision 3: `maxWorkers` collapses to 1 per package, verified `pool=1` in gate run `32081091260`), so a CPU-bound property's wall time is its CPU time divided by the **share of the two cores it gets while sibling suites are executing**. The driver is CPU share — how much sibling work runs *concurrently* with `generate.test.ts` — and it is not a monotone function of the suite's file count: it **saturates** once the siblings outlast the file. The table shows exactly that shape: 08-01 → 08-02, siblings 15 → 57 files, `P1` 35 220 → 124 686 ms (3.5×, most of the whole drift, as `@miolos/games` stopped running almost alone); 08-02 → 08-15, siblings 57 → 133 files, `P1` 124 686 → 155 025 ms (1.24×); and the 08-12 `main` row measured **77 461 ms with 72 sibling files** — less than 08-02's 124 686 with 57 — because what happened to be executing beside the file that run demanded less CPU. **The rest of the suite's concurrent CPU demand is `P1`'s cost driver on CI**, and it will move whenever that demand moves — up or down — with no prediction attached. The two bracketing run ids (`30683187834`, `31888933252`) are the evidence. This is the finding decision 4's cost-driver lists cannot express, and §7 records it where it belongs.

Three consequences for the decisions in §3:

1. **`P1` is over ADR-0055 decision 4's `budget / 2` tripwire on five of seven recent samples, and the drift is real — but there is no defect in the test to fix.** The diagnosis decision 4 demands is written in §3 D1 and discharged there, before the number moves; what licenses the raise is not the tripwire — decision 4 forbids exactly that — but item 2.
2. **The shipped 240 000 ms was never derived by decision 2 — or by any rule that survives.** `271a935`'s body: *"measured ~18.5s locally … Raise P1 and P2 to 240s: 4x slowdown plus honest margin"*. `18.5 × 4 = 74 s`; the remaining 3.2× is the unstated "honest margin". The baseline is an isolated single-file figure — the class plan 042 §2.2 shows under-shoots CI by 4–9× — and CI now runs `P1` at **4.6–8.4×** its isolated cost. The comment beside the number says *"~3-4x slower"*. It is wrong on the class and internally inconsistent, and it is replaced. **So #109 is decision 2's first application to a budget being set for these tests**, and D1 rests on that first.
3. **The tripwire will fire again on this file whenever the gate's concurrent CPU demand grows past what 625 000 absorbs**, and when it fires on an unchanged generator the conversation is the gate's shape (a lane for `packages/games`, a larger runner class, a split step) rather than any test's number. That successor is a **tracker entry, not a comment**: step 5 files it as a GitHub issue (§7 R7, drafted there), and the header comment and ADR annotation (l) cite it by number — the issue's own §2 is that a landmine kept only in a snapshot gets rediscovered, and a code comment is a snapshot with a different extension.

The third residual, `T-WEB-S43`, is unaffected by any of this: 944 ms maximum on CI over seven runs, 18.9 % of the default, and it never crossed 1 100 ms in any of the historical rows either (719 · 829 · 958 · 546 · 755 · 1 040 · 561 · 759 ms).

---

## 1. Scope & non-goals

### In scope

1. **Sudoku `P1 — determinism`**: re-derived from the CI anchor to **625 000 ms**, with a conformant comment (§3 D1, §4.2).
2. **Sudoku `P3 — weekday ramp`**: re-derived from the CI anchor to **100 000 ms**, with a conformant comment where today there is none (§3 D2, §4.4).
3. **Sudoku `P2 — solvability`**: number **retained** at 240 000 ms; its comment — false on the same class error, and dependent on `P1`'s old comment (*"the same margin as P1"*) — is replaced (§3 D3, §4.3). In scope because editing `P1`'s comment orphans it; the falsified-record standard (napkin Execution #5) puts it in the same round.
4. **Sudoku `P3 — full-week`**: number retained at 60 000 ms, figures recorded inside the ramp's comment (the Binairo `P3` precedent), literal respelt `60_000` (§3 D4).
5. **`T-WEB-S43` clue rails**: **no timeout** — measured-and-fine on the CI axis, with the local axis re-taken under today's configuration; a short comment records the verdict at the `describe` (§3 D5, §4.5). Contingency if the re-take fires the trigger: §3 D5(c).
6. **The file-header "90 s ceiling" comment** in `generate.test.ts`: false (the file measures 137–250 s on CI); rewritten as the one place the shared arithmetic and cost drivers live (§4.1).
7. **Records**: ADR-0055 in-place annotations (j)–(p) and the reciprocal annotation at ADR-0057 decision 5 (mapping, §7 R1); `docs/agents/test-ids.md` frontier correction and two paragraphs (§7 R2, §9); `.claude/napkin.md` Execution #4 (§7 R3); `docs/README.md` row for this plan (§7 R4); the issue's closing verdict table (§7 R5); the gate-shape successor filed as an issue (§7 R7); the PR body's cost-driver list (§8). Each item beyond the three residuals carries its one-line reason in the section that owns it: the `P2` and header comments are orphaned or falsified by the `P1` edit (same-round correction, napkin Execution #5); the full-week respell is one line of formatting; napkin #4's *"residuals: #109"* closes with the ticket; the frontier row is a live trap for the next allocator; (m) and (o) are the amendments §6.2's runs and D7 respectively make unavoidable; (p) and its reciprocal are the reading ADR-0057 decision 5 asked this ticket to record (D1).
8. **Evidence**: three uncapped local runs for the local half (§6.2); typecheck, lint, capped `pnpm test` (§6.3); the PR's own gate log read with the cache-miss check (§6.4).
9. **Coordination with the sibling branch #116** (§5.1): three named conflict surfaces, `git merge origin/main` before gates and before merge.

### Explicitly out of scope, with reasons

- **Any `numRuns` change.** ADR-0023 floors `P1`/`P2` at 100; #109's acceptance forbids any change at all, including `P3`'s 35 (secondary property, not floored, still not touched).
- **Any `vitest.config.ts` in `packages/games`.** ADR-0017; guarded by `T-WEB-S229`.
- **`.github/workflows/ci.yml`.** Nothing about the gate command changes; `T-WEB-S226` guards `--concurrency=10`. The job carries no `timeout-minutes` (verified by grep) and none is added: 625 s sits inside GitHub's 360-minute default by two orders of magnitude, and adding one is a gate-shape decision this ticket does not own — it belongs to the successor issue (§7 R7).
- **Cost reduction of `P1`, `P2` or `P3`.** Assessed and rejected in §3 D6.
- **`vitest.shared.ts`, `turbo.json`, root `package.json`.** Untouched.
- **`packages/games/test/sudoku/grade.test.ts`'s two bare `60000` timeouts.** Not residuals of #109 (10 815 ms and 4 157 ms on CI in the sweep run — 18.0 % and 6.9 %), and their file is not opened by this ticket. Named here so a reviewer does not think they were missed; they inherit the same contention drift and are worth a line in the next sweep.
- **The Binairo pair and the three wall suites.** #107's five; not re-derived. §6.2's runs will print their post-#120 local figures for free and §8 reports them as incidental readings, not acted on.
- **ADR-0057's decisions 1–4 and 6, and its `**Amends:**` header.** Untouched. Decision 5 receives **one in-place annotation and no header change** (§7 R1): its *"it should say which of decision 2 and decision 4 governs"* is a question #109 answers, not a statement #109 falsifies — the same distinction ADR-0055's last Consequence draws for ADR-0017 at #114 (annotation without `**Amended by:**`). The new PGlite hook readings the uncapped runs produce are samples of a heavy-tailed distribution and ADR-0055's *"the measurements do not live here"* keeps them out of the ADR. Reported in the PR body only.
- **An ADR-0058.** Considered for the decision-2/decision-4 reading and declined in §3 D1: the reading is a one-paragraph clarification of a rule ADR-0055 already states, ADR-0057 decision 5 asked the settling ticket to *"say which"* in so many words, and the lettered in-place annotation is this repo's idiom for exactly that (ADR-0055's (a)–(i)). If step 6's ADR-adherence reviewer finds the reading needs more than one paragraph on either side, that is the signal to promote it, and §12 records the outcome.
- **Snapshot classes** — `docs/plans/**` other than this file, `docs/handoffs/**`. Never rewritten (`docs/README.md`).
- **`grep`-visible drift in comments elsewhere that cite the sudoku figures** — none exists: `155 025`, `24 114` and `2 368` appear only in plan 042, plan 044/045, ADR-0055's neighbourhood and the issue, all snapshot or living-by-design (`grep -rnE "155 ?025|24 ?114|2 ?368 ms" docs apps packages` at step 5, folded into §6.5's sweep, confirms). The three live comments that still cite the *"3–4×"* CI factor at its source are adjudicated in §7 R6, not edited.

---

## 2. The measured facts this plan turns on

### 2.1 The seven genuine CI samples per test (step 1 §7, all re-read against the cache line)

| run id | `P1` | `P2` | `P3` ramp | full-week | `T-WEB-S43` rails | genuine? |
|---|---|---|---|---|---|---|
| `31888933252` | **155 025** | **62 009** | 24 114 | **8 189** | **944** | `Cached: 0 cached, 6 total` |
| `32003396086` | 104 178 | 41 746 | 15 542 | 5 883 | 444 | `Cached: 0 cached, 6 total` |
| `32081091260` | 141 439 | 57 184 | 23 070 | 7 975 | 800 | `cache miss, executing 1134ac09dcd8fefe` |
| `32083224936` | 147 606 | 61 783 | **24 386** | 7 734 | 830 | `cache miss, executing 1134…`, `0 cached, 6 total` |
| `32084007391` | 142 467 | 57 214 | 22 238 | 8 072 | 932 | same |
| `32090589293` | 85 994 | 32 122 | 14 144 | 4 509 | 376 | `cache miss` on games **and** web; `0 cached, 6 total` |
| `32091557143` (= current tree) | 139 492 | 56 202 | 18 320 | 4 391 | 708 | `cache miss` on games and web |
| *`32081889294`* | *141 439* | | *23 070* | | *650* | **NO — `cache hit, replaying logs`. Not a sample.** |

Every cell is now read from its run's own log: `P1`, `P3` ramp and the rails at step 1; `P2` and full-week for the five middle runs at step 4 (`gh run view <id> --log | perl -pe 's/\^\[\[[0-9;]*m//g' | grep -aE 'P2 — solvability|full-week coverage'`), which did not move either maximum — both stay on `31888933252`, `P1`'s run — and turned the two "one read" cells into seven-sample columns. The PR's own gate adds an eighth full row (§6.4).

### 2.2 The arithmetic, against ADR-0055

| test | budget today | pooled CI max (7 runs) | % | trigger (40 %) | tripwire (`budget / 2`) | decision 2 arithmetic | governs (D1's reading) |
|---|---|---|---|---|---|---|---|
| `P1` | 240 000 | 155 025 | **64.6 %** | fires (7 of 7 over) | **breached, 5 of 7** | 155 025 × 4 = 620 100 → **625 000** | decision 2 (never derived; set now), decision 4's diagnosis discharged alongside |
| `P2` | 240 000 | 62 009 | 25.8 % | clear (0 of 7) | clear (51.7 % of it) | 62 009 × 4 = 248 036 → 250 000 | decision 4 (retain, record the disagreement) |
| `P3` ramp | 60 000 | 24 386 | **40.6 %** | **fires on 2 of 7, including the maximum**: 24 114 = 40.19 %, 24 386 = 40.6 % | clear (81 % of it) | 24 386 × 4 = 97 544 → **100 000** | decision 2 (never derived; set now) |
| full-week | 60 000 | 8 189 | 13.6 % | clear (0 of 7) | clear | 8 189 × 4 = 32 756 → 35 000 (below shipped; not lowered — decision 4's converse) | decision 4 (retain) |
| `T-WEB-S43` | 5 000 (default) | 944 | 18.9 % | clear (0 of 7) | n/a | 944 × 4 = 3 776 → 5 000 = the default it already rides | decision 1 (no timeout) |

### 2.3 The local half — to be taken at step 5

No post-#114 contended local figure exists for any of the five tests above. The pre-#114 figures for `T-WEB-S43` — **2 368 ms** (plan 042 round 1) and **1 959 ms** (round 2) — were taken at turbo's default fan-out **and** at `apps/web`'s pre-#120 `maxWorkers = cpus − 1 = 7`. After #120 `apps/web` runs at `min(4, cpus − 1) = 4` on the reference box; `packages/games` is the one workspace with no `vitest.shared.ts` consumer (ADR-0017) and still runs at `cpus − 1 = 7`. §6.2 is the procedure; §3 D7 decides how the old figures are treated — and records that decision as ADR-0055 annotation (o), because it is one decision 2 does not make on its own.

---

## 3. Decisions register

### D1 — Sudoku `P1`: **re-derived to 625 000 ms** from the CI anchor. Decision 2's first application to a budget it never derived; decision 4's diagnosis obligation discharged alongside, and its finding is environmental.

**The warrant, in order.** *Primary:* the shipped 240 000 ms was **never derived by decision 2** — or by any rule that survives (§0 item 2): an isolated 18.5 s single-file figure, the class decision 2 says is *never* the anchor, through a multiplier the comment never stated, on a ticket (#55, 08-01) a fortnight older than the ADR. Decision 1's trigger fires on it (64.6 %), and a test over the trigger *"carries an explicit in-file timeout, with the arithmetic and both measured figures in a comment beside it"* — a conformant budget, which this test does not have. So the budget is being **set**, for the first time under the rule, and decision 2 sizes it: pooled CI maximum × 4, rounded up. *Secondary, discharged alongside:* the test is over decision 4's `budget / 2` on five of seven samples, and decision 4 says that is *"a defect to investigate and record, never a number to raise"* — so the diagnosis is written below **before** anything moves, and its finding is that the defect is environmental (the gate's CPU share, §0) and not in the test. The tripwire is not the reason for the raise; it is a second obligation honoured in the same paragraph. Decision 4's other sentence — *"Raising a shipped timeout requires fresh measured figures in the PR body and an updated arithmetic comment"* — states the conditions, and §4.2 and §8 meet them.

**How decision 2 and decision 4 divide — the reading ADR-0057 decision 5 asked the settling ticket to give, stated once here and recorded durably in §7 R1 (p) and its reciprocal.** *Decision 4 governs a shipped ceiling whose derivation is sound and whose test has no defect*: under decision 1's trigger, under `budget / 2`, never red — a fresh arithmetic result alone does not move it; the number is retained and any disagreement between the shipped number and decision 2's arithmetic is recorded beside it (the ADR-0057 decision 5 shape). *Decision 2 governs a budget being set*: for the first time, **or** where decision 1's trigger fires on a shipped budget whose derivation is found never to have followed decision 2 — the rule requires a conformant budget there and none exists, so one is set now, with decision 4's diagnosis written first if the tripwire is also crossed. **Decision 1's trigger is the discriminator**, because it is what says a budget is owed. Of #109's four sudoku sites: `P1` (64.6 %) and `P3` ramp (40.6 %) fall under decision 2 — never derived, trigger fires — and are set; `P2` (25.8 %) and full-week (13.6 %) fall under decision 4 — under the trigger, no defect — and are retained, `P2` with its one-step arithmetic disagreement recorded (D3) and its false *comment* replaced, since decision 4 retains the number and not the sentence. That `P2`'s number is of the same never-derived class as `P1`'s and is nevertheless kept is the reading's sharp edge, and it is stated so a reviewer does not have to find it: the rule does not ask for a budget under its own trigger to be set, and moving one anyway is what decision 4 exists to stop.

**Why annotations and not an ADR-0058.** The reading is one paragraph on each side and clarifies a rule ADR-0055 already states rather than adding one; ADR-0057 decision 5 asked the settling ticket to *"say which"* in so many words, and the lettered in-place annotation is this repo's idiom for exactly that (ADR-0055's (a)–(i)). `CLAUDE.md`'s *"new technical decision of any weight → propose an ADR"* is honoured by writing the reading into two ADRs rather than into a snapshot; if step 6's ADR-adherence reviewer finds either paragraph cannot stay one paragraph, that is the signal to promote it to a short ADR-0058, and §12 records the outcome. Recorded in ADR-0055 decision 4 as annotation (p) and, reciprocally, at ADR-0057 decision 5 (unlettered, one paragraph, pointing at (p)); neither header changes, because a question answered is not a statement falsified (§1).

**The diagnosis, written down as decision 4 requires:**
- The generator, the test, `fast-check`, `vitest` and Node are unchanged since the budget was set (§0).
- The measured cost rose 35 220 → 155 025 ms between 08-01 and 08-15 on a 2-vCPU runner, and the driver is CPU share — how much sibling work executes concurrently with the file — not the test: the same share change carried `P2` 14 660 → 62 009 and `P3` 5 824 → 24 386 (§0).
- The 240 000 was derived at #55 from an isolated ~18.5 s figure via an unstated multiplier (§0 item 2). It happened to be generous *for that day's gate* — 6.8× the 35 s that gate measured, when `@miolos/games` ran almost alone — and the margin was gone within a day of the other suites arriving (08-02: 124 686 ms).
- No cost reduction exists that keeps the property (D6). No `numRuns` lever exists (ADR-0023, #109 acceptance).
- The ceiling has never fired at 240 000. At 1.55× the pooled maximum, with an observed **1.8× spread on unchanged code** (85 994 – 155 025 ms across seven all-miss runs), it is a thin ceiling on a heavy-tailed quantity — the shape #107 was opened for, one order of magnitude up.

**Why raise rather than hold.** Holding at 240 000 keeps a budget the repo's own tripwire says is permanently tripped: every future PR that reads a gate log finds `P1` over `budget / 2`, owes a "diagnose and record", and finds nothing new. That converts decision 4's tripwire into noise on the one test where it matters most. It also keeps a 1.55× margin over a quantity whose spread on unchanged code is 1.8×, which is a thin ceiling on a heavy-tailed quantity — not yet a coin flip at 7/7 green, but the same shape as the one #107 was opened for. A red `P1` on green code is not a useful "the gate is slow" signal — the gate's step wall time (4m47s – 5m30s) already says that without a red.

**Why 625 000 and not something smaller.** Decision 2 is the only sizing rule the repo has: highest measured figure, CI first, ×4, rounded up to the next 5000 ms. `155 025 × 4 = 620 100 → 625 000`. The ×4 is *"retained for continuity, not derived"*, and this ticket does not derive a new one — although it now has paired data (isolated 18.5 s → CI 86–155 s, ×4.6–8.4; CI-to-CI 1.8×) that a future multiplier ticket may use. What 625 000 buys and costs: on a green run, nothing — a timeout is a ceiling, not a wall-clock cost; on a genuine hang in `P1`, the gate reports red at ~10.4 minutes instead of ~4, on a job with no `timeout-minutes` and a 360-minute default, and a local pre-commit (Husky runs the capped suite) holds the commit for the same ~10 minutes instead of ~4. Nothing it exceeds or makes meaningless. `budget / 2 = 312 500 ms`, and today's maximum is 49.6 % of it — the designed relationship (`budget / 4` = the anchor).

**What the comment must say beyond the arithmetic** (§4.2): that this drift is environmental and what its mechanism is; that if the tripwire fires again on an unchanged generator the defect is the gate's shape and not this test, with the successor issue's number; and the two run ids that bracket the drift.

### D2 — Sudoku `P3 — weekday ramp`: **re-derived to 100 000 ms**, with the comment it never had.

**The warrant, in the same order as D1.** *First,* the number was never derived by any rule: a bare `60000` from the engine's first commit (`e02d82a`), sized against nothing, declined by #55 (*"all other engine tests … keep their 60s caps"*), and it drifted 5 824 → 24 386 ms on CI with the gate's CPU share exactly as `P1` did. *Second,* decision 1's trigger fires — and not on one sample by a hair: it fires on **two of seven** genuine samples, **including the pooled maximum** — 24 114 ms = 40.19 % (gate `31888933252`) and 24 386 ms = 40.6 % (gate `32083224936`). Decision 1 reads the trigger on *"contended local or measured CI time"*; decision 2 makes that the sample maximum, and a maximum over the line is over the line. Decision 2 also says a later sample is expected to exceed the current maximum — which cuts *for* acting, not against: the estimator will not come back under. *Third,* the issue's own *"confirm with a second CI sample before acting"* is discharged six times over — and one of the six confirms it. So the budget is being set, under decision 2: `24 386 × 4 = 97 544 → 100 000`.

**Not the warrant, and said so because it was the previous draft's:** that at 60 000 the tripwire `budget / 2 = 30 000` sits at only 1.23× the anchor, so a 30 001 ms draw on unchanged code is plausible. That argument is available in exactly the same form to ADR-0057 decision 5 for the PGlite hook (tripwire 15 000 = 1.46× its 10 283 anchor), where it was weighed and the ceiling **retained** — so it cannot be what distinguishes `P3` from `P2` or from the hook. It is a *consequence* of the re-derivation worth stating in the comment (at 100 000 the tripwire is 50 000 = 2.05× the anchor, the designed relationship), not a reason for it. The discriminator is the trigger, as D1's reading says.

The literal is currently written `60000` (no separator, inconsistent with `240_000` two tests up); it becomes `100_000`.

### D3 — Sudoku `P2 — solvability`: **retained at 240 000 ms**; comment replaced.

Under the trigger (25.8 %) and under the tripwire (62 009 is 51.7 % of 120 000). Its number is of the same never-derived class as `P1`'s — but decision 1's trigger does not fire, so no budget is being *set* here, and decision 4 governs a shipped ceiling with no defect (D1's reading) — this is precisely the ADR-0057 decision 5 shape, and the plan applies it the same way: decision 2's arithmetic would say `62 009 × 4 = 248 036 → 250 000`, one step above what ships; **recorded as that one-step disagreement and not moved**, because nothing fires and it has never been red. Its comment is replaced because (a) it repeats the isolated-baseline class error (*"local P2 ~9s → allow 4x"* — CI runs it at 6.9× that), and (b) it says *"the same margin as P1"*, which after D1 points at a sentence that no longer exists. The comment names the two lines `P2` is drifting towards (trigger 96 000 ms, tripwire 120 000 ms) so the next reader sees it coming.

### D4 — Sudoku `P3 — full-week`: **retained at 60 000 ms**; figures live in the ramp's comment; literal respelt `60_000`.

13.6 % on CI. Decision 2's arithmetic (35 000) is *below* the shipped number and decision 4's converse says a ceiling with headroom is not lowered for arithmetic either. Following the Binairo `P3` precedent, its figures are recorded inside its sibling's comment rather than in a comment of its own. The respelling is formatting: the file otherwise uses digit separators, plan 045 already flagged the bare spellings, and a reviewer grepping `60_000` should find it. It carries no claim.

### D5 — `T-WEB-S43`: **measured-and-fine, no timeout**, recorded in a comment at the `describe`; local axis re-taken; contingency pre-decided.

**(a) The verdict on the evidence in hand.** Seven genuine CI samples, maximum 944 ms (18.9 %); the eight historical rows in §0 never exceed 1 040 ms. Decision 1's CI half is clear by a wide margin. Decision 2's arithmetic on the CI anchor gives 5 000 ms — the default it already has.

**(b) The local half.** Decision 1 is an *or*, and the 2 368 ms figure that put this test in #109 satisfied it on the local side. That figure is superseded, not pooled — D7 says why — so the local half is **re-taken under today's configuration** in §6.2. The expected outcome is under 2 000 ms (CI's 2-vCPU figure is 944 ms; the box has eight cores and `apps/web` now runs four workers), and the verdict is then measured-and-fine on both axes.

**(c) Contingency, decided now so step 5 does not decide it.** If the pooled local maximum over the three uncapped runs exceeds 2 000 ms, the trigger fires on the local axis and the test gets a **per-`it` trailing positional timeout on `"renders one labelled rail per row and per column"` only** — `}, N);` with `N = pooled max × 4 → next 5000` — and the comment moves inside that `it` in the Binairo shape. Per-`it` and not `describe(name, { timeout }, fn)` or `vi.setConfig`, because only that `it` does thirty `getByLabelText` walks over the 15×15 board; the other four in the `describe` render the same fixture and query by id. This is `apps/web`'s shipped single-heavy-`it` idiom — copy `sudoku-screen.test.tsx`'s *"swaps the conclusion in place"*, which closes `}, 30_000);` (trailing argument, idiom A); `free-play-sudoku.test.tsx`'s *"solves a pinned Leve puzzle"* uses the `it(name, { timeout: 20_000 }, fn)` options form and is the other shipped shape, not copied here so the two edited files share one idiom. If the local maximum lands between 1 800 and 2 000 ms the verdict is still no-timeout, and the comment says by how little.

**(d) A comment is owed even for a test that gets no timeout.** Decision 1 says *"below the trigger, no timeout"* and is silent about comments. The Binairo `P3` precedent records the bare sibling's figures inside a sibling's comment; here no comment exists in the whole file (`grep -c timeout` = 0), and ADR-0055 decision 1 names this test by id as a residual — a reader arriving from the ADR should find the verdict where the ADR points. So: a short block above `describe("the clue rails (T-WEB-S43)")` — verdict, both figures with run id, the reproduce command, and one clause on the superseded pre-#120 figures pointing at ADR-0055 annotation (o), which is where the *why* lives. Six to eight lines (the `T-WEB-S48` disambiguation already lives in ADR-0055 decision 1 (d) and on the issue, and the pre-#120 history is (o)'s matter); it is the only in-tree record the verdict gets.

### D6 — Cost reduction for the sudoku properties: **assessed and rejected**.

- `P1`'s cost is two `generateDailySudoku` calls per run and nothing else measurable: `P1 / P2 = 2.48` on CI, i.e. two generations against one, so the deep-equal is noise. **The two independent generations *are* the determinism property**; memoising either would test that a cache returns what it stored. `numRuns` is at the ADR-0023 floor. There is nothing to reduce.
- Step 1's observation that `P1`, `P2` and `P3` draw the same `(seed, weekday)` sequence under one `FC_SEED` — so a generation cache shared across `P2`/`P3` would cut real time — is not pursued: it changes test structure to buy time on tests that, after D1–D4, fire no tripwire; ADR-0023 layer 3 wants each property to re-check its invariant on its own generation with the independent instrument; and #109's acceptance is verdicts, not performance work. The claim itself is left unverified because nothing here depends on it.
- The header comment's lever list (P3 35 → 25, the `grade.test.ts` cross-check 25 → 15, then a floor amendment against ADR-0023) is *kept*, in that order, as the recorded sequence for a future cost ticket — and prefixed with the levers that are **not** available (any reduction below the floor; any silent reduction).

### D7 — Population, pooling, and the pre-#120 local figures.

**Not one population.** ADR-0055 decision 2 pools where *"per-test ordering is unstable between measurement sessions"*. The four sudoku tests order `P1 > P2 > P3 ramp > full-week` on every one of the sixteen CI rows in §0 and §2.1, and their costs genuinely differ (200 vs 100 vs 35 generations, plus grading). So four numbers, four sites — with the *shared* prose (the contention finding, the cost drivers, the reproduction caveat, the `budget / 2` derivation, the ADR-0017/0023 clearance) written **once** in the file header and pointed at from each site (§4.1). That is decision 1's one-cost-driver clause applied inside a file: figures and arithmetic per site because they differ, boilerplate once because it does not.

**The pre-#120 `T-WEB-S43` figures are superseded, not pooled — and that is a decision-2 amendment, recorded as one.** Decision 2 as written pools *"every earlier session's samples for the same test"* and says nothing about samples expiring on a configuration change; applied literally, the pooled local maximum is 2 368 ms, the trigger fires on the local axis, and the rails `it` gets `2 368 × 4 = 9 472 → 10 000 ms`. This plan does not do that, and it does not pretend the ADR already says why. Those samples were of the same test in a **different world** — `apps/web` at `maxWorkers = cpus − 1 = 7` — which **no shipped command runs** since `vitest.shared.ts` landed (#120): it *can* be run (`pnpm test --force --concurrency=10 -- --maxWorkers=7`, plan 049 §2.7's verified pass-through, or a revert of #120), but the repo ships no path to it. The warrant for treating them as history is ADR-0057 decision 6, which makes the worker bound hold in **every** invocation — unlike the turbo cap, which is overridable precisely so the uncapped command exists (decision 2's second consequence) — so the pre-#120 world is no longer a shipped world, exactly as ADR-0055 decision 4(f) reasons for the root concurrency setting *"moving the measured basis"* of every contended figure. Rule, as annotation **(o)** to decision 2 (§7 R1): *samples taken under a worker configuration no shipped command reproduces are history, not anchors; the population's local half is re-taken under the shipped bound.* The old figures are recorded in the comment as history with a pointer at (o).

### D8 — Comment idiom: `packages/games` idiom A (trailing positional argument, comment inside the `it` above the closing brace); `apps/web` gets a comment above the `describe` and, only in D5(c), idiom A on one `it`.

Matches the package's own eight shipped timeouts (four in this file, two in `grade.test.ts`, the Binairo pair — all trailing positional arguments, verified by grep) and #107's five. No `vi.setConfig` anywhere in this ticket: the sudoku file has four different numbers (decision 3's *"per-`it` only where costs genuinely differ"*), and `nonogram-screen.test.tsx` gets no budget.

### D9 — No test asserts the new literals.

A source scan pinning `625_000` would be a test about a comment's arithmetic; the repo's precedent for `packages/games` scans (`T-WEB-S229`) guards an invariant (no config), not a number. The literals are verified by grep at step 5 (§6.1) and by the PR's own gate, which runs them.

---

## 4. Shape and placement — the exact texts

Placeholders `<L1>`–`<L5>` are the pooled local maxima from §6.2, in ms; `<n>` is the number of green uncapped runs (expected 3). Step 5 fills them and deletes nothing else. Wording may be tightened at step 5; the figures, run ids and the sentences marked **(load-bearing)** may not be dropped.

### 4.1 `packages/games/test/sudoku/generate.test.ts` — the file header (replaces the block that today ends *"— never a silent reduction."*)

```
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
// What these budgets measure on CI is CPU SHARE, not the generator
// (load-bearing): the engine is byte-identical since e02d82a and P1 went from
// 35 220 ms (gate run 30683187834, 2026-08-01, 39 test files across the
// whole suite) to 155 025 ms (gate run 31888933252, 2026-08-15, 161 files).
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
// not this file: that conversation is issue #<n>. Every contended-local
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
```

### 4.2 `P1` — replaces the three-line comment; `}, 240_000);` → `}, 625_000);`

```
    // Explicit timeout, re-derived at #109 (ADR-0055 decisions 1, 2 and 4;
    // plan 051; shared arithmetic and cost drivers in the header above). The
    // cost is 200 generations — two per run, which IS the determinism
    // property; the deep-equal is not measurable beside them (P1 / P2 = 2.48
    // on CI, two generations against one) — so nothing is reducible without
    // reducing numRuns, which ADR-0023 floors. Figures: 155 025 ms on CI, the
    // pooled maximum over seven genuine gate runs (31888933252; the others
    // 85 994–147 606 ms) — 64.6 % of the previous 240 000 ms and over its
    // budget / 2 = 120 000 ms on five of the seven — and <L1> ms contended
    // local (pooled max over <n> uncapped runs at #109; apps at #120's
    // worker bound, packages/games at cpus - 1). CI is the anchor:
    // 155 025 x 4 = 620 100 -> 625 000 ms, of which the anchor is 24.8 % and
    // 49.6 % of the budget / 2 = 312 500 ms tripwire. (load-bearing) The
    // 240 000 it replaces was never derived by ADR-0055 decision 2: sized at
    // #55 from an isolated ~18.5 s local figure — the baseline class plan
    // 042 §2.2 shows under-shoots CI — via a multiplier its comment never
    // stated (18.5 x 4 = 74 s, not 240 s); CI runs this test at 4.6–8.4x its
    // isolated cost, not the "3-4x" that comment claimed. So this is decision
    // 2's first application here, with decision 4's diagnosis discharged
    // first (plan 051 §3 D1). A ceiling, not a target: over 312 500 ms is a
    // defect to diagnose and record, never a number to raise — and on an
    // unchanged generator that defect is the gate's shape (see the header).
```

### 4.3 `P2` — replaces the two-line comment; `}, 240_000);` unchanged

```
    // Retained at 240 000 ms at #109, not re-derived (ADR-0055 decision 4
    // governs a shipped ceiling; the ADR-0057 decision 5 shape). Figures:
    // 62 009 ms on CI (gate run 31888933252; 56 202 ms on 32091557143, the
    // newest genuine run) = 25.8 % — under the 40 %
    // trigger and under budget / 2 = 120 000 ms — and <L2> ms contended local
    // (#109, <n> uncapped runs). Decision 2's arithmetic would say
    // 62 009 x 4 = 248 036 -> 250 000 ms, one step above what ships;
    // recorded as that one-step disagreement and not moved, because nothing
    // fires and it has never been red. Same driver and same contention as P1
    // (one generation per run plus the counting-solver re-proof), so it
    // drifts with P1: the trigger sits at 96 000 ms, the tripwire at
    // 120 000 ms. The comment this replaces derived the number from an
    // isolated ~9 s figure by an unstated multiplier; the sentence is
    // replaced, the number is not.
```

### 4.4 `P3 — weekday ramp` — new comment; `}, 60000);` → `}, 100_000);`. And full-week: `}, 60000);` → `}, 60_000);`, no comment of its own.

```
    // Explicit timeout, re-derived at #109 (ADR-0055 decisions 1, 2 and 4;
    // plan 051; shared arithmetic in the header). 35 runs of one generation +
    // grade + validate. Figures: 24 386 ms on CI, pooled maximum over seven
    // genuine gate runs (32083224936; 14 144–24 114 ms on the other six) =
    // 40.6 % of the previous 60 000 ms — over the 40 % trigger on two of the
    // seven, including the maximum (24 114 = 40.19 %, 24 386 = 40.6 %); the
    // trigger reads the maximum — and <L3> ms contended local (#109, <n>
    // uncapped runs). 24 386 x 4 = 97 544 -> 100 000 ms, of which the anchor
    // is 24.4 % and 48.8 % of the budget / 2 = 50 000 ms tripwire. It was a
    // bare `60000` from the engine's first commit, never derived by any
    // rule, and it drifted 5 824 -> 24 386 ms on CI with the gate's CPU
    // share exactly as P1 did (header). A ceiling, not a target: over
    // 50 000 ms is a defect to diagnose and record. numRuns 35 is a
    // secondary (approval) property outside ADR-0023's floor and is untouched
    // regardless (#109). The full-week sibling below is deliberately left at
    // 60 000 ms: 8 189 ms CI maximum over the same seven runs (31888933252;
    // 4 391–8 072 ms on the others) = 13.6 %, <L4> ms contended local — under
    // the trigger; its literal is respelt 60_000 and nothing else changes.
```

### 4.5 `apps/web/test/nonogram-screen.test.tsx` — new comment immediately above `describe("the clue rails (T-WEB-S43)", …)`; no timeout

```
// Deliberately bare — no timeout (ADR-0055 decision 1; #109, plan 051).
// The rails test below was #109's third residual: 944 ms maximum on CI over
// seven genuine gate runs (31888933252; 376–932 ms on the others) = 18.9 % of
// vitest's 5000 ms default, and <L5> ms pooled maximum over <n> uncapped
// local runs at #109 (`pnpm test --force --concurrency=10`). Under the
// trigger on both axes; x4 on the CI anchor gives the default it rides. The
// 2368 / 1959 ms that filed it (plan 042 §2.3) were taken at apps/web's
// pre-#120 seven workers — history, not anchors: ADR-0055 annotation (o).
```

If D5(c) fires, this block moves inside the `it` (idiom A), gains the arithmetic line `<L5> x 4 = … -> N ms` and the `budget / 2` sentence, and the `it` closes `}, N);`.

---

## 5. Exact file list

### Modified — tests (2)

| File | Change |
|---|---|
| `packages/games/test/sudoku/generate.test.ts` | header comment rewritten (§4.1); `P1` comment + `240_000` → `625_000` (§4.2); `P2` comment (§4.3); `P3` ramp comment + `60000` → `100_000` (§4.4); full-week `60000` → `60_000`. **No `numRuns`, no import, no assertion changes.** |
| `apps/web/test/nonogram-screen.test.tsx` | one comment block above the `T-WEB-S43` `describe` (§4.5). No timeout unless D5(c). |

### Created — docs (1)

- `docs/plans/051-issue-109-plan-the-three-timeout-residuals.md` (this file)

### Modified — records (5)

`docs/adr/0055-test-timeouts-are-sized-against-contention.md` (§7 R1, (j)–(p) + one header line) · `docs/adr/0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md` (§7 R1, one annotation at decision 5, no header change) · `docs/agents/test-ids.md` (§7 R2, §9) · `.claude/napkin.md` (§7 R3) · `docs/README.md` (§7 R4)

### Created — tracker (1)

- The gate-shape successor issue (§7 R7), filed with `gh issue create` at build step 2b; its number is written into §4.1, R1 (l), R3 and §8.

### Explicitly NOT touched

`.github/workflows/ci.yml` · root `package.json` · `turbo.json` · `vitest.shared.ts` · every `vitest.config.ts` · any `numRuns` · `packages/games/src/**` · `packages/games/test/sudoku/grade.test.ts` · `packages/games/test/binairo/**` · the three `eslint-*-wall.test.ts` · `docs/adr/0057-*` beyond the one decision-5 annotation (decisions 1–4 and 6, both headers) · `docs/adr/0017-*`, `0023-*` · `docs/handoffs/**` · other `docs/plans/**` · `CLAUDE.md` · `CONTEXT.md`.

### 5.1 Coordination with the sibling branch #116

#116 (`docs/116-adr-status-lifecycle`, worktree `/home/ferna/projects/miolos-116`, commit `ea75266`, PR #122 open and unmerged at step 4) flips the nine shipped ADRs to Accepted and touches three files this ticket also edits. Named so the conflicts are resolved by design and not at merge time (napkin Parallel-Stream #2):

| surface | #116 | #109 | resolution |
|---|---|---|---|
| `docs/adr/0055-…md` | line 3 rewritten: `**Status:** Accepted — 2026-08-16 (issue #107, shipped in #112)`; lines 4–13 untouched by its own plan | one new header line after line 4 (`**Amended by:**` … ) and (j)–(p) inserted after (i) at line 14 | adjacent-line hunks; separable. #109's hunks go under the **flipped** line 3 untouched — nothing #109 writes mentions the Status. |
| `docs/README.md` | one row for `plans/052-…` appended after the `adr/0057-…` row | one row for `plans/051-…` appended after the same row | guaranteed textual conflict; resolution is **both rows, 051 before 052**. |
| `.claude/napkin.md` | Execution #5's "Do instead" edited | Execution #4 rewritten in place | adjacent items; keep both edits, item count stays 10. |

Procedure: `git merge origin/main` on `test/109-timeout-residuals` **before the gates (§6.3)** and **again before merge (§10 step 10)**; a conflicting PR produces no `gate` run at all (napkin Execution #10), so the merge is done before pushing, not after a missing check is noticed. Merge order: **#116 first is expected** — it is docs-only and already open — and #109 then rebases the ADR-0055 header and the README row over the flipped Status; if #109 lands first, #116 does the reverse and its lines-4–13-untouched promise still holds because #109's (j)–(p) sit after (i). Neither order changes any figure or verdict in this plan. The three uncapped timing runs (§6.2) are additionally serialised against the #116 worktree's gate — see §6.2's preconditions.

---

## 6. Verification — commands, reading rules, disqualifiers

Shell prefix for every node/pnpm command: `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`. Working directory `/home/ferna/projects/miolos-109`.

### 6.1 The literals and the absence of anything else

```
grep -nE '\}, [0-9_]+\);' packages/games/test/sudoku/generate.test.ts
#  expect exactly four hits: 625_000 (P1), 240_000 (P2), 100_000 (P3 ramp), 60_000 (full-week)
grep -nE 'numRuns: [0-9]+' packages/games/test/sudoku/generate.test.ts
#  exactly three lines, in this order — { seed: FC_SEED, numRuns: 100 } (P1), { seed: FC_SEED, numRuns: 100 } (P2),
#  { seed: FC_SEED, numRuns: 35 } (P3 ramp). On main today they sit at :56, :91, :112; the line numbers move with
#  the comments and are not the check. (A bare `grep -c numRuns` is NOT the instrument: main has 7 mentions, four of
#  them in comments, and the new comments mention numRuns again by design.)
git diff main -- packages/games/test/sudoku/generate.test.ts | grep -E '^[-+].*numRuns: [0-9]+'   # must be empty
grep -cE 'setConfig|\}, [0-9_]+\);|\{ timeout:' apps/web/test/nonogram-screen.test.tsx   # 0 — or 1 if D5(c) fired
ls packages/games/vitest.config.* 2>&1                                  # "no such file"
```

### 6.2 The local half — three uncapped runs, pooled maximum, ADR-0055 decision 2's own minimum

Taken **on the branch tree** (the timeouts do not change a green run's timing; taking them first also shows the shipped ceilings hold on this box). Nothing else building or testing on the box; the agent session is expected and is counted as contention (ADR-0055 decision 2). **The box must be otherwise idle, and "otherwise" includes the sibling worktree**: the orchestrator confirms the `#116` worktree (`/home/ferna/projects/miolos-116`) is not running `pnpm lint`/`pnpm test`/a gate of its own during these three runs — serialise the two streams here, since a concurrent gate would be uncounted contention and would disqualify the run as an anchor. Paste `nproc && free -m` before the loop, exactly as the gate does: the box's shape decides eligibility (ADR-0057) and it has changed twice this fortnight.

```
mkdir -p ~/miolos-session
nproc && free -m
set -o pipefail
for i in 1 2 3; do
  MIOLOS_TEST_DB_TIMING=1 pnpm test --force --concurrency=10 2>&1 | tee ~/miolos-session/109-uncapped-$i.log
  echo "run $i exit=$?" | tee -a ~/miolos-session/109-uncapped-$i.log
done
```

(`set -o pipefail` so `$?` is turbo's exit and not `tee`'s — the shell is zsh, where bash's `PIPESTATUS` does not exist.)

**Eligibility, per run — a run is an anchor only if all five hold; paste the lines:**

```
grep -cE 'Test timed out|Hook timed out|Test Files .* failed|Tests .* [1-9][0-9]* failed| FAIL ' ~/miolos-session/109-uncapped-$i.log   # 0
#   (anchored on vitest's own summary lines — NOT a bare `Error: `, which apps/web prints through console.error / act warnings on green runs)
grep -E 'Test Files .* passed' ~/miolos-session/109-uncapped-$i.log    # six per-package lines, all "passed", none "failed"
grep -E 'Tasks:|Cached:' ~/miolos-session/109-uncapped-$i.log         # "6 successful, 6 total" and "0 cached, 6 total"
grep -c 'ELIFECYCLE' ~/miolos-session/109-uncapped-$i.log              # 0
grep 'exit=' ~/miolos-session/109-uncapped-$i.log                      # exit=0
```

A run in which **anything** timed out is not an anchor and is not re-run until green: it is a finding (napkin Execution #8). Diagnose it (`MIOLOS_TEST_DB_TIMING` lines for the PGlite class; `free -m` for memory), record it in §12 and the PR body, take at most one replacement run, and if fewer than three eligible runs exist size from what exists and say so — decision 2's *"where a population has no eligible anchor, that is recorded as the reason"* is the fallback, never an ineligible figure.

**Reading the figures** (default reporter, identical to the gate's; it prints a per-test line only above the 300 ms slow threshold). Local logs carry real ESC bytes, so the `\x1b` form is right *here*; a `gh` log download does not (provenance rule, §6.4):

```
sed 's/\x1b\[[0-9;]*m//g' ~/miolos-session/109-uncapped-*.log \
  | grep -aE 'P1 — determinism|P2 — solvability|P3 — weekday ramp|full-week coverage|labelled rail|nonogram-screen.test.tsx \('
```

`<L1>`–`<L4>` are the sudoku maxima across the eligible runs; `<L5>` is the rails maximum. **If the rails line is absent from a run whose `nonogram-screen.test.tsx (58 tests)` line is present, that run's figure is "< 300 ms" and is recorded as such** — it is under the trigger by construction. Also read, for §8's incidental table: `P1 — generated puzzles|P2 — determinism` (Binairo), the three `eslint-*-wall` first-`it` lines, and the largest `MIOLOS_TEST_DB_TIMING` boot.

### 6.3 The gate, locally

```
pnpm typecheck
pnpm lint
pnpm test --force          # capped at TURBO_CONCURRENCY=2 — the shipped configuration; acceptance evidence, NOT an anchor
```

`--force` because a cache hit is a replay (napkin Execution #8). Paste the tail of each (`Tasks:`/`Cached:`/`Time:` and, for test, the six per-package `Duration` lines).

### 6.4 The PR's own gate — the eighth genuine CI row

Both edited files bust their package's turbo input hash, so `@miolos/games:test` and `@miolos/web:test` are guaranteed executions. Confirm rather than assume:

```
gh run list --workflow=ci.yml --branch test/109-timeout-residuals --limit 3 --json databaseId,conclusion,createdAt
gh run view <id> --log | perl -pe 's/\^\[\[[0-9;]*m//g' \
  | grep -aE '@miolos/(games|web):test|cache (miss|hit|bypass)|Cached:|nproc|Mem:|P1 — determinism|P2 — solvability|P3 — weekday ramp|full-week coverage|labelled rail|generate.test.ts \(|Time: '
```

(`perl`, not `sed 's/\x1b…'`: the download carries the literal characters `^[[`, so the ESC form strips nothing and a figure regex such as `[0-9]{4,}ms` would not match `155025^[[2mms`. `sed 's/\^\[\[[0-9;]*m//g'` is the equivalent.)

Required in the PR body: the `cache miss, executing` line for **both** packages (a `cache hit, replaying logs` on either disqualifies that package's figures — re-push a no-op is not the fix; the fix is that the edit is real, which it is), the four sudoku lines and the rails line, `nproc`/`free -m`, `Cached: 0 cached` or the per-package miss lines, and the test step's `Time:`. Read `P1` against 312 500 and `P3` against 50 000 (both tripwires); both are expected far under. If the PR's own gate shows `P1` **over 312 500 ms**, stop and diagnose before merging — that would be a new maximum more than double any observed, and §12 gets the entry.

### 6.5 Records sweep, both directions

Forward: every row of §7 → a hit in the tree. Reverse:

```
grep -rn -E "one green in sixteen|15 (times )?in 16|no legal anchor|90 s ceiling|3[-–]4.?[x×]|local P[12] ~|next free.*S229|S227.*highest|residuals: #109|starting with \[?#109|all filed as \[?#109|tracks the (whole suite|size of every sibling)" \
  --include='*.md' --include='*.ts' --include='*.tsx' . | grep -v node_modules
```

The factor pattern is `3[-–]4.?[x×]` — wide enough for `~3-4x`, `3-4x slowdown` and `3–4×` (en-dash, multiplication sign); the step-3 review's `3.?4.?[x×]` also matches `34px` at `nonogram-screen.test.tsx:1012` and `sudoku-screen.test.tsx:350`, which is noise. Live hits outside the two files this ticket opens (verified at step 4, snapshot classes excluded): `apps/web/test/sudoku-hint.test.ts:31`, `apps/web/test/free-play-sudoku.test.tsx:136`, `docs/adr/0040-…md:244` — adjudicated in §7 R6; the two in `generate.test.ts` (`:58`, `:93`) are the comments §4.2/§4.3 replace. Every hit maps to a §7 row or lives in a snapshot class (`docs/plans/`, `docs/handoffs/`) and is left alone. Report the mapping, not a count.

---

## 7. Records — every statement this ticket makes false or owes, as a mapping

### R1 — ADR-0055: in-place annotations, lettered (j)–(p) continuing ADR-0057's (a)–(i); one header line after line 4 listing them; and one reciprocal, unlettered annotation at ADR-0057 decision 5. Nothing deleted.

The header line, placed after the `**Amended by:**` line and under #116's flipped `**Status:**` (§5.1): `**Annotated at #109** ([plan 051](../plans/051-…)) — (j)–(p), continuing the lettering; **(k), (m), (o) and (p) are decision-level amendments** (a clause of decision 2 superseded; an entry added to decision 4's instantiated list, as (f) was; a rule added to decision 2's pooling clause; and the decision-2/decision-4 reading decision 4 left implicit); **(j), (l) and (n) are records completed or sharpened, not falsified**; every edit annotated in place, nothing deleted.` The (j)–(p) bullets follow (i) in the header mapping, each one sentence naming what it corrects and where; the full text lives at each decision.

| letter | where | what | why #109 owes it |
|---|---|---|---|
| **j** | decision 1, *"Three residuals in total … all filed as #109"* | annotate: **closed at #109** — `P1` re-derived 240 000 → 625 000, `P3` ramp 60 000 → 100 000, `T-WEB-S43` measured-and-fine with no timeout; plan 051 | the sentence becomes incomplete the moment the residuals are adjudicated |
| **k** | decision 2, the third consequence — *"that command is currently red on the reference box — one green in sixteen … the local procedure yields no legal anchor at all"* | annotate: **superseded, and the record was owed earlier** — plan 049 §2.7 conclusion 3 (uncapped green 3/3 on the enlarged box) and ADR-0057 decision 5 (*"an eligible LOCAL anchor now exists"*) already contradicted this clause **without ADR-0055 being updated: that is #114's records omission, discovered at #109** — exactly as (m) records #120's; then #120 bounded `apps/web`'s workers, so pre-#120 local figures are of a different configuration (o); **#109 took the first post-#120 uncapped local samples: `<n>` of 3 green on the 16 GB box** (§6.2), and is the first ticket to size from the local procedure since the clause was written | the round with the evidence owes the record (napkin Execution #5); #109 is the first ticket that *uses* the procedure the clause says does not exist, so it cannot leave the clause standing |
| **l** | decision 4, *"starting with #109's three, which #107 files without fixing"* | annotate: delivered — the list is in #109's PR body and plan 051 §8; **its fifth entry is one no per-timeout list can enumerate**: on the 2-vCPU gate a CPU-bound test's wall time is its CPU time divided by the share it gets while sibling suites execute concurrently — a share that saturates once the siblings outlast the file (`P1` 35 220 → 155 025 ms on a byte-identical generator, gate runs `30683187834` → `31888933252`), so the routing is *read the sudoku lines whenever a gate log is read for anything*; **a hit on an unchanged generator is a gate-shape defect, tracked as issue #<n>** (R7) | the sentence's obligation is discharged and the discharge changed the list's shape |
| **m** | decision 4's instantiated list, beside (f) *"the concurrency setting on the root `test` script"* | annotate, one sentence: **`vitest.shared.ts`'s `maxWorkers` bound joins the list** — #120 moved the contended local basis of the wall trio (and Binairo's, indirectly) exactly as (f) did and routes the same way (a local re-measure; the bound evaluates to 1 on CI), **an omission of #120's records, recorded at #109 because §6.2's runs are the first post-#120 measurement of those five** (figures in §8, incidental) | #120's omission; the round with the evidence owes the record. **Kept, decided at step 4** — records hygiene beyond #109's subject, but one sentence, fully discharged by figures this ticket takes anyway; not filed as an issue |
| **n** | Consequences, *"A slow drift inside the budget is invisible until it crosses `budget / 2` on a pull request that happens to touch one of decision 4's five triggers"* | annotate: **sharpened by measurement at #109** — drift on the gate is environmental and needs no trigger touched: `P1` went 35 220 → 155 025 ms on a byte-identical generator as the sibling suites' concurrent CPU demand on the 2-vCPU runner grew (gate runs `30683187834` → `31888933252`), and **the 08-15 sweep that wrote this rule read that very log and did not read `P1` against `budget / 2`** — the tripwire it was creating was already crossed in the evidence it was created from. The honest residual is wider than written: it is invisible until *someone reads a gate log for any reason* and reads the timed lines against `budget / 2` | the bullet is made incomplete in the direction that matters (a reader trusting it would think an unchanged test cannot drift) |
| **o** | decision 2, after the third consequence — the pooling clause *"pooled with every earlier session's samples for the same test"* | annotate, as a rule decision 2 did not have: **samples taken under a worker configuration no shipped command reproduces are history, not anchors** — pre-#120 `apps/web` at `maxWorkers = cpus − 1` is the instance — and the population's local half is re-taken under the shipped bound. Warrant: ADR-0057 decision 6 makes the bound hold in **every** invocation (unlike the turbo cap, overridable so that the uncapped command exists), so the earlier world is no longer a shipped world, and decision 4(f) already reasons that a change to the concurrency setting *"moves the measured basis"* of every contended figure — this is the same reasoning one axis in. Applied literally without (o), decision 2 would size `T-WEB-S43` at 10 000 ms from a 2 368 ms sample of a configuration nothing ships (D7) | D7's supersession is an amendment to decision 2's pooling clause, and an amendment must be lettered, not implied by a comment in a test file |
| **p** | decision 4, after *"Raising a shipped timeout requires fresh measured figures …"* | annotate: **which of decision 2 and decision 4 governs a shipped ceiling — answered at #109 (plan 051 §3 D1), as ADR-0057 decision 5 asked**: decision 4 governs a shipped ceiling whose derivation is sound and whose test has no defect — under decision 1's trigger, under `budget / 2`, never red — and retains it, recording any arithmetic disagreement (the ADR-0057 decision 5 shape; #109's `P2` and full-week); decision 2 governs a budget being set — for the first time, or where decision 1's trigger fires on a shipped budget whose derivation is found never to have followed decision 2 — and sizes it, with decision 4's diagnosis written first where the tripwire is also crossed (#109's `P1` and `P3` ramp). Decision 1's trigger is the discriminator. The tripwire is never itself the reason to raise; this paragraph and *"never a number to raise"* are read together | ADR-0057 decision 5 names *"a ticket that re-derives the budget from a pooled sample across several gate runs and several uncapped local runs"* as the one that settles it *"and it should say which"*; #109 is that ticket, and a reading left in a snapshot is the failure #109 was filed against |

**The reciprocal at ADR-0057 decision 5** (unlettered, in place, after *"Stating that here is the point: the next session should find the disagreement, not a tidy number."*): *(**Answered at #109** — [plan 051](../plans/051-…) §3 D1, recorded as ADR-0055 decision 4 annotation (p): decision 4 governs a shipped ceiling whose derivation is sound and whose test has no defect — retain, record the disagreement, which is what this decision did for the hook; decision 2 governs a budget being set for the first time or one whose derivation is found never to have followed decision 2 — derive, with decision 4's diagnosis written first. Decision 1's trigger discriminates. #109's `P2` and full-week took this decision's shape; its `P1` and `P3` ramp took decision 2's.)* No `**Amends:**` / `**Amended by:**` change on either ADR for (p): a question the ADR asked and left open is answered, not a statement falsified — the same distinction ADR-0055's last Consequence draws for ADR-0017 at #114.

**Adjudicated and NOT annotated:** decision 2's *"a budget sized against CAPPED figures under-shoots"* (still true; §6.3's capped run is labelled as not an anchor); decision 3 (unaffected); the *"measurements do not live here"* consequence (obeyed — no figure enters the ADR beyond the bracketing pair that anchor annotations (l) and (n), which are the qualitative finding's evidence in the ADR's own idiom of "sweep counts stay because the sweep is the warrant"). ADR-0057: decisions 1–4 and 6 untouched; decision 5's *"an eligible LOCAL anchor now exists"* is confirmed by §6.2, not amended. ADR-0017, ADR-0023: untouched, obeyed.

### R2 — `docs/agents/test-ids.md`

- **Frontier row `T-WEB`: `S229` → `S230` next free, `S227` → `S229` highest in use.** Verified: `grep -rhoE "T-WEB-S[0-9]+[a-z]?" apps packages | sort -u | sort -t S -k2 -n | tail -1` → `T-WEB-S229`, at `apps/web/test/fanout-cap.test.ts` (`describe("the worker bound, and the one package that must not carry it (T-WEB-S229)"`). This is a live trap for the next allocator and a one-cell edit; fixed here.
- **A #120 paragraph** (after the #114 one): `T-WEB-S229` was spent by #120 (`36b82b2`) on the worker-bound scan in `fanout-cap.test.ts` **without a reservation paragraph or a frontier update at the time**; recorded at #109 because the frontier row said otherwise. No id was burned.
- **A #109 paragraph**, two lines after the #114 precedent: reserved nothing, spent nothing — `packages/games` carries no ids, the `T-WEB-S43` comment is not a claim, and D5(c), if it fires, edits an existing `it` under an existing id (the `T-WEB-S100` precedent).

### R3 — `.claude/napkin.md`, Execution & Validation item 4 — edited in place

Its clause *"it is currently red ~15 runs in 16 on this box"* is false (plan 049 §2.7; §6.2's `<n>`/3), and *"residuals: #109"* closes. Replace with: uncapped is green on the current box and yields a legal local anchor again (CI still preferred); #109 closed — `P1` 625 000, `P3` ramp 100 000, `T-WEB-S43` bare. **And the new lesson, one sentence in the item's own compressed style:** *on the 2-vCPU gate a CPU-bound test's duration is set by the CPU share it gets beside whatever siblings run concurrently (sudoku `P1` 35 s → 155 s on an unchanged generator, ADR-0055 (n)), so a `budget / 2` tripwire can be crossed with no trigger touched — read the sudoku lines against 312 500 / 50 000 whenever you read a gate log for anything; a hit on unchanged code is the gate's shape (issue #<n>), not the test.* Item 4 is already the longest in the file; nothing else is added and the "15 runs in 16" clause it loses pays for the sentence. Item count stays at 10.

### R4 — `docs/README.md`

One row for `plans/051-…`, appended after the `adr/0057-…` row (napkin Parallel-Stream #1: the row ships in the PR that commits the artifact — build sequence step 1).

### R5 — Issue #109 (living; comments, then close)

The PR carries `Closes #109`. Before merge, once the PR's gate figures are in the body, post one comment on #109 with the verdict table (§8's table, filled) and the PR link, so the verdict lives on the issue and not only in a squash message. Nothing runs post-merge, so auto-close on merge is correct here (unlike #114's `Refs`).

### R6 — Snapshot classes swept, none amended; and the three live `3–4×` citations, adjudicated and left

Plan 042 §2.3's *"verdict one CI figure away, and not decided here"*, plan 044's m9, plan 045's bare-`60000` note, handoff 039 landmine 8, handoff 050 §1's #109 row — all correct as of their dates and left as written. The reverse sweep in §6.5 lists each hit and its class.

Three **live** comments cite the *"CI runners are ~3–4× slower"* factor #109 shows at 4.6–8.4× for the sudoku properties: `apps/web/test/sudoku-hint.test.ts:31` (citing `271a935`, #55's own commit), `apps/web/test/free-play-sudoku.test.tsx:136` (citing handoff 024) and `docs/adr/0040-…md:244`. **Left as written, with the reason here rather than in an edit:** #107 already adjudicated the ~25 old-rule comments as a class (plan 042's MAJ-4, *"shipped timeouts sized under the old rule"*) and left them for a sweep that re-derives, not for a comment edit; each of the three cites the factor as the *history of its own sizing*, and each sits far under its own trigger on the same sweep run — `sudoku-hint` at 4.6 % (5 543 / 120 000) and `free-play-sudoku` at 14.5 % (2 902 / 20 000), plan 042 §2.3 — while ADR-0040's is about sub-millisecond generator CPU where the factor is immaterial. Editing them here would be three comment rewrites in files #109 does not otherwise open, for numbers that do not move; the same napkin Execution #5 standard that puts `P2`'s comment in scope (its file *is* opened, and `P1`'s edit orphans it) keeps these out. If the next sweep re-derives any of them, the citation goes with the number.

### R7 — The gate-shape successor, filed as an issue at build step 2b

The issue's own §2 is that a landmine kept in a snapshot gets rediscovered; a code comment is a snapshot with a different extension. So the successor D1 and §0 item 3 name is a **tracker entry**, created before the header comment is written so `#<n>` is real when it is typed. Label `needs-triage` (docs/agents/triage-labels.md): the remedy is a gate-shape choice — a lane, a runner class with a cost, a split step — that Fernando evaluates before anyone implements it; it is not `ready-for-agent`, and calling it `ready-for-human` pre-decides that a human implements it. Command and body, verbatim:

```
gh issue create --label needs-triage \
  --title "Gate shape for packages/games: a sudoku P1/P3 tripwire on an unchanged generator is the gate's defect, not the test's" \
  --body-file - <<'EOF'
Filed from #109 (plan docs/plans/051-issue-109-plan-the-three-timeout-residuals.md §0, §3 D1, §7 R7).

**Finding.** On the 2-vCPU hosted runner sudoku `P1 — determinism` went 35 220 ms (gate run 30683187834, 2026-08-01) → 155 025 ms (31888933252, 2026-08-15) on a byte-identical generator, tests, fast-check, vitest and Node. The driver is CPU share — how much sibling work executes concurrently with `generate.test.ts` — which saturates once the siblings outlast the file. #109 re-derived P1 to 625 000 ms and P3 ramp to 100 000 ms (ADR-0055 decision 2) and recorded the mechanism as ADR-0055 annotations (l)/(n).

**What this issue owns.** The next time a genuine gate log (`@miolos/games:test` = `cache miss, executing`) shows P1 over 312 500 ms or P3 ramp over 50 000 ms (their `budget / 2` tripwires) with `packages/games/src/sudoku/**` and `test/sudoku/**` unchanged, the remedy is the gate's shape, not another raise. Options to weigh, none chosen here: a dedicated job/lane for `packages/games`; a larger runner class; splitting the test step so the property suite runs beside fewer siblings; and whether `ci.yml` should carry a `timeout-minutes` at all (declined at #109 as a gate-shape decision).

**Not in scope.** Raising either number again; any `numRuns` change (ADR-0023); a vitest config in `packages/games` (ADR-0017); the ×4 multiplier (its own future ticket, ADR-0055 decision 2).

**Trigger to act.** A tripwire hit as above on unchanged code, or the gate's test step wall passing ~8 min on a `Cached: 0 cached` run (4m47s–5m30s today).

Refs: ADR-0055 decision 4 + annotations (l), (n), (p); ADR-0057 decision 3 (CI stays uncapped at fan-out 10); ADR-0057 decision 6 (`maxWorkers` collapses to 1 on the 2-vCPU runner).
EOF
```

Then: `gh issue view <n> --json number,labels,title` pasted; `#<n>` written into §4.1's header comment, R1 (l), R3's napkin sentence and §8's PR body. Blocked by nothing; blocks nothing.

---

## 8. The PR body — template

```
## What changed
- packages/games/test/sudoku/generate.test.ts — P1 240_000 → 625_000; P3 ramp 60000 → 100_000; P2 and full-week retained (240_000, 60_000); header comment rewritten; no numRuns change.
- apps/web/test/nonogram-screen.test.tsx — one comment above the T-WEB-S43 describe; no timeout.
- ADR-0055 annotations (j)–(p) + the `**Amended at #109**` header line; ADR-0057 decision 5 reciprocal annotation and one clause on its `**Amends:**` header ((m)'s reciprocal); docs/agents/domain.md — one sentence extending #116's amendment rule to a ticket that amends an ADR without shipping an ADR of its own, plus the matching clause in its "Who checks"; test-ids.md frontier S230/S229 + two paragraphs; napkin Execution #4; docs/README.md row; docs/plans/051; successor issue #123 filed (gate shape).
- **A rule that landed hours earlier is edited here, deliberately.** #116 (merged as #122, the same day) wrote the amendment rule in `docs/agents/domain.md`; #109 is the first ticket to amend an Accepted ADR with no ADR of its own, so that rule's checker sentence, read literally, fails this PR — every `**Amended by:**` in `docs/adr/` cites an ADR, and this PR's amender is a ticket. One sentence added and the "Who checks" clause widened, in the rule's own terse register (step-6 adherence MAJOR-2).

## Verdicts (ADR-0055 decisions 1, 2, 4)
| test | before | CI pooled max (run id) | % | local pooled max (n uncapped runs) | verdict | after |
|---|---|---|---|---|---|---|
| sudoku P1 | 240 000 | 155 025 (31888933252) | 64.6 %, over budget/2 on 5/7 | <L1> | never derived by decision 2 → set now (decision 2; decision 4 diagnosis discharged, environmental): 155 025 × 4 = 620 100 → | 625 000 |
| sudoku P3 ramp | 60 000 | 24 386 (32083224936) | 40.6 %; trigger fires on 2/7 incl. the max (24 114, 24 386) | <L3> | never derived → set now (decision 2): 24 386 × 4 = 97 544 → | 100 000 |
| T-WEB-S43 rails | 5 000 default | 944 (31888933252) | 18.9 % | <L5> | measured-and-fine, no timeout | 5 000 default |
| sudoku P2 (sibling) | 240 000 | 62 009 (31888933252) | 25.8 % | <L2> | retained; decision 2 would say 250 000, recorded | 240 000 |
| sudoku full-week (sibling) | 60 000 | 8 189 (31888933252) | 13.6 % | <L4> | retained | 60 000 |

The drift, and why it is not the test: P1 35 220 ms on gate 30683187834 (2026-08-01, 39 test files) → 155 025 ms on 31888933252 (2026-08-15, 161 files); generator, tests, fast-check, vitest and Node unchanged in the window. Mechanism: CPU share on the 2-vCPU runner — how much sibling work executes concurrently with the file — which saturates once the siblings outlast it (08-12 measured 77 461 ms with more sibling files than 08-02's 124 686). Plan 051 §0. Which of ADR-0055's decision 2 / decision 4 governs each site: plan 051 §3 D1, recorded as ADR-0055 (p).

## Cost drivers for the two re-derived timeouts (ADR-0055 decision 4 — "named in the PR that adds it")
1. packages/games/src/sudoku/** (generator, grader, counting solver)
2. numRuns, FC_SEED and the two arbitraries in packages/games/test/sudoku/generate.test.ts
3. fast-check's version in packages/games/package.json / pnpm-lock.yaml
4. the gate runner's vCPU count and class (`nproc` on every gate; the gate's --concurrency=10, guarded by T-WEB-S226)
5. the CPU demand of whatever sibling suites execute concurrently with generate.test.ts on the 2-vCPU runner — CPU share, not file count; it saturates once the siblings outlast the file — this is the driver that moved P1 4.4× on an unchanged generator; no per-timeout list can enumerate it, so the routing is: any gate log read for any reason reads the sudoku lines against 312 500 / 50 000 ms; a hit on unchanged code is a gate-shape defect, not a test defect — issue #123.
(Locally, additionally: turbo's concurrency on the root script (ADR-0055 4(f)) — and NOT vitest.shared.ts, which packages/games does not consume.)

## Evidence
- Local uncapped ×3 (eligibility lines + figures) — pasted
- pnpm typecheck / pnpm lint / pnpm test --force (capped) — tails pasted
- This PR's gate: run <id>; games and web `cache miss, executing`; nproc / free -m; the five test lines; Time — pasted. P1 <x> ms (< 312 500), P3 <y> ms (< 50 000).
- Incidental, not acted on: Binairo P1/P2, the three wall first-its, the largest PGlite boot, all from the same three uncapped runs (first post-#120 local readings of #107's five and of the hook).
- Which runs measured which tree: the three uncapped local runs measured the plan-only commit (unedited literals — a literal cannot move a duration); the capped gate run and the PR's own CI gate ran the edited literals.

## Known and left (nothing owed by #109; listed so the next sweep has them)
- ADR-0040:244's live *"CI runners are 3–4× slower"* clause — falsified for the tests ADR-0055 measured, immaterial there (sub-millisecond CPU), and not this ticket's to repair (step-6 adherence MINOR-3).
- apps/web/test/sudoku-hint.test.ts:31 and apps/web/test/free-play-sudoku.test.tsx:136 cite the same 3–4× as the history of their own sizing — adjudicated at #107 (plan 042 MAJ-4), not made false by #109 (§7 R6).
- grade.test.ts's two bare `60000` (10 815 / 4 157 ms = 18.0 % / 6.9 % of budget) — measured, under the trigger, nothing owed, not filed.

## Step-6 reviews
Four lenses ran (ADR/CONTEXT adherence, correctness, issue adherence, quality + performance): three ACCEPT WITH FIXES, performance ACCEPT. Every finding and its disposition is in plan 051 §12 "Step-7 changes"; any dismissal is written out there and repeated here rather than left silent.

## Decisions for Fernando
Three, and none of them is a number.
1. **The decision-2 / decision-4 partition** — ADR-0055 annotation (p), reciprocal at ADR-0057 decision 5 (plan 051 §3 D1). Decision 2 governs a budget being *set* (first time, or one it never derived on which decision 1's trigger fires); decision 4 governs *every other* shipped ceiling — retain, record any arithmetic disagreement beside it, diagnose over `budget / 2`, never raise on the tripwire alone. **Alternative:** read decision 4 as forbidding any raise of a shipped ceiling — then P1 holds at 240 000 with the tripwire recorded as permanently tripped and P3 ramp holds at 60 000; say so on the PR and steps 5–7 re-run for those two numbers only.
2. **Rule (o)** — ADR-0055 decision 2's pooling clause gains: samples taken under a worker configuration no shipped command reproduces are history, not anchors. It is what turns T-WEB-S43 from a 10 000 ms timeout into none. **Alternative:** pool the pre-#120 figures literally and ship a 10 000 ms timeout on a test whose measured maximum is 944 ms.
3. **Annotation or a short ADR-0058 for (o) and (p).** Both ship as lettered in-place annotations. Step 6's ADR reviewer accepted that — (p) was delegated to the settling ticket by ADR-0057 decision 5 and adds no mechanism, (o) is narrow and derived from ADR-0057 decision 6 + (f) — while recording the alternative explicitly: a short ADR-0058 carrying (o) and (p) with `**Amends:** ADR-0055` and the reciprocal `**Amended by:**` fits the amendment rule as written with no new idiom, and is the conservative reading of `CLAUDE.md`'s *"a new technical decision of any weight is an ADR"*. Say the word and it becomes ADR-0058; nothing else changes.

Plus one thing offered for veto rather than decision: the `docs/agents/domain.md` sentence edits a rule #116 shipped the same day (see "What changed").
```

---

## 9. Test ids

None reserved, none spent, none burned. `packages/games` carries no ids (`docs/agents/test-ids.md`: *"verified by grep, and new suites there keep it that way"*). Comment-only and literal-only edits carry no claim (the #114 precedent, `test-ids.md`). D5(c), if it fires, is an edit inside `T-WEB-S43`'s existing `it` and takes no id. The one edit this file receives is the frontier correction in §7 R2, which records an id **another** ticket spent.

---

## 10. Build sequence

0. **Baseline, derived not asserted.** `git status --short` (clean but for this plan), `git log --oneline -1` (`8650cf9`), the four literals grep of §6.1 on the unedited file (expect `240_000`, `240_000`, `60000`, `60000`), `grep -c timeout apps/web/test/nonogram-screen.test.tsx` (0), the `T-WEB` frontier grep (§7 R2 → `S229`), `ls packages/games/vitest.config.*` (none), `grep -n timeout-minutes .github/workflows/ci.yml` (none).
1. **Commit this plan with its `docs/README.md` row**, first commit on the branch (napkin Parallel-Stream #1).
2. **The three uncapped runs** (§6.2), on the branch tree, with the #116 worktree confirmed idle and `nproc && free -m` pasted first. Read and record `<L1>`–`<L5>`, `<n>`, the eligibility lines, the incidental readings.
   - **2b. File the successor issue** (§7 R7) — `gh issue create` verbatim; paste `gh issue view <n> --json number,labels,title`; `#<n>` is now real for steps 3 and 5.
3. **Edit `generate.test.ts`** per §4.1–4.4 with the local figures and `#<n>` filled in. Run §6.1's greps.
4. **Edit `nonogram-screen.test.tsx`** per §4.5 (or D5(c)).
5. **Records**: §7 R1 (ADR-0055 (j)–(p) + header line; the ADR-0057 decision 5 reciprocal), R2 (`test-ids.md`), R3 (napkin, with `#<n>`). Then §6.5's sweep in both directions; paste the mapping.
6. **`git merge origin/main`** (§5.1 — resolve the three surfaces as written there if #116 has landed), then **§6.3**: typecheck, lint, capped `pnpm test --force`. Commit (pre-commit runs the capped suite again; that is fine and is not evidence of anything beyond green).
7. **Push; open the PR** with the §8 body, `Closes #109`. `gh pr view <n> --json closingIssuesReferences` → `[109]`; `gh pr view <n> --json mergeable,mergeStateStatus` → not `DIRTY` (napkin Execution #10 — a dirty PR gets no `gate` at all).
8. **Read the gate log** per §6.4; edit the PR body with the eighth row and the cache-miss lines. Post the verdict comment on #109 (§7 R5) **before merge, never after** (`Closes #109` auto-closes on squash — handoff 048 landmine 4). That comment carries, beyond the verdict table and the eighth-row figures:
   - the **2 368 / 1 959 ms re-label** in the code comment's own vocabulary — *contended local, uncapped, `apps/web` at pre-#120 `maxWorkers = 7`; superseded by the re-take at the shipped bound (624 ms pooled max over 3 runs), CI 944 ms max over 7 and 835 ms on this PR's gate* — because the row in the issue body is Fernando's and stays as written (step-6 issue F2);
   - the note that the issue's own evidence grep **`grep -c timeout apps/web/test/nonogram-screen.test.tsx` now returns 1**, and that the hit is the new comment's own word; `grep -cE 'setConfig|\}, [0-9_]+\);'` is still 0 (step-6 issue F5);
   - one line for the two snapshot-only residuals: `grade.test.ts`'s two bare `60000` and the three live `3–4×` comments are **measured, under trigger, nothing owed, not filed** (step-6 issue F3), with ADR-0040:244 named as the sweep's, not #109's.
9. **Step 6 reviews** — six lenses, one each; a records lens must run the §6.5 sweep itself rather than read this plan's copy of it.
10. **`git merge origin/main` again if `main` moved** (the #116 merge is the expected mover; §5.1), re-run §6.3 if anything merged, wait for the new gate; then **merge on green** (`gh pr merge --squash --delete-branch` from a clean worktree — napkin Shell #5). #109 closes on merge. No post-merge blocks.

---

## 11. Exit criteria

- [ ] `generate.test.ts` carries exactly the four literals of §6.1, in that order, with the four comments of §4.1–4.4 filled (no `<L…>` left) and `numRuns` byte-identical to `main`.
- [ ] `nonogram-screen.test.tsx` carries the §4.5 comment; `grep -cE 'setConfig'` is 0; a timeout exists only if D5(c) fired and then only on the one `it`, with its arithmetic.
- [ ] Three uncapped runs (or fewer, with the reason recorded) — eligibility lines and figures pasted in the PR body.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test --force` green with output pasted.
- [ ] The PR's own gate: both packages `cache miss, executing`; the five test lines pasted; `P1` < 312 500 ms and `P3` < 50 000 ms.
- [ ] ADR-0055 carries (j)–(p) in place plus the header line under #116's flipped Status (if it landed first); ADR-0057 decision 5 carries the reciprocal annotation and no header change; `test-ids.md` frontier reads `S230` / `S229` with the #120 and #109 paragraphs; napkin Execution #4 updated; `docs/README.md` has the 051 row (and 052's beside it if #116 landed).
- [ ] The successor issue exists (`gh issue view <n>` pasted, label `needs-triage`) and `#<n>` is real in `generate.test.ts`'s header, ADR-0055 (l), napkin #4 and the PR body — no `#<n>` placeholder survives (`grep -rn '#<n>' packages apps docs .claude` → only this plan and plan 052, if any).
- [ ] `git merge origin/main` done before §6.3 and again before merge; the three §5.1 surfaces resolved as written (both README rows, 051 before 052).
- [ ] §6.5's sweep pasted as a mapping; every hit accounted for.
- [ ] Cost-driver list in the PR body (§8).
- [ ] Six step-6 reviews satisfied or each dismissal written in the PR.
- [ ] #109 has the verdict comment **posted before merge**, carrying the verdict table, the eighth-row figures, the 2 368 / 1 959 re-label, the `grep -c timeout` = 1 note and the "measured, nothing owed, not filed" line (§10 step 8); PR merged; issue closed.
- [ ] The PR body's "Decisions for Fernando" names (p), (o) and annotation-vs-ADR-0058, each with its alternative — never "None required" (§8; step-6 issue F1).

---

## 12. Open questions and deviation register

### Step-4 changes (2026-08-18, applying the step-3 review — every finding, one line each)

- **B-1** — D1 rewritten: primary warrant is now *never derived by decision 2 → decision 2's first application*, decision 4's diagnosis discharged alongside and its finding environmental; the decision-2/decision-4 reading stated in one paragraph with decision 1's trigger as the discriminator and each of the four sudoku sites assigned; recorded durably as ADR-0055 decision 4 annotation **(p)** plus a reciprocal, unlettered annotation at ADR-0057 decision 5 (R1) rather than an ADR-0058, with the reason and the promotion signal written (D1, §1).
- **D-1** — supersession of the pre-#120 `T-WEB-S43` figures lettered as ADR-0055 decision 2 annotation **(o)** with its warrant (ADR-0057 decision 6 makes the bound universal; decision 4(f)'s reasoning); D7 says what decision 2 applied literally would give (10 000 ms) and corrects "cannot be run" → "no shipped command runs"; the (j)–(p) mapping is complete and each letter says what it corrects.
- **A-1 / F-1** — mechanism reworded to CPU share (saturating once siblings outlast the file; the 08-12 row as the falsifier of the linear reading) in §0, §4.1's header comment, R1 (l) and (n), §8's drift sentence and cost-driver 5, R3's napkin sentence and the README row; the "will keep drifting" prediction dropped; bracketing run ids kept.
- **C-1** — D2 rests on never-derived + trigger fires on two of seven including the max (24 114 = 40.19 %, 24 386 = 40.6 %) + the issue's second-sample condition discharged; the 1.23×-tripwire argument demoted to a consequence and said to be the same argument ADR-0057 decision 5 rejected for the hook; §4.4 "under on five of seven" → "over on two of seven"; §2.2 and §8 rows updated.
- **G-1** — successor filed as a GitHub issue: R7 drafts the `gh issue create` (title, ≤15-line body, `needs-triage`), build step 2b runs it before the header comment is typed, `#<n>` placeholders in §4.1, R1 (l), R3, §8; exit criterion added.
- **I-1** — §6.1's two `numRuns` checks replaced by `grep -nE 'numRuns: [0-9]+'` (expected: three lines, `100`, `100`, `35`; on `main` at :56/:91/:112 — run at step 4) and a diff-grep on `numRuns: [0-9]+` (empty); the bare `grep -c` (7 on `main`) named as the wrong instrument.
- **J-1** — §5.1 names the three #116 conflict surfaces (ADR-0055 line 3 vs line 4/(j)–(p); README row after `adr/0057` — both rows, 051 before 052; napkin #5 vs #4), the merge order (#116 first expected), and `git merge origin/main` before gates (step 6) and before merge (step 10); §11 gains the criterion.
- **I-3** — the provenance rule and §6.4 use `perl -pe 's/\^\[\[[0-9;]*m//g'` for `gh` logs with the reason (`[0-9]{4,}ms` will not match `155025^[[2mms`); §6.2 keeps the `\x1b` form for local logs and says why; §4.1's header carries the strip pattern (H-3).
- **E-1** — §6.2 eligibility anchored on vitest's summary lines (`Test Files .* failed|Tests .* [1-9][0-9]* failed| FAIL `) plus the six `Test Files … passed` lines; the bare `Error: ` dropped.
- **E-2** — §6.2 requires the #116 worktree idle (serialised) and pastes `nproc && free -m` before the loop; the loop shows it.
- **F-2** — (m) kept, one sentence, #120 named as the origin of the omission; no hedging; §8 and §12 lose the "struck" branch.
- **F-3** — (k) attributes the un-updated clause to #114's records omission discovered at #109, exactly as (m) does for #120.
- **F-4** — sweep pattern widened to `3[-–]4.?[x×]` (the review's `3.?4.?[x×]` also matches `34px` twice — noted); the three live hits (`sudoku-hint.test.ts:31` verified to exist, `free-play-sudoku.test.tsx:136`, ADR-0040:244) adjudicated in R6 and left, with the reason.
- **F-5** — `P2` and full-week read from all seven runs at step 4 (`41 746 / 57 184 / 61 783 / 57 214 / 32 122 / 56 202` and `5 883 / 7 975 / 7 734 / 8 072 / 4 509 / 4 391` for the five middle runs and the newest, verified against the live logs with the perl strip); §2.1 is a full seven-sample table, both maxima unchanged (`31888933252`); §4.4's full-week clause now says "over the same seven runs".
- **H-1** — §4.2 and §4.4 state the % of the shipped budget (24.8 %, 24.4 %) and of `budget / 2` (49.6 % of 312 500, 48.8 % of 50 000); "over that budget's / 2" → "over its budget / 2 = 120 000 ms".
- **H-2** — §4.4 carries C-1's two-of-seven and F-5's provenance.
- **H-3** — §4.1 carries A-1's mechanism and the gh-log strip pattern.
- **D-2** — §4.5 cut to eight lines: verdict, both figures with run id, the reproduce command, one clause on the superseded figures pointing at (o); the `T-WEB-S48` line dropped (lives in ADR-0055 (d) and on the issue); D5(d) says so.
- **B-2** — D1's "Why 625 000" adds the pre-commit case (a hang holds a commit ~10 min instead of ~4) and "nothing it exceeds or makes meaningless".
- **B-3** — "coin-flip class" replaced by "a thin ceiling on a heavy-tailed quantity — not yet a coin flip at 7/7 green".
- **G-3** — §1 item 7 keeps the one-line reason per record item; (o) and (p) added to it.
- **F-6** — R2's #109 paragraph cut to two lines.
- **F-7** — R3's lesson is one sentence with the CPU-share mechanism.
- **F-8** — README row rewritten for A-1's mechanism, (m) as decided, (j)–(p), the reciprocal, the successor issue and B-1's warrant order.
- **I-4** — §8 "Decisions for Fernando" states the decision-4 reading for veto instead of "None".
- **Not applied: none.** Every finding in the review is applied above; where a choice was open (B-1 annotations vs ADR, D-1 (o) vs pool, F-2 keep vs strike, F-4 pattern) the choice and its reason are in the section that owns it.

### Deviation register (steps 5–8 append here)

*A dated entry per deviation from §3–§10, with the reason, and a note against any of the following that changed:*

- the local figures `<L1>`–`<L5>` and `<n>` as taken (§6.2), and whether any run was disqualified and why;
- whether D5(c) fired;
- the successor issue's number (§7 R7) and that every `#<n>` was replaced;
- whether #116 landed first and how the three §5.1 surfaces were resolved;
- whether step 6's ADR-adherence reviewer asked for annotation (p) to be promoted to an ADR-0058 (D1);
- anything the PR's own gate row (§6.4) showed that this plan did not predict — in particular a `P1` figure over 312 500 ms, which stops the merge.

#### Step-5 entries (2026-08-18)

- **The local figures, as taken (§6.2).** Box: `nproc` = 8, `free -m` = 15 993 MB total / 14 499 MB available / 4 096 MB swap — a **16 GB** box, not the 23 552 MB handoff 050 records (the box has changed again; recorded here and in ADR-0055 (k)). Nothing but the agent session's MCP servers resident; the #116 worktree idle (its PR merged during this step, see below). Three uncapped runs `MIOLOS_TEST_DB_TIMING=1 pnpm test --force --concurrency=10`, logs at `~/miolos-session/109-runs/run-{1,2,3}.log`; **all three eligible** — 0 `Test timed out`/`Hook timed out`/`FAIL`, six `Test Files … passed` lines each (ui 1 · core 23 · db 8 · api 26 · web 78 · games 28; 1 912 tests), `6 successful, 6 total`, `0 cached, 6 total`, 0 `ELIFECYCLE`, `exit=0`; turbo `Time:` 56.402 s / 52.027 s / 56.412 s. **No run disqualified, no replacement taken; `<n>` = 3.** Per test (run 1 / 2 / 3 → pooled max): `P1` 40 339 / 36 106 / 40 844 → **`<L1>` = 40 844**; `P2` 9 551 / 9 870 / 9 438 → **`<L2>` = 9 870**; `P3` ramp 3 689 / 3 711 / 3 666 → **`<L3>` = 3 711**; full-week 1 251 / 1 288 / 1 259 → **`<L4>` = 1 288**; `T-WEB-S43` rails 506 / 488 / 624 → **`<L5>` = 624** (the line was present in all three runs; `nonogram-screen.test.tsx (58 tests)` at 7 337 / 5 381 / 8 300 ms). Every local maximum sits far under its CI maximum, so CI is the anchor at every site and no verdict moved. Incidental (§8): Binairo `P1` 3 814 / 2 441 / 4 349, Binairo `P2` 2 883 / 3 049 / 2 530; wall first-`it`s `T-LINT-1` 3 520 / 2 975 / 1 919, `T-LINT-S9` 1 250 / 1 004 / 1 031, `T-LINT-S41` 1 273 / 1 354 / 1 062; largest PGlite boot `total_ms` 7 843.5 / 7 137.4 / 10 162.7 (all under 30 000; 10 162.7 is 33.9 % of the hook budget, under the trigger).
- **D5(c) did not fire.** Rails pooled local maximum 624 ms against the 2 000 ms trigger (12.5 % of the default; the 1 800 ms "by how little" band not approached). `nonogram-screen.test.tsx` carries the §4.5 comment and no timeout.
- **Successor issue: #123** (`gh issue view 123` → label `needs-triage`, title as R7). Every `#<n>` replaced — `generate.test.ts` header, ADR-0055 (l) and (n), napkin #4; `grep -rn '#<n>' packages apps docs .claude` outside this plan returns only two pre-existing, unrelated hits (`docs/agents/issue-tracker.md:42`, `docs/handoffs/048-…md:88`).
- **Build-sequence order, one swap.** Step 2b (file the issue) ran while the three runs were executing rather than after them — a `gh` call is negligible load and the runs were already in flight; the tree the runs measured is the plan-only commit `20d45a5`, unedited. And **§10 step 6's "merge, then gates, then commit" ran as "commit, then merge, then gates"**: `git merge origin/main` refuses with the six edited files uncommitted, and the alternative (stash / merge / pop) reproduces the same three §5.1 conflicts inside a stash pop. So the work is committed first (pre-commit runs the capped suite on the pre-merge tree), `origin/main` is merged and the three surfaces resolved as §5.1 says, and §6.3's full gate runs on the merged tree before push. Nothing in this changes a figure or a verdict.
- **#116 landed first** (`6829cf8`, PR #122 merged during this step, as §5.1 expected) and was merged into this branch as `4403df0`, the three surfaces resolved as written: ADR-0055 line 3 is #116's `**Status:** Accepted — 2026-08-16 (issue #107, shipped in #112)` with #109's `**Annotated at #109**` line under `**Amended by:**` (git auto-merged; verified by eye); `docs/README.md` was the one textual conflict and carries both rows, 051 then 052; `.claude/napkin.md` auto-merged with Execution #4 (ours) and #5 (theirs) both kept, item count unchanged. ADR-0057 line 3 flipped to Accepted by #116 and its decision-5 reciprocal from #109 auto-merged. #116's lifecycle rule in `docs/agents/domain.md` — *"Amendment moves neither status nor date … in-place annotation on the amended one"* — is exactly the shape (j)–(p) and the reciprocal take; nothing in it changes anything here.
- **§6.3 on the merged tree**: `pnpm typecheck --force` — 6 successful, 0 cached, 6.122 s; `pnpm lint` — `eslint --max-warnings 0 .` exit 0; `pnpm test --force` (capped) — 6 successful, 0 cached, 41.232 s, every package green (ui 1/3 · core 23/205 · db 8/97 · api 26/246 · games 28/187 · web 78/1174). Capped sudoku readings, acceptance not anchors: `P1` 21 016 ms, `P2` 9 833, `P3` ramp 3 855, full-week 1 292 — the shipped ceilings hold under the shipped configuration.
- **R2 widened by one sentence.** The frontier's provenance line ("Frontier as of plan 049 (#114), re-derived … at its step-7 exit") is updated to "as of plan 051 (#109)" with a pointer at the new #120 paragraph — the row it introduces was re-derived here, and leaving the provenance on #114 would have the sentence and the row disagree. Comment-class edit, no id involved.
- **ADR-0055 annotation (o) placement.** R1 says "decision 2, after the third consequence — the pooling clause"; it is placed as its own italic paragraph immediately after the third consequence's paragraph (which carries (k)) and before the *"And the corollary…"* paragraph, so (k) and (o) read in sequence and the pooling clause they both amend is the paragraph above them.

#### Step-7 changes (2026-08-18, applying the four step-6 reviews — every finding, one line each)

**Deviations this round records, over and above the findings:**

- **The (p) reading is restated as a partition, and this plan's §3 D1 second paragraph is the pre-partition wording.** D1 stated decision 4's domain by #109's instances — *"a shipped ceiling whose derivation is sound and whose test has no defect — under decision 1's trigger, under `budget / 2`, never red"* — which leaves the commonest future case ungoverned: a budget decision 2 *did* derive, sitting at 25 % of its own budget by construction, on which a later sample fires the 40 % trigger exactly as decision 2's residual predicts. What ships instead, in ADR-0055 (p) and, as a pointer plus a one-line verdict, at ADR-0057 decision 5: **decision 2 governs a budget being SET** — first time, or a shipped budget decision 2 never derived on which decision 1's trigger fires, with decision 4's diagnosis written first where the tripwire is also crossed; **decision 4 governs every other shipped ceiling** — whether or not the trigger fires (on a decision-2-derived budget it is expected to, anywhere between 1.6× and 2× the anchor), whether or not decision 2 derived it — retain, record any arithmetic disagreement beside it, diagnose over `budget / 2`, never raise on the tripwire alone. Every #109 verdict is unchanged by the restatement; `P2`'s "sharp edge" now follows from the rule instead of patching it. §3 D1 is left as written — a plan is a snapshot — and this entry is where the two disagree.
- **`docs/agents/domain.md`'s amendment rule, shipped by #116 hours earlier, is extended by one sentence here.** #109 is the first ticket to amend an Accepted ADR decision-level with no ADR of its own: every `**Amended by:**` in `docs/adr/` cites an ADR, so the rule's checker sentence read literally fails this PR. The sentence names the `**Amended at #N**` header idiom, makes the plan's records section the reciprocal, and repeats `CLAUDE.md`'s exception ("a new rule of any weight is an ADR"); the "Who checks" clause gains *"or `**Amended at #N**` where the amender is a ticket"*. Register kept terse, per #116. Surfaced in the PR body's "What changed" so it is a visible edit to someone else's rule and not a silent one.

**ADR / CONTEXT adherence lens**

- **MAJOR-1** — applied, in all three places: ADR-0055 (p) rewritten as the partition above (one paragraph); ADR-0057's decision-5 reciprocal trimmed to a pointer at (p) plus the one-line verdict for the hook (also quality A7); this register's deviation line above. The header bullet (p) now reads *"stated as a partition, with decision 1's trigger as the discriminator on the setting side"*.
- **MAJOR-2 (a)** — applied: ADR-0055 line 5 `**Annotated at #109**` → `**Amended at #109**`; the rest of the line unchanged.
- **MAJOR-2 (b)** — applied: one sentence in `docs/agents/domain.md` plus the "Who checks" clause, as above.
- **MAJOR-2 (c)** — applied: §8's "Decisions for Fernando" now names (p), (o) and annotation-vs-ADR-0058, each with its alternative. No ADR-0058 is filed; the reviewer did not demand one and accepted both annotations.
- **MINOR-1** — applied: (o) gains both bounding clauses — *"shipped"* = a configuration an ADR names as a measurement configuration (the gate's command, decision 2's uncapped local command), a bare flag override no ADR names is not one; *"worker configuration"* = the configuration of the population's OWN package, a sibling package's change moving the contention basis ((f), (m)) and owing a re-measure rather than a discard.
- **MINOR-2** — applied: ADR-0057's `**Amends:**` header gains *"— and decision 6's worker bound joins decision 4's cost-driver list, recorded at #109 as ADR-0055 annotation (m)"*.
- **MINOR-3** — no edit, as the reviewer said; ADR-0040:244's live *"3–4×"* clause is listed in §8's new "Known and left" block for the PR body.
- **MINOR-4** — applied: `generate.test.ts`'s *"apps at #120's worker bound, packages/games at cpus - 1"* → *"every workspace but packages/games at #120's bound"*; the rails comment names the `it` (*"renders one labelled rail per row and per column"*) instead of *"the rails test below"*. The *"re-derived"* / *"never derived → first application"* phrasing pair is left as the reviewer allowed, and is noted here so a later reader does not read it as an oversight. The PR body's decision-4 obligation is step 8's, in §8 and §11.

**Correctness lens**

- **F1** — applied: *"the file measures 218–250 s"* → *"137–250 s"* in `docs/README.md`'s 051 row and in §1 item 6 (the seven genuine samples are 136 933–249 512 ms; the conclusion the sentence draws is unaffected).
- **F2** — applied: `P1 / P2 = 2.48 on CI` → `≈ 2.5 on CI — 2.39–2.68 across the seven runs`.
- **F3** — applied: napkin #4's *"since the box grew and #120 bounded the workers"* → *"with #120's worker bound it is green on the 16 GB / 8-core box"*. The box at #109 is 15 993 MB, not handoff 050's 23 552 MB; the causal claim the ticket's own data contradicts is gone.
- **F4** — applied with F4's own suggestion: header bullet (o) now says *"See the annotation there"*, matching (l)/(m)/(p), since (o) amends the pooling clause rather than a consequence.
- **F5** — no edit: napkin #4's closing *"residuals closed at #109 (plan 051)"* is the post-merge state the napkin describes, and the item is only true once step 8 merges. Recorded here rather than hedged in the napkin.

**Quality / maintainability lens**

- **A1** — applied: both leaked `(load-bearing)` plan tags deleted from shipped comment text; the header's became prose (*"— the load-bearing finding:"*), the `P1` site's is gone entirely.
- **A2 / A3 / A4** — applied: the `P1 / P2` ratio takes the max-plus-range idiom (F2); `P2`'s figure line now reads *"the pooled maximum over the same seven genuine runs (31888933252; 32 122–61 783 ms on the other six)"* — no time-relative word, same idiom as the other three sites, and it answers the issue lens's F4 in the same edit; both blocks reflowed.
- **A5** — applied: millisecond measurements are out of ADR-0055's annotations, per that ADR's own Consequence. (j) keeps the verdicts and the shipped budgets and points at plan 051 §2.1/§12 and the PR body; (o) keeps the counterfactual 10 000 ms (a budget, not a measurement) and drops `2 368 × 4 = 9 472` and the 624 ms re-take; (l) keeps the qualitative drift (4.4×) and both run ids; (n) points at (l) rather than repeating the pair. (k) is unchanged — `16 GB, 8 cores, 15 993 MB` names the box class, not a duration, which A5 explicitly allows.
- **A6** — applied: header bullet (n) *"Rewritten in place"* → *"Annotated in place"*.
- **A7** — applied together with MAJOR-1: the ADR-0057 reciprocal is a pointer at (p) plus the one-line verdict; the partition itself is stated once, in ADR-0055 (p).
- **A8** — applied, partially by the number: napkin #4 is 2 500 → 2 104 characters, with the two history parentheticals and the closing verdict list dropped and the causal clause fixed (F3). It does not reach the reviewer's ≤1 900 target because the item now also has to carry (o), (p) and the CPU-share mechanism, which the pre-#109 1 798-character version did not; every sentence left is a rule, not a record.
- **A9** — dismissed with reason: the `gh run view --log` colour-strip stays. It is plan H-3's, and it is the difference between a grep that finds a CI figure and one that silently does not (`[0-9]{4,}ms` does not match `155025^[[2mms`) — a reader re-deriving a figure from a gate log needs it at the point of use.
- **A10** — applied: §8's `#<n>` placeholders are `#123`.
- **A11 / A12 / A13** — info, nothing owed; the two pending items A13 names are discharged by this round (the (p)-promotion question answered above, the §6.4 gate row recorded at step 5).
- **B1–B6** — lens B is ACCEPT; no edit. The raised red-run worst case (~+6.4 min on a genuine `P1` hang) is stated in §3 D1 and in the PR body's cost section.

**Issue-adherence lens**

- **F1** — applied: §8's "Decisions for Fernando" is no longer "None required" (MAJOR-2 (c) above).
- **F2 / F3 / F5** — step-8 items by construction; written into §10 step 8 and §11 so the closing comment cannot miss them (the 2 368 / 1 959 re-label, the `grep -c timeout` = 1 note, the "measured, nothing owed, not filed" line).
- **F4** — applied in the `P2` comment (A3's edit carries it): *"the pooled maximum over the same seven genuine runs"*.
- **F6 / F7** — info; F6's "which runs measured which tree" is now an explicit line in §8's Evidence block.
