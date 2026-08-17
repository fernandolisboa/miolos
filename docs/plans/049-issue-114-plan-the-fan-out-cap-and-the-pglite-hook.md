# Implementation plan — Issue #114: the fan-out cap and the PGlite hook

**Issue:** [#114](https://github.com/fernandolisboa/miolos/issues/114), absorbing [#110](https://github.com/fernandolisboa/miolos/issues/110)
**Branch:** `fix/114-pglite-hook-timeout` (off `main` @ `326efd8`)
**ADR:** 0057 (new) + amendments to ADR-0055, annotation on ADR-0017
**Test ids:** `T-WEB-S225…S228`
**Revision:** rewritten at step 4 after four independent step-3 REJECTs. §0.2 lists what changed and why; §12 is the deviation register.

**Measurements:** taken in `~/miolos-114-logs/` (untracked, session-local). **§2 of this plan is their tracked home** — every figure this plan, ADR-0057, the canonical comment or the PR body states is reproduced there, so the warrant survives the session that produced it.

---

## 0. What this plan inherits, and what it corrects

### 0.1 Corrections to the brief, re-derived on this tree

Handoff 048 §4's durable finding is that a document's claims about *itself and its neighbours* rot faster than its claims about code. Three claims arrived with this ticket. Every count below was produced by the command printed beside it, run on this tree at `326efd8` + the working-tree instrument — none is copied from the brief, from `~/miolos-114-logs/FINDINGS.md`, or from the previous revision of this plan.

1. **"Seven shipped comments say *PGlite boot + real-migration replay*."** False twice over.

   ```
   F=$(grep -rl 'await createTestDb' apps packages --include='*.test.ts' --include='*.test.tsx' | sort)
   echo "$F" | xargs grep -l 'PGlite boot + real-migration replay'   # → 2 files
   echo "$F" | xargs grep -lE '~1\.2 ?s' | wc -l                     # → 21
   ```

   **Two** files carry that exact phrase (`packages/db/test/published.test.ts`, `packages/db/test/remote-config.test.ts`). A **third** spelling of the same over-weighting exists and no sweep for `real-migration replay` finds it: `apps/api/test/session.test.ts` says *"WASM Postgres boot + migration replay ~1s"*. The class that actually needs fixing is larger and different in kind — **21 of the 26** files carry a `~1.2 s` boot-cost sentence and **19 of those name no cost component at all**, which is under-specification rather than over-weighting. §4 is the full derived census.

2. **"Twenty-six files do `await ctx.close()` in `afterAll`."** True, verified exhaustively rather than sampled — all 26 `afterAll` bodies are `await ctx.close();`, two of them followed by `vi.restoreAllMocks()` (`apps/api/test/cron-publish.test.ts`, `packages/db/test/remote-config.test.ts`), and none of the 26 carries an explicit hook budget.

   ```
   grep -rhoE "^[[:space:]]*afterAll\(" apps packages --include="*.test.ts" --include="*.test.tsx" | wc -l   # → 26
   echo "$F" | xargs grep -A4 '^afterAll(' | grep -cE '\}, [0-9_]+\);'                                       # → 0
   ```

   **This is now a finding, not a work item**: D3 is dropped (§3 D3), so this plan changes no `afterAll` body. The unmeasured teardown population is recorded as an ADR-0057 residual instead.

3. **"`T-DB-S59` is next free."** True, and irrelevant — with D3 dropped, **no `T-DB` id is reserved at all** (§10). The frontier, re-derived for all five areas with the published numeric command from `docs/agents/test-ids.md`:

   ```
   for A in CORE DB API WEB LINT; do
     grep -rhoE "T-$A-S[0-9]+[a-z]?" apps packages | sort -u | sort -t S -k2 -n | tail -1
   done
   # → T-CORE-S84  T-DB-S58  T-API-S107a  T-WEB-S222  T-LINT-S46
   ```

   Next free with the burn table applied: `S86` / `S59` / `S109` / `S225` / `S47`. Matches `docs/agents/test-ids.md`'s frontier table exactly.

Two further numbers verified, not recalled: `ls docs/adr/ | tail -1` ends at `0056`, so **ADR-0057** is free; `ls docs/plans/ docs/handoffs/` ends at `048` once this file is excluded from its own baseline (handoff 048 §4's counted-its-own-probe failure), so **plan 049** is free. No open pull request holds either.

**A near-miss worth recording so a later sweep does not trip on it.** `grep -rl createTestDb` over test files returns **27**, not 26: `apps/web/test/eslint-db-wall.test.ts` contains `'import { createTestDb } from "@miolos/db/testing";'` twice as *string fixtures* inside the wall's lint probes. The 26-file set is `grep -rl 'await createTestDb'`. Any grep in this plan or its PR body that returns 27 has caught the wall, not a call site.

### 0.2 What step 3 falsified, and what this revision changed

Four reviewers rejected the previous revision. **No reviewer faulted the diagnosis, the memory model, the sweep table or the cap's value** — every blocker was a claim the plan made about another document, about the tree, or about itself. The substantive changes:

- **D3 (`closeTestDbs()`, the registry, the 26-file `afterAll` rewrite) is dropped entirely.** Its rationale was falsified by measurement. §3 D3 records the decision, the evidence, and the part of the finding that survives.
- **The mechanism in §2.4 was wrong and is rebuilt.** The abandoned client is not "unreachable for the rest of that worker's life" — a worker's life is one file. What is true is that a killed hook does not stop its boot.
- **The canonical comment (D6) is rewritten from scratch.** Its previous text carried three defects that would have shipped into `packages/db/src/testing.ts`: a false 21-file attribution, a misquoted "self-refuting arithmetic" argument that dropped the `+ margin` term from a sentence it quoted *including* `+ margin`, and a misquotation of ADR-0055 decision 4. It now carries the **uncapped** figure and says plainly that the class is avoided, not closed.
- **The acceptance section is rebuilt.** #114's AC2 is reported **failed**, with a measured negative taken **on the shipped tree** rather than on the pre-fix tree. The re-reading of AC2 is **proposed for Fernando's confirmation, not enacted** — and so is the identical re-reading #107's AC1 needs. Neither ticket closes on this point in this round.
- **The comment census is written** (§4) — the previous revision cited a "§4.2" that did not exist.
- **R2e (ADR-0055 Proposed → Accepted) is dropped.** Eight ADRs sit at Proposed and all eight shipped; no lifecycle rule exists (§8 R2).
- **ADR-0057 carries qualitative findings only**, per ADR-0055's own Consequences. The numbers live here in §2 and in the PR body.
- **The scan tests move to `apps/web/test/`** and take `T-WEB` ids; their placement was decided before the reservation, not after.

### 0.3 Scope decisions taken by Fernando, not re-opened

- **#110 is absorbed into #114.** The cap ships here carrying the memory evidence #110 asked for. **#110 closes as delivered-by-#114** — it is the only issue this round closes.
- **The timing instrument ships.** It is the only working-tree modification today (`packages/db/src/testing.ts`).
- **D3 is dropped.** Reason stated in §3 D3.
- **Acceptance is reported failed; the re-reading is proposed, not enacted.** Neither #114 nor #107 closes until Fernando confirms.
- **ADR-0023 stands.** No `numRuns` moves. `packages/games` is not touched at all.
- **Never `--no-verify`.**

---

## 1. Scope & non-goals

### In scope

1. A turbo concurrency cap on the root `test` script, **local-binding only**, with CI held uncapped by an explicit flag.
2. The PGlite boot timing instrument, shipped and documented (already in the working tree), and **turned on at the CI gate** so the hook population gets its first eligible measurement.
3. The hook budget: **kept at 30 000 ms**, with a conformant arithmetic comment written once at the cost driver and pointed at from all 26 sites.
4. Records: ADR-0057; five amendments to ADR-0055; an ADR-0017 annotation; three napkin items; `docs/agents/test-ids.md`; two `docs/README.md` rows plus one **correction** to an existing row.
5. Acceptance evidence, stated honestly: AC2 as written is reported **not met**, measured on the shipped tree, with a re-reading proposed for confirmation.
6. Issue hygiene: comments on #114, #110, #109 and #107. **#110 closes. #114 and #107 do not.**

### Explicitly out of scope, with reasons

- **`createTestDb`'s teardown lifecycle** — the whole of the previous revision's D3. Dropped at step 4 on measured evidence; see §3 D3. Nothing in `packages/db/src/testing.ts` changes except the comment block.
- **`packages/games`.** ADR-0023 floors `numRuns`; #109's two sudoku rows are its business, not this ticket's. Zero files touched.
- **Re-sizing any `testTimeout`.** The four web tests that went red in the J-block (§2.6) were measured under a configuration this plan does not ship, and ADR-0055 decision 2 forbids anchoring on a run in which anything timed out. Sizing them here would size against #114.
- **`#109`'s three residuals.** Not fixed. §9.4 posts the file-scoped correction it is owed and nothing more.
- **`--maxWorkers` on any package script.** Measured inert: G1 (default turbo, db+api at `--maxWorkers=3`) was still **red**, at 9 097 MB and two test timeouts. It costs six comment-free JSON edits and does nothing on CI where vitest already computes 1.
- **`turbo.json`'s top-level `concurrency`.** Global-only in turbo 2.10.8's schema, breaks `pnpm dev` below 3, and would silently cap `pnpm typecheck`. Measured in #110; re-verified here only to the extent of confirming `turbo.json` carries no such key today.
- **Any `vitest.config.ts` addition.** None is needed; ADR-0017 permits one only where defaults don't suffice, and after the cap they do.
- **ADR status lifecycle.** Eight ADRs sit at Proposed. Named as a separate records ticket in §8 R2, not done here.
- **Handoff files.** `docs/handoffs/` and `docs/plans/` are snapshot classes and are never rewritten (`docs/README.md`). Handoff 048 landmine 1 already says `TURBO_CONCURRENCY=1` retires the moment #114 lands; it is correct as written and needs no edit.

---

## 2. The measured facts this plan turns on

**This section is the tracked home for the diagnosis figures.** ADR-0055's Consequences forbid an ADR carrying a measurements appendix, so ADR-0057 keeps only the qualitative findings and points here; the same table goes in the PR body. Raw logs are in `~/miolos-114-logs/`, which is untracked and will not survive the session — nothing below depends on it.

Box: WSL2, `nproc`=8 (host Ryzen 9 9950X3D), 15 545 MB RAM, 4 GB swap. All runs `pnpm test --force --env-mode=loose` with `MIOLOS_TEST_DB_TIMING=1`. `--env-mode=loose` was required because turbo's strict env filtering drops an undeclared variable — the trap D7 fixes.

### 2.1 The boot is WASM, not migration

Five serial boots in one process:

```
run 0: pglite=1105.7ms  drizzle=1.0ms  migrate=28.4ms  total=1135.1ms   <- cold
run 1: pglite= 778.3ms  drizzle=0.4ms  migrate=19.1ms  total= 797.9ms
run 2: pglite= 699.8ms  drizzle=0.5ms  migrate=17.9ms  total= 718.2ms
run 3: pglite= 694.7ms  drizzle=0.3ms  migrate=19.6ms  total= 714.6ms
run 4: pglite= 682.4ms  drizzle=0.5ms  migrate=20.5ms  total= 703.4ms
```

**`initdb`/WASM is ~97 % of the cost; the six-migration replay is 17.9–28.4 ms, under 3 %.** The shipped comments' `~1.2 s` is right for a cold boot. What is wrong is the *attribution*, and it is wrong in **3 of 26 files**, not 21 — the other 18 name no component at all (§4).

### 2.2 The cause is memory exhaustion, not CPU oversubscription

At default fan-out, E1's sampler recorded `MemAvailable` at **135 MB** of 15 545, swap **1 348 MB**, load average **34.43**, peak summed RSS **15 484 MB** across 33 processes over 50 MB, largest single worker 1 242 MB.

Six packages carry a `test` script (`apps/web`, `apps/api`, `packages/games`, `packages/db`, `packages/core`, `packages/ui`, each `vitest run`); vitest's forks pool defaults to `maxWorkers = max(cpus − 1, 1) = 7` each. The model, confirmed against three RSS samples:

```
peak RAM  ~=  packages_concurrent  x  (cpus - 1) workers  x  ~450 MB
   6 packages -> ~19 GB demanded vs 15.5 GB available -> exhaustion   (15 484 MB measured)
   3 packages -> ~9.5 GB                                              ( 9 841 MB measured)
   2 packages -> ~6.3 GB                                              ( 8 042 MB measured)
```

A 1.75× CPU oversubscription cannot turn a 1.1 s boot into a 50 s boot. Swap thrash can, and did.

**The constant's limit, stated where it is used.** `~450 MB` is a fleet average across six heterogeneous suites. A *PGlite-bearing* worker is heavier: a single booted PGlite measures ~700 MB RSS pre-GC and ~343 MB steady. So the model is a fleet estimate and not a per-worker bound, which is why D2 rests on the two **direct** whole-run samples (ADV1, M1) rather than on the constant.

### 2.3 The concurrency sweep

| id | config | rc | elapsed | hook TO | test TO | max boot | peak boots | peak RSS |
|---|---|---|---|---|---|---|---|---|
| B1 | default fan-out, hooks lifted to 600 000 | 0 | 92 s | 0 | 0 | 14 316.6 ms | 14 | — |
| C1 | default, hooks 30 000 | 1 | 78 s | 0 | 1 | — | 14 | — |
| D1 | default, hooks 30 000 | 1 | 100 s | 7 | 0 | **53 429.8 ms** | 14 | — |
| D2 | default, hooks 30 000 | 1 | 79 s | 7 | 0 | 41 690.7 ms | 14 | — |
| D3 | default, hooks 30 000 | 1 | 79 s | 7 | 0 | 37 021.9 ms | 14 | — |
| E1 | default, hooks 30 000 | 1 | 96 s | 7 | 0 | 47 720.3 ms | 14 | **15 484 MB / 33 procs** |
| F1 | default, hooks 30 000 | 1 | — | 7 | 0 | 38 829.9 ms | 14 | 15 484 MB / 33 procs |
| G1 | default turbo, db+api `--maxWorkers=3` | 1 | 107 s | 0 | 2 | 26 985.1 ms | — | 9 097 MB / 27 procs |
| J1 | default, hooks 60 000 | 0 | 97 s | 0 | 0 | 21 975.7 ms | 14 | — |
| J2 | default, hooks 60 000 | 1 | 100 s | 0 | 3 | 39 098.4 ms | 14 | — |
| J3 | default, hooks 60 000 | 1 | 112 s | 0 | 4 | 43 797.5 ms | 14 | — |
| K1 | TC=3, hooks 30 000 | 0 | 120 s | 0 | 0 | 19 948.6 ms | 12 | — |
| K2 | TC=3, hooks 30 000 | 0 | 103 s | 0 | 0 | 20 760.3 ms | 14 | — |
| K3 | TC=3, hooks 30 000 | 0 | 104 s | 0 | 0 | 15 704.5 ms | 10 | — |
| H1 | TC=3, hooks 30 000 | 0 | 98 s | 0 | 0 | 17 513.1 ms | — | 9 841 MB / 25 procs |
| TC2-1 | **TC=2**, hooks 30 000 | 0 | 97 s | 0 | 0 | 10 237.3 ms | 7 | — |
| TC2-2 | **TC=2**, hooks 30 000 | 0 | 61 s | 0 | 0 | **11 007.8 ms** | 7 | — |
| TC2-3 | **TC=2**, hooks 30 000 | 0 | 42 s | 0 | 0 | 3 051.7 ms | 7 | — |
| M1 | **TC=2**, hooks 30 000 | 0 | 42 s | 0 | 0 | 3 261.7 ms | — | **8 042 MB / 16 procs** |
| TC4-1 | TC=4, hooks 30 000 | 0 | 52 s | 0 | 0 | 5 483.7 ms | 8 | — |
| TC4-2 | TC=4, hooks 30 000 | 0 | 53 s | 0 | 0 | 6 292.7 ms | 8 | — |
| ADV1 | db+api ONLY, default workers | 0 | 17 s | 0 | 0 | 6 155.3 ms | 14 | — |
| W1 | default, hooks 600 000 | 0 | — | 0 | 0 | 18 675.3 ms | 14 | — |
| W2 | default, hooks 600 000 | 0 | — | 0 | 0 | 26 076.1 ms | 14 | — |

Summary: **status quo (default fan-out, hooks 30 000) is 0 green in 6 runs** (C1, D1–D3, E1, F1). **TC=2 is 4/4 green, at 42–97 s against 78–100 s uncapped and 98–120 s at TC=3, and at 8 042 MB against 15 484.** Simultaneously the greenest, the fastest and the lightest — there is no speed/safety trade to make. It also reproduces #110's independent earlier finding (`--concurrency=2` at 43–44 s against 56–59 s uncapped, same box, different session, different tree).

**The two pooled maxima this plan turns on, both stated wherever either is:**

- **uncapped** (D1–D3, E1, F1 — five runs, all red): **53 429.8 ms** = **178 %** of the 30 000 ms budget (`53429.8 / 30000 = 1.78099…`).
- **capped at TC=2** (TC2-1/2/3, M1 — four runs, all green): **11 007.8 ms** = **36.7 %** of it.

### 2.4 The wall partly causes its own failure — and the mechanism, corrected

B1/W1/W2 lifted the hooks to 600 000 at *identical* concurrency: max boots 14 316.6 / 18 675.3 / 26 076.1 ms, all three green, every boot under 30 s. With the wall at 30 000, survivors reached **37–53 s**. W1 and W2 were run mid-session rather than first-after-reboot, which rules out the alternative explanation that B1 was merely the run with the most free memory.

**The mechanism, as measured rather than as previously asserted.** A hook killed at the wall **does not stop its boot**. The boot runs to completion — D1's `event=end` lines at t+40…53 s are boots whose hooks were killed at 30 s — so the failed file's process lingers roughly 20 s past its own failure, still inside `initdb`, while vitest has already scheduled further files against it. The overlap is what compounds.

**Two things the previous revision claimed here are false, and are recorded as false rather than deleted**, because a reader of the next round needs to know they were tested:

- **No `TypeError` ever fires.** 35 timed-out suites across D1/D2/D3/E1/F1 produced **zero** `Cannot read properties of undefined (reading 'close')`. A scratch probe confirmed vitest reports *both* errors when it does happen, so the absence is real: `ctx` was assigned before `afterAll` ran, every time, and `await ctx.close()` succeeded.
- **A worker's life is one file.** The forks pool with `isolate: true` gives every test file its own PID — measured, different pid *and* different module instance per file. An abandoned PGlite instance cannot outlive its own file's process, so it cannot accumulate across a run. Per-file process isolation bounds the leak.

**The consequence for any fix, and it is the whole of D3's dismissal:** a teardown registry does not address this. Closing at `afterAll` happens *after* the boot has completed, which is exactly when the cost has already been paid. The lingering process is not reachable by anything the test file can run.

### 2.5 Boot overlap is a confound

ADV1 forced `@miolos/db` and `apps/api` to run together at default workers: **14 concurrent boots, max boot 6 155.3 ms, green in 17 s.** Fourteen concurrent boots are harmless on their own. Any fix framed as "cap the concurrent PGlite boots" targets the confound. §3 D2 turns this run into the load-bearing worst-case measurement for the cap.

### 2.6 Fixing the budget alone only relocates the failure

J1–J3 (hooks 60 000, default fan-out): the PGlite hook class disappeared — 0 hook timeouts, 26/26 boots complete — but `@miolos/web` failed in **2 of 3** runs on a different random test each time:

```
T-WEB-S119  free-play-sudoku.test.tsx   (20000ms)
T-WEB-S203  og-image.node.test.ts       ( 5000ms)
T-WEB-S28   sudoku-screen.test.tsx      ( 5000ms)
T-WEB-S48   nonogram-screen.test.tsx    ( 5000ms)
```

All `Test timed out`. These are **starvation victims of the memory exhaustion §2.2 diagnoses, not defects in the named tests**, and per ADR-0055 decision 2 a run in which anything timed out is never an anchor — so none of these figures sizes anything, here or in #109.

**A correction the previous revision got wrong, and it is the reason §9.4's comment is scoped to a file rather than to a test.** `T-WEB-S48` is **not** one of #109's three residuals. #109's third residual is *"renders one labelled rail per row and per column"* — the **`T-WEB-S43`** clue-rails `describe`, at 2 368 ms against a bare 5 000 ms default. What went red in J3 and G1 is *"the board geometry (`T-WEB-S48`) > C1"*, a **different `describe` in the same file**. #109 never mentions `T-WEB-S48` at all. #109's sentences *"It has never been seen red"* and *"None of the three has ever gone red"* both still stand for the tests #109 is actually about.

---

## 3. Decisions register

### D1 — The cap is **2**, expressed as `TURBO_CONCURRENCY=2` inline on the root `test` script

```diff
- "test": "turbo run test",
+ "test": "TURBO_CONCURRENCY=2 turbo run test",
```

**The value.** 2 is the greenest (4/4), the fastest (42–97 s) and the lightest (8 042 MB, 52 % of RAM, 7.5 GB of headroom). 3 costs 22 % more memory and is measurably *slower*. 4 was green 2/2 and fast, but **has no RSS sample at all** and the model puts it at ~12.6 GB demanded against a 15.5 GB box — inside the region where E1 measured `MemAvailable` collapsing. Shipping the setting with no memory evidence, into a ticket whose entire diagnosis is a memory model, would be shipping the one number the model says is marginal. 1 is slower than 2 by #110's measurement (67 s against 43–44 s) and buys nothing.

**The shape**, all of it measured in #110 and re-verified on this tree at turbo 2.10.8:
- `turbo.json`'s `concurrency` key is **global**, breaks `pnpm dev` below 3, and would silently cap `pnpm typecheck`. Rejected.
- A `--concurrency=2` baked into the script is **not overridable**: the flag beats the env var, and a second `--concurrency` is a hard error — re-verified here: `pnpm exec turbo run typecheck --dry-run --concurrency=2 --concurrency=10` → `ERROR the argument '--concurrency <CONCURRENCY>' cannot be used multiple times`. Rejected.
- An **inline** env assignment on the script is overridable, because a caller's CLI flag wins over it. Verified on this tree: `pnpm typecheck --dry-run` prints `$ turbo run typecheck --dry-run`, so pnpm forwards trailing flags verbatim; and `TURBO_CONCURRENCY=2 pnpm exec turbo run typecheck --dry-run --concurrency=10` is accepted. **Chosen.**
- `"test": "TURBO_CONCURRENCY=${TURBO_CONCURRENCY:-2} turbo run test"` is **rejected**, and not only as unmeasured cleverness: an ambient-honouring form means the `TURBO_CONCURRENCY=1` that every agent session in this repo has been exporting for months would keep binding, silently and invisibly. The inline assignment kills that dead, which is a feature.

**Blast radius.** The assignment is on the `test` script only. `pnpm dev`, `pnpm typecheck` and `pnpm build` are untouched — which is precisely the objection that killed the `turbo.json` placement.

**A portability note, stated so nobody rediscovers it.** `VAR=value cmd` inside an npm script is POSIX-shell syntax. It works on Linux and macOS and would break under `cmd.exe`. This repo is developed on WSL2 and its CI runs `ubuntu-latest`, so the form is safe today; a Windows contributor would need `cross-env`, and that is the trigger to revisit, not a reason to add a dependency now.

**The residual, stated in the decision.** The cap bounds **packages**, not workers, and `maxWorkers` is `cpus − 1`. On a 16-core box the same cap demands `2 × 15 × 450 MB ≈ 13.5 GB`. **This cap is a fix for this box's cores-to-RAM ratio, and a machine with more cores per GB re-opens #114.** That sentence goes into ADR-0057 inside decision 2, not into a standalone risks list.

### D2 — The cap is sufficient **by measurement of its own worst case**, not by luck, and nothing else ships

The honest reading of the TC=2 runs is uncomfortable: TC2-1/2/3 peaked at **7** concurrent boots, not 14 — meaning `@miolos/db` and `apps/api` **never drew each other** in those runs. TC=2's worst permitted pairing was not observed in the sweep. Without more, D1 would be green-by-luck.

**ADV1 is that pairing, measured directly.** It ran `@miolos/db` and `apps/api` together, at default workers, with nothing else on the box — exactly what TC=2 permits as its ceiling: 14 concurrent boots, max boot **6 155.3 ms**, green in **17 s**. The M1 sample independently shows a full TC=2 run reaching **16 processes** (two seven-worker packages plus two mains) at 8 042 MB. So the worst *permitted pairing* is measured and the worst *observed peak* is measured, and they agree. Both are direct whole-run samples, which is what D2 rests on — not on the `~450 MB` constant, whose limit §2.2 states.

**Therefore nothing additional ships.** Specifically:

- **A boot semaphore inside `createTestDb` is a no-op and would be shipped theatre.** Every vitest worker is its own process; a module-level semaphore can only serialise within one process, and within one process the boots are *already* serial — the forks pool with `isolate: true` runs one file at a time per worker, one top-level `beforeAll` per file. It would bound nothing across the 14 processes that matter. Combined with §2.5's finding that 14 concurrent boots are harmless anyway, this is a fix aimed at a confound that could not fire even if the confound were the cause.
- **`--maxWorkers` per package** was measured red (G1) and does nothing on CI.
- **A `poolOptions.maxForks` in a new `packages/db/vitest.config.ts`** would tighten the bound to a constant independent of core count — the one thing D1's residual would like. It is **not** shipped because it puts an unexplained number in a new config file to solve a problem that has not occurred on any box this repo has ever run on, and because ADR-0017 says a vitest config exists only where defaults don't suffice. It is named inside ADR-0057's decision 2 as **the shape the next ticket takes if the box changes**, so the next agent does not re-derive it.

### D3 — **DROPPED.** `createTestDb` keeps its `close`; no registry, no `closeTestDbs()`, no `afterAll` edit

This decision is recorded as abandoned rather than deleted, because a reader of the next round needs to know it was proposed, tested and rejected on evidence.

**What it proposed.** A module-scope registry in `packages/db/src/testing.ts` populated synchronously at `new PGlite()`, a `closeTestDbs()` export as the only teardown path, `close` removed from `createTestDb`'s return, and 26 `afterAll` bodies rewritten. It claimed to fix two defects: **(A)** an abandoned boot's client is unreachable and uncloseable, compounding pressure across workers; **(B)** a timed-out hook also throws `Cannot read properties of undefined (reading 'close')`, masking the real error.

**Why it is dropped.** Step 3 ran the checks the decision asserted:

1. **(B) never fires.** Zero `Cannot read properties of undefined (reading 'close')` across 35 timed-out suites in five runs, with a probe confirming vitest reports both errors when it does happen (§2.4).
2. **(A) cannot compound.** `isolate: true` means one process per file; an abandoned instance dies with its file (§2.4).
3. **The registry would not touch the real mechanism.** A killed hook's boot completes anyway; `afterAll` runs after that completion, i.e. after the cost is paid (§2.4).
4. **It would have been a net regression.** `close()` blocks on `waitReady`, so in the uncapped worlds D4 preserves a hook killed at 30 s could hand `closeTestDbs()` more than 10 s of remaining boot — and no `afterAll` in the repo carries an explicit budget (§0.1 item 2). It would have replaced a TypeError that never fires with a real second `Hook timed out in 10000ms`. Measured on a scratch `afterAll`.
5. **No issue asked for it.** #114's acceptance is about the cause, the ten runs, the arithmetic comment, decision 1's clause and napkin item 8. None of them is a teardown API.

**What survives, and it is real.** The abandoned-boot behaviour is worth knowing and is recorded as a **documented finding inside ADR-0057**, in the terms §2.4 states: *a killed hook does not stop its boot; the process lingers roughly 20 s past its own failure, still in `initdb`, overlapping files vitest has already scheduled.* It is recorded explicitly **not** as a cascade mechanism and **not** as something a teardown can fix — the ADR must not repeat the claim this plan just withdrew.

**What dropping D3 dissolves**, listed so the deletions are traceable rather than silent:

- The `T-DB-S5` widening (38 → 39 names). No export is added, so the export tripwire is untouched. `packages/db/test/published.test.ts` still receives its D6 pointer and nothing else.
- The two teardown tests (`T-DB-S59`/`S60`) and the file that would have held them.
- The 26-file `afterAll` + import edit. The 26 files are still edited, for the D6 comment only.
- The two step-3 blockers that were conditional on D3 shipping — the missing `afterAll` budget, and the `live.clear()`-before-await ordering that double-close and concurrent-close hazards require. Both are moot.
- PGlite 0.5.4's `close()` on a booting instance, the previous revision's "single largest unknown". Step 3 **resolved** it — it settles cleanly, `afterAll` does run after a hook timeout, no unhandled rejection escapes, process exit is clean. The mechanism worked; the rationale did not. Recorded in §12 so the answer is not lost with the decision.
- The unmeasured teardown population (26 `afterAll`, 75 `beforeEach`, 62 `afterEach` repo-wide, **none** carrying an explicit budget) stops being something this ticket makes more expensive. It is still unmeasured, and it becomes an ADR-0057 residual in the same words D3 used for the boot.

  ```
  for k in beforeAll afterAll beforeEach afterEach; do
    grep -rhoE "^[[:space:]]*$k\(" apps packages --include="*.test.ts" --include="*.test.tsx" | wc -l
  done   # → 26 26 75 62
  ```

  All 26 `beforeAll` in the repo are PGlite boots, and all 26 `afterAll` are their teardowns — the two hook classes are coextensive with the 26-file set.

### D4 — The cap does **not** bind on CI; CI stays the repo's one uncapped runner, **and it now measures the hook**

```diff
       - run: pnpm typecheck
       - run: pnpm lint
-      - run: pnpm test
+      # Runner shape, printed so the reasoning below is checkable rather than
+      # asserted (ADR-0057 decision 3).
+      - run: nproc; free -m
+      # The root `test` script caps turbo at 2 (ADR-0057). That cap is a fix
+      # for a 15.5 GB / 8-core developer box, where vitest spawns 7 workers per
+      # package and six packages at once demand ~19 GB. This runner has neither
+      # problem: vitest's own maxWorkers collapses to 1 on 2 vCPUs, so six
+      # packages demand ~2.7 GB and there is no oversubscription to relieve.
+      # Capping would also cost ~+55 % (run 31888933252: 1021.2 s of
+      # per-package work inside a 330 s step; a two-lane makespan floor is
+      # max(1021.2/2, 325.6) ~= 510 s). Passing the flag explicitly keeps CI
+      # the ONE runner that still executes the suite at the fan-out the
+      # timeouts are sized against — and `--concurrency=10` is turbo's own
+      # default, so this step runs exactly what a bare `pnpm test` ran before
+      # the cap. MIOLOS_TEST_DB_TIMING makes the PGlite boot report its own
+      # cost, which is what gives that population its first eligible anchor
+      # (ADR-0055 decision 2 is CI-first) and discharges decision 4's
+      # cost-driver re-read for every PR that touches `createTestDb`.
+      - run: pnpm test --concurrency=10
+        env:
+          MIOLOS_TEST_DB_TIMING: "1"
       - run: pnpm build
```

**This is the decision the ticket turns on after D1, and it answers #110's three objections at once:**

1. *"The CI arithmetic predicts a regression, not a win."* Correct, and this plan does not fight it — it declines to bind the cap there.
2. *"A cap has to be measured on CI before it is shipped, and that measurement is hard to get honestly."* A cap that does not bind on CI owes no CI measurement. The claim made in the PR body is not a performance claim at all, it is a **structural** one, and §9.3 names the artifacts that actually exist to prove it. **This is a deliberate re-aiming of #110's first acceptance criterion**, stated as such, not quietly dropped.
3. *"A cap removes the only place full fan-out is still exercised."* It does not, here. CI keeps running the suite at fan-out 10.

**The memory argument, which the whole ticket rests on and the previous revision omitted from this decision.** The diagnosis is memory, so a CPU-only defence of an uncapped gate is incomplete. Two halves close it:

- **`--concurrency=10` is behaviourally identical to today's bare `pnpm test`** — 10 *is* turbo's default. This step therefore **pins the configuration CI already runs**; it introduces nothing. The gate has been green throughout, on that exact configuration.
- **The arithmetic is available.** `gh repo view --json visibility` → `PRIVATE`, so `ubuntu-latest` is the standard 2-vCPU class: `6 packages × max(2−1, 1) = 1 worker × ~450 MB ≈ 2.7 GB`, comfortably clear of the runner's RAM. `nproc; free -m` in the step above turns that from arithmetic into a printed figure on every run.

**Two named residuals, both going into ADR-0057 beside the local core-count one:**

- **A CI runner upgrade — a larger-runner label, or the repo going public and landing on a bigger free class — multiplies `cpus − 1` and re-opens #114 on the uncapped gate.** The `nproc; free -m` line is the tripwire.
- **CI's contended hook cost has never been measured.** This decision is what fixes that: with the instrument on, the gate log carries `MIOLOS_DB_TIMING` lines and the pooled maximum is readable with a grep. §9.5 pre-commits how the first figure is read, **before** the draw.

**The cost, stated:** pre-commit and CI stop running byte-identical commands, and every gate log grows by ~52 stderr lines. The divergence is real and is why it lives in an ADR decision, a `ci.yml` comment and a fail-closed test rather than in a commit message. **What does not diverge is the enforced gate**: the `gate` status context required by the `protect-main` ruleset still runs `pnpm test`, full suite, six packages, at fan-out 10. Only the advisory pre-commit hook is capped, and ADR-0057 names the ruleset when it says so.

### D5 — The hook budget stays **30 000 ms**, and the warrant is rebuilt

**The conclusion is unchanged; the previous revision's reasoning for it was wrong and is replaced.**

The two pooled maxima again, because both belong wherever either does: **uncapped 53 429.8 ms = 178 % of budget** (five runs, all red); **capped at TC=2, 11 007.8 ms = 36.7 %** (four runs, all green).

**Why the budget is not re-derived — four reasons, none of which is a quotation of decision 4:**

1. **This population has no eligible anchor at all.** ADR-0055 decision 2 sizes from the highest measured figure, CI first and worst contended local second; an isolated run is never eligible, and **a run in which anything timed out is never eligible either**. Every uncapped local run had timeouts. So 53 429.8 ms cannot size anything. And 11 007.8 ms is a **capped** figure, which by R2b's own rewritten definition of "contended" is not an anchor either — it is used here only to show the shipped ceiling is not breached under the shipped local configuration, which is a different question. **D4 is what fixes this**: the CI gate now measures the hook, uncapped and green, which is exactly the CI-first anchor decision 2 asks for.
2. **No green-run measurement has put a boot near 30 000 ms.** B1/W1/W2 (uncapped, hooks lifted) topped out at 26 076.1 ms with every boot under 30 s; every capped run is far below. There is no measured case for raising it.
3. **Raising 26 hooks buys nothing measured and costs 15 s of hang detection** on the largest hook population in the repo. `CLAUDE.md`'s mechanical gate says no PR may remove or weaken a gate it does not need to weaken.
4. **Lowering it is equally unwarranted.** Decision 4 is explicit that a shipped timeout is a ceiling rather than a target; a ceiling that no green run approaches is not a defect.

**What is NOT claimed, and the previous revision claimed it.** ADR-0055 decision 4's sentence is *"**A test over `budget / 2`** is a defect to investigate and record, never a number to raise, and never an automatic re-derivation either"*. Every clause after that antecedent is governed by it. Our figures are not over `budget / 2` under the shipped local configuration, so the sentence does not engage, and generalising it into a blanket prohibition on re-derivation was a misreading. It is deleted from this decision **and from the canonical comment**, which would otherwise have committed the misreading to source.

**Also deleted: the 40 %-trigger argument as previously stated.** Decision 1's trigger reads *"contended local or measured CI"*, and under R2b's rewritten definition of "contended" the applicable local figure is the **uncapped** 53 429.8 ms = 178 %, not 36.7 %. The trigger fires hard. What the trigger *demands* is that the hook carry an explicit in-file timeout with its arithmetic in a comment — which it already does, and which D6 is the discharge of. It does not demand a bigger number.

**The tripwire, and the configuration it is read under** — written into the comment so the next session does not re-argue it. Read the pooled maximum from a **green** run: capped locally, or a CI gate log (uncapped, instrument on, D4). Over **12 000 ms** (40 % of 30 000, decision 1) the explicit timeout is confirmed as required. Over **15 000 ms** (`budget / 2`, decision 4) it is a defect to diagnose and record — and only then, if it is drift rather than a draw, the cause to move the number with fresh figures in the PR body. Cost drivers for that re-read: `createTestDb`, `../migrations/**`, the `@electric-sql/pglite` version, and **the concurrency setting on the root `test` script**.

**And the sentence that must not be softened anywhere:** **the class is avoided by the cap, not closed.** At default fan-out it still fires. CI, a developer typing `turbo run test`, and any future revert of the cap all run the configuration where it fires.

### D6 — The arithmetic lives **once**, at the cost driver, and 26 sites point at it by symbol

ADR-0055 decision 1 requires "the arithmetic and both measured figures in a comment beside it". Taken literally that is a long block copied 26 times — 26 places to rot.

**The warrant, argued from evidence rather than from analogy.** The previous revision derived this from decision 3, which does not support it: decision 3's subject is where *the number* lives and its warrant is per-test ordering instability, whereas this moves *the comment* and leaves the number at all 26 sites. The real warrant is §4's census plus handoff 048 §4's rot finding. **26 sites already carry 9 byte-distinct texts across 4 attribution families, and 3 of them are wrong about the cost they describe.** That is not a hypothetical rot rate; it is a measured one, on a comment that has been copied for four tickets. The cost driver here is literally one function in one file, which is the condition decision 4 already names — *"the cost driver is whatever the timeout is actually budgeting, which is frequently not the test file"*.

So: **the full block goes beside `createTestDb` in `packages/db/src/testing.ts`**, and each of the 26 `beforeAll`s carries a four-line pointer citing it **by symbol**. 18 of the 26 pointers cross a package boundary (`apps/api` imports `@miolos/db/testing`; the other 8 are `packages/db`'s own `../src/testing`), so the pointer names the module by its **published subpath**, which is correct read from either side. This is written into ADR-0055 as an amendment (§8 R2c) rather than assumed.

**The canonical block** — exact text, immediately above `export async function createTestDb`:

```ts
/**
 * THE HOOK BUDGET FOR EVERY CALLER: 30_000 ms. The arithmetic and the measured
 * figures live here, at the cost driver, rather than at the 26 call sites
 * (ADR-0055 decision 1 as amended by #114 — one cost driver, one comment).
 *
 * WHAT THE BUDGET BUYS, measured with MIOLOS_TEST_DB_TIMING=1. PGlite's WASM
 * `initdb` is ~97 % of the boot; the six-migration replay is 17.9-28.4 ms,
 * under 3 %. Isolated, one process, five serial boots: 1135.1 ms cold, then
 * 797.9 / 718.2 / 714.6 / 703.4 ms.
 *
 * THE NUMBER THAT MATTERS, and it is not the comfortable one. UNCAPPED — six
 * package suites at turbo's default fan-out, which is what CI runs and what a
 * bare `turbo run test` runs — the pooled maximum over five runs is
 * 53 429.8 ms, which is 178 % of this budget. All five of those runs were red.
 * Under the `TURBO_CONCURRENCY=2` cap the root `test` script now ships
 * (ADR-0057), the pooled maximum over four green runs is 11 007.8 ms.
 *
 * SO: THE CLASS IS AVOIDED BY THE CAP, NOT CLOSED. 30_000 is not a ceiling
 * that fits the boot's worst measured cost; it is one that fits the boot under
 * a configuration this repo now chooses locally. The cause is memory
 * exhaustion rather than this hook (ADR-0057), which is why raising the number
 * relocates the failure instead of removing it: at 60_000 and default fan-out,
 * 0 hook timeouts and 26/26 boots complete, and 2 of 3 runs still went red on
 * a different `apps/web` test each time.
 *
 * WHY 30_000 IS NOT RE-DERIVED. This population has no eligible anchor.
 * ADR-0055 decision 2 sizes from the highest measured figure, CI first, worst
 * contended local second; an isolated run is never eligible and a run in which
 * anything timed out is never eligible either, which rules out every uncapped
 * figure above. 11 007.8 ms is a CAPPED pooled maximum, so it is not an anchor
 * either — it shows only that the shipped ceiling is not breached under the
 * shipped local configuration. No green run has ever put a boot near 30_000.
 * Raising it would cost 15 s of hang detection on the largest hook population
 * in the repo to buy nothing any measurement asked for.
 *
 * THE TRIPWIRE, AND THE CONFIGURATION IT IS READ UNDER. Take the pooled
 * maximum from a GREEN run: capped locally, or a CI gate log, which runs
 * uncapped with this instrument on (ADR-0057). Over 12 000 ms — 40 % of this
 * budget, ADR-0055 decision 1 — the explicit timeout this hook carries is
 * confirmed as required. Over 15 000 ms — `budget / 2`, decision 4 — it is a
 * defect to diagnose and record, and only then, if it is drift rather than a
 * draw, the cause to move the number with fresh figures in the pull-request
 * body. Cost drivers for that re-read: this function, `../migrations/**`, the
 * `@electric-sql/pglite` version, and the concurrency setting on the root
 * `test` script.
 *
 * WHAT THE 21 COMMENTS THIS REPLACES GOT WRONG. Three attributed the cost to
 * the migration replay — `published.test.ts` and `remote-config.test.ts` as
 * "PGlite boot + real-migration replay", `session.test.ts` as "WASM Postgres
 * boot + migration replay ~1s" — over-weighting a component that costs under
 * 3 %. The other eighteen said "PGlite boot measures ~1.2 s locally" and named
 * no component at all. The ~1.2 s is right for a cold boot; 17 of the 21 then
 * multiplied it by four and added an unnamed "+ margin", an arithmetic that
 * cannot be checked because the margin carries all the weight between 4.8 s
 * and 30 s. And none of the 21 carried a contended figure, because until this
 * instrument shipped there was none to carry.
 */
```

**The rule for the 26 call sites**, byte-identical everywhere (exemplar, `packages/db/test/user.test.ts`):

```ts
// Hook budget 30_000 ms. The arithmetic, both measured figures, the uncapped
// worst case and the re-derivation tripwire live once, beside `createTestDb`
// in `@miolos/db/testing` (ADR-0055 decision 1 as amended by #114; ADR-0057).
// Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);
```

**What is deleted, and where.** Every `~1.2 s`, `3–4×`, `1.2 s × 4 + margin`, `plan 017 §15` / `plan 018 §15` boot sentence, `PGlite boot + real-migration replay` and `migration replay ~1s` clause goes, from all 21 files that carry one — **`apps/api/test/session.test.ts` included**, which the previous revision named as an *"other subject"* to leave alone and which carries the third spelling no `real-migration replay` sweep finds. The 5 files with no adjacent comment gain the pointer, which is a strict improvement.

**Three exceptions, each hand-edited rather than mechanical** (§4 has the full mapping):

- **`apps/api/test/cron-publish.test.ts`** carries a single 23-line block whose first three lines are the boot sentence and whose remaining twenty are per-`it` 30 000 ms arithmetic for the four-game top-up. **That arithmetic justifies a different timeout this ticket does not touch and must survive verbatim.** Only the first three lines are replaced. Verifying this file by grep rather than by reading would either delete load-bearing arithmetic or leave the boot sentence in.
- **`apps/api/test/session.test.ts`** carries the boot sentence *after* a four-line note about one-PGlite-per-file and the `~12 s` saving. That note is a different subject and stays; the boot sentence following it goes.
- **`apps/api/test/daily-nonogram.test.ts`, `daily-termo.test.ts` and `termo-guess.test.ts`** each carry *"the boot hook keeps its own, which is what it is for"* in a **file-header** block, well above `beforeAll`. Those sentences are about this very budget, are correct, and stay — but the pointer must be inserted beside `beforeAll` in a way that reads with them rather than contradicting them. Three files, not the two step 3 named; re-derived with `grep -rn "what it is for" apps packages --include="*.ts"`.

### D7 — `MIOLOS_TEST_DB_TIMING` is declared in `turbo.json`'s `test` task

```diff
-    "test": { "dependsOn": ["^build"] },
+    "test": {
+      "dependsOn": ["^build"],
+      "env": ["MIOLOS_TEST_DB_TIMING"]
+    },
```

Without it, turbo's strict env filtering drops the variable and the instrument is silently inert — the trap that cost this session's diagnostic round its first attempt and forced `--env-mode=loose` on every run. **This is no longer the plan's most droppable decision: D4 sets the variable on the CI gate step, so without this declaration D4's measurement produces nothing at all and BL13's discharge fails silently.** Declaring it also correctly puts the flag in the task hash, so toggling it invalidates the cache; on CI the value is a constant `"1"`, so gate-to-gate caching is unaffected. One-time cache miss on merge.

---

## 4. The comment census, derived

This is the section §0.1 refers to. It is derived, not recalled — the script below extracts the **contiguous comment block immediately preceding `beforeAll(async () =>`** in each of the 26 files and groups by SHA-1 of its exact bytes:

```python
files = <the 26 from `grep -rl 'await createTestDb'`>
for f in files:
    lines = open(f).read().split("\n")
    i = index of the line starting "beforeAll(async ()"
    walk back over contiguous lines whose lstrip starts with "//", "*" or "/*"
    group by sha1 of the joined block
```

**Result: 26 files, 9 byte-distinct comment texts, plus 5 files with no adjacent block at all.**

| # | n | families | files |
|---|---|---|---|
| 1 | 12 | *"PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower; 1.2 s × 4 + margin puts the ceiling well above vitest's 10 s default, which would otherwise flake this file on CI alone (plan 017 §15)."* | `apps/api/test/`: `attach`, `completions`, `medals`, `merge-resolution`, `stats-calendar`, `stats`, `streak` · `packages/db/test/`: `attach-schema`, `medals`, `merge`, `stats`, `user` |
| 2 | 5 | **no adjacent block** | `apps/api/test/`: `buffer-depth`, `daily-nonogram`, `daily-sudoku`, `daily-termo`, `termo-guess` |
| 3 | 2 | *"…~3–4× slower (plan 017 §15's timeout arithmetic)."* — no `× 4`, no margin | `apps/api/test/`: `account-delete`, `attach-state` |
| 4 | 1 | family 1 with *"worker contention adds to both"* and the #31/napkin-item-3 tail | `apps/api/test/daily-binairo` |
| 5 | 1 | same shape as 4, worded for `packages/db` (*"the other seven PGlite files in this package"*) | `packages/db/test/buffer` |
| 6 | 1 | family 1 in ASCII (`3-4x`, `x 4`), citing **plan 018 §15**, no "10 s" | `apps/api/test/publishing-service` |
| 7 | 1 | family 1 in ASCII citing plan 018 §15 — **first 3 lines only**, followed by 20 lines of per-`it` top-up arithmetic that must survive | `apps/api/test/cron-publish` |
| 8 | 1 | *"One PGlite (**WASM Postgres boot + migration replay ~1s**) per FILE…"* + family 4's text | `apps/api/test/session` |
| 9 | 1 | *"**PGlite boot + real-migration replay**: ~1.2s locally, CI runners 3-4x slower — over vitest's 10s hook default on a starved runner (it fired on a docs-only PR). Same 30s the sibling suites carry."* | `packages/db/test/published` |
| 10 | 1 | *"**PGlite boot + real-migration replay**: ~1.2s locally, CI runners 3-4x slower — the same 30s hook timeout the sibling suites carry."* | `packages/db/test/remote-config` |

**The four attribution families, and the counts the canonical comment states:**

```
echo "$F" | xargs grep -lE '~1\.2 ?s' | wc -l                          # 21  carry a boot-cost sentence
echo "$F" | xargs grep -l 'PGlite boot + real-migration replay'        #  2  over-weight the replay
echo "$F" | xargs grep -l 'migration replay ~1s'                       #  1  ditto, third spelling
echo "$F" | xargs grep -l 'PGlite boot measures ~1\.2 s locally' | wc  # 19  name no component
echo "$F" | xargs grep -lE '\+ margin' | wc -l                         # 17  carry the x4 + margin
```

19 + 2 = 21, and `session.test.ts` is inside the 19 while *also* carrying the third spelling — which is why the canonical comment says "three attributed the cost to the migration replay" and "the other eighteen named no component". **The over-weighting the brief asked to fix is in 3 of 26 files, not 7 and not 21.** The class that actually needs replacing is all 21.

**A count correction to the step-3 findings themselves, since this plan's own standard applies to its inputs.** The findings document states "8 byte-distinct texts"; the derivation above yields **9** non-empty texts plus the empty class. It states that two files carry a distant *"keeps its own"* remark; **three** do (`daily-nonogram`, `daily-termo`, `termo-guess`). It states 63 `afterEach` repo-wide; the count is **62**. None changes a decision; all three are recorded because a document that corrects its neighbours owes the same treatment to the document correcting it.

**What none of the 21 has.** A contended figure. Every one of them extrapolates from an isolated `~1.2 s` — which is precisely the sizing error ADR-0055's Context describes and decision 2 forbids, shipped 21 times before the ADR existed. The instrument is what makes the replacement possible.

---

## 5. Exact file list

### Modified — source and config (3)

| File | Change |
|---|---|
| `package.json` (root) | `test` script gains `TURBO_CONCURRENCY=2` (D1) |
| `turbo.json` | `test` task gains `env: ["MIOLOS_TEST_DB_TIMING"]` (D7) |
| `.github/workflows/ci.yml` | gate gains `nproc; free -m`; test step becomes `pnpm test --concurrency=10` with `MIOLOS_TEST_DB_TIMING: "1"` + comment (D4) |
| `packages/db/src/testing.ts` | instrument (already in tree) + the canonical comment block (D6). **`createTestDb`'s signature and return are unchanged** (D3 dropped). |

### Modified — test files (26)

`apps/api/test/`: `account-delete`, `attach-state`, `attach`, `buffer-depth`, `completions`, `cron-publish`, `daily-binairo`, `daily-nonogram`, `daily-sudoku`, `daily-termo`, `medals`, `merge-resolution`, `publishing-service`, `session`, `stats-calendar`, `stats`, `streak`, `termo-guess` (18)
`packages/db/test/`: `attach-schema`, `buffer`, `medals`, `merge`, `published`, `remote-config`, `stats`, `user` (8)

**Comment only.** No `afterAll` body changes, no import changes, no assertion changes. **21 mechanical** (delete the boot sentence, insert the pointer) and **5 hand edits** — `cron-publish`, `session`, `daily-nonogram`, `daily-termo`, `termo-guess`, for the reasons in D6.

### Created — tests (1)

- `apps/web/test/fanout-cap.test.ts` — `T-WEB-S225`, `T-WEB-S226`, `T-WEB-S227`

### Created — docs (2)

- `docs/adr/0057-<slug>.md`
- `docs/plans/049-issue-114-plan-the-fan-out-cap-and-the-pglite-hook.md` (this file)

### Modified — records (5)

`docs/adr/0055-…md`, `docs/adr/0017-…md`, `docs/README.md`, `docs/agents/test-ids.md`, `.claude/napkin.md`

### Explicitly NOT touched

`packages/games/**` (ADR-0023) · `apps/web/src/**` and every existing `apps/web` test (§9.4) · `.husky/pre-commit` (it runs `pnpm test`, which is the point) · `packages/db/test/published.test.ts`'s `T-DB-S5` (no export is added) · `CLAUDE.md` · `CONTEXT.md` · `docs/handoffs/**` and other `docs/plans/**` (snapshot classes) · any `numRuns` · any `testTimeout` · any `afterAll`.

---

## 6. Why #110's fence is reversed, and what changed

Plan 042 §5 recorded three reasons #107 declined the cap, and #110 carries them forward. Two are dissolved by D4 and one is superseded by measurement. The fourth row is this ticket's own, not #107's.

| reason (plan 042 §5, restated in #110) | status now |
|---|---|
| "The CI arithmetic predicts a regression" | **Stands, and is honoured.** D4 does not bind the cap on CI. |
| "A cap must be measured on CI, and honestly, first" | **Dissolved.** A cap that does not bind on CI owes no CI measurement. #110's AC1 is re-aimed in §9.3, in the open. |
| "A cap removes the only place full fan-out is exercised" | **Dissolved.** D4 keeps CI at fan-out 10 explicitly, and now instrumented. |
| *(new here — not one of the three)* | **The status quo is 1 green in 16 runs** — 0/6 this session on the branch, 1/10 in handoff 048's Block C on `main` at `aa2fac2`. #107 could argue the uncapped gate was an honest signal; sixteen runs later it is a coin flip that lands heads once. |

---

## 7. Verification seams

With D3 dropped there is no TDD seam on runtime behaviour — this ticket ships three config edits, a comment, and three config-scan tests. What remains is mechanical verification, and it is done by command rather than by reading:

1. **The scans are pure reads and are written red first**, against the un-edited tree, before D1/D4/D7 land. That is the cheapest possible proof they can fail, and it is the whole of their value as tripwires.
2. **The 26-file comment edit is verified by grep, both directions.** Note the flag: `grep -rc` emits per-file counts, not a total, so the count form is `grep -rl … | wc -l`.

   ```
   F=$(grep -rl 'await createTestDb' apps packages --include='*.test.ts')
   echo "$F" | xargs grep -lE '~1\.2 ?s|3[–-]4[×x]|\+ margin|real-migration replay|migration replay ~1s' | wc -l   # must be 0
   echo "$F" | xargs grep -l 'The arithmetic, both measured figures' | wc -l                                        # must be 26
   echo "$F" | xargs grep -A4 '^afterAll(' | grep -c 'await ctx.close();'                                           # must still be 26
   ```

   The third is the D3-dropped assertion: this ticket must leave every teardown exactly as it found it.
3. **The five hand-edited files are verified by reading, named individually** (D6). `cron-publish.test.ts`'s twenty lines of per-`it` arithmetic must be byte-identical before and after — `git diff` on that file shows a three-line replacement and nothing else.
4. **`createTestDb`'s signature is unchanged.** `git diff packages/db/src/testing.ts` against `main` shows the instrument and the comment block, and no change to the `export async function createTestDb` line or to its `return`.

---

## 8. Records

Every row below is a record whose statement this ticket makes **false**, or a record it owes. The napkin's falsified-record standard (Execution item 5) requires all of them in the same round.

### R1 — ADR-0057 (new). *The test suite's memory model, and a cap that binds locally and not on CI.*

**House style, matching 0055 and 0056:** `## Context`, `## Decision`, `## Rejected`, `## Consequences`, with residuals stated **inside** the decisions they belong to rather than in a standalone list.

**Qualitative only.** ADR-0055's Consequences say *"The measurements do not live here … an ADR carrying a measurements appendix is the fastest-rotting document in the repo … what this ADR keeps is the qualitative finding it rests on."* That binds 0057 as much as 0055. So the RSS samples, the sweep table and the +55 % arithmetic live in **plan 049 §2 and the PR body**, cited by path; the ADR keeps the findings.

Five decisions:

1. **The failure is memory exhaustion, not CPU oversubscription.** The qualitative finding: six package suites at `cpus − 1` workers each demand more RAM than the box has, and swap thrash — not scheduling — is what turns a one-second boot into a fifty-second one. The model's shape (`packages × workers × per-worker`) is stated; the constant is not, because it moves with vitest, PGlite and Node, and because a PGlite-bearing worker is heavier than the fleet average. Figures: plan 049 §2.2.
2. **`pnpm test` caps turbo at 2, inline and overridable.** With the placement constraints qualitatively, and the residual **inside the decision**: the cap bounds packages rather than workers, so a box with more cores per GB re-opens #114, and `packages/db/vitest.config.ts` with `poolOptions.maxForks` is the shape the next ticket takes if it does.
3. **The cap does not bind on CI, and CI stays the one uncapped runner.** The `maxWorkers = 1` reason, the deliberate divergence — **advisory pre-commit only; the enforced `gate` context required by the `protect-main` ruleset still runs the suite at fan-out 10** — and two residuals inside the decision: a runner upgrade or the repo going public re-opens #114 on the gate, and CI's contended hook cost is measured for the first time by this ADR's own decision 5.
4. **The boot instrument ships**, gated on `MIOLOS_TEST_DB_TIMING=1`, reading the caller off the stack rather than importing `vitest`, declared in `turbo.json` and **enabled on the CI gate**. It is what discharges ADR-0055 decision 1's "unswept" clause for this population and what gives it a CI-first anchor.
5. **The hook budget stays 30 000 ms, and the class is avoided by the cap rather than closed.** Stated in those words, because a reader who takes "fixed" away from this ADR will size the next budget wrong.

**A documented finding, recorded as a finding and not as a mechanism.** A killed hook does not stop its boot: the process lingers roughly 20 s past its own failure, still in `initdb`, overlapping files vitest has already scheduled. **This is not a cascade mechanism and no teardown can fix it** — closing at `afterAll` happens after the boot has completed. Recorded because it is real and worth knowing, and recorded with its own limits because an earlier draft of this ticket got it wrong in the other direction. Its sibling fact belongs beside it: `isolate: true` gives every test file its own process, so an abandoned instance dies with its file, and any future move to `isolate: false` invalidates both this finding and D2's semaphore dismissal.

Rejected, with reasons: a teardown registry / `closeTestDbs()` (fixes no measured failure, and `close()` blocking on `waitReady` would have added a second timeout); the boot semaphore (a per-process no-op); `--maxWorkers` (measured red); `turbo.json`'s global key; a percentage cap; TC=3 and TC=4; raising the budget to 45 000 or 60 000 (measured: the class relocates, it does not close).

Unmeasured, named as a residual inside decision 5: the teardown hook population — 26 `afterAll`, 75 `beforeEach`, 62 `afterEach` repo-wide, none carrying an explicit budget, all riding vitest's bare 10 000 ms, and the instrument reports nothing at close.

### R2 — ADR-0055: amendments, plus a reciprocal `**Amended by:** ADR-0057` header

**Six lettered edits, reported as a mapping and never as a bare count** (handoff 048 §4 — the previous revision said "three amendments" and listed four, in a ticket whose thesis is that counts rot faster than mappings):

| letter | what it touches |
|---|---|
| a | decision 1's "unswept" clause, narrowed — plus its `~20 apps/api` population figure |
| b | decision 2's "contended" procedure, rewritten |
| c | decision 1 gains the one-cost-driver clause |
| d | the "root fan-out is deliberately left uncapped" consequence, falsified |
| e | the PGlite carve-out consequence, falsified on both clauses |
| f | decision 4's instantiated cost-driver list gains one entry |

Five of the six are amendments to a statement made false or incomplete; **f** is an addition to a list rather than a correction, and is lettered anyway so that nothing rides in someone else's paragraph.

a. **Decision 1's "unswept" clause is discharged, and narrowed rather than deleted.** The `hookTimeout` axis is now swept **for the PGlite population** — 26 files, one cost driver, instrumented, measured locally over nine runs and on CI from this PR onward. It remains unswept for every *other* hook in the repo, and the reason it was unswept — vitest prints no hook durations — is unchanged; what changed is that this repo now has an instrument for the one hook that mattered. Deleting the clause outright would overclaim. **The same amendment corrects decision 1's population figure**: it says *"the ~20 `apps/api` `beforeAll(…, 30_000)` PGlite boots"*; it is **18 in `apps/api`, 8 in `packages/db`, 26 in total**, and all 26 `beforeAll` in the repo are PGlite boots.

b. **Decision 2's "contended" procedure is rewritten**, which ADR-0055's own Consequences already say a cap owes. It takes the **second** of the two options #110 named, because D4 makes it available for free:

   > *"Contended" means the whole suite at turbo's default fan-out. The root script caps at 2 (ADR-0057), so a bare `pnpm test` is never an anchor. **The CI gate log is the anchor source**: the gate runs `pnpm test --concurrency=10` with `MIOLOS_TEST_DB_TIMING=1`, uncapped and instrumented, and has been green throughout. **Locally, `pnpm test --force --concurrency=10` is the uncapped command — and on the reference box it is currently red 15 times in 16**, so it yields no legal anchor at all until the PGlite class is closed rather than avoided. Where a population has no eligible anchor, that is recorded as the reason a shipped budget is not re-derived, never worked around by using an ineligible figure.*

   And the load-bearing corollary: **a budget sized against capped figures under-shoots the uncapped worlds** — a developer invoking `turbo run test` directly, CI, and any future revert of the cap.

   **A consequence this plan accepts and states**: D5's 11 007.8 ms is a *capped* figure and therefore not an anchor by this very rewrite. D5 says so in those words and uses it only to show the shipped 30 000 is not breached under the shipped local configuration.

c. **Decision 1 gains the one-cost-driver clause** (D6): where N sites share a single shipped cost driver, the arithmetic and the measured figures live **once**, beside that driver, and each site points at it **by symbol** — by published subpath where the pointer crosses a package boundary. Warranted by the measured rot (§4: 9 byte-distinct texts and 3 wrong attributions across 26 copies), not by analogy to decision 3.

d. **The "root fan-out is deliberately left uncapped" consequence bullet is false** and is rewritten to point at ADR-0057 and to record what D4 preserved of its intent — including that its sentence *"pre-commit and CI stay identical"* is now false and deliberately so.

e. **The PGlite carve-out in the Consequences is false on both clauses** and is corrected: *"It does **not** cover the PGlite `beforeAll` class, which is a `hookTimeout` failure this decision never measured…"*. It is measured now, and the cap covers it locally. This is the neighbour-claim rot handoff 048 §4 names — and it is the one the previous revision's own reverse-sweep pattern would have missed, which is why R8's pattern is widened.

f. **Decision 4's instantiated cost-driver list gains *"the concurrency setting on the root `test` script"*.** After D1 that setting moves the contended local figure for all five of #107's shipped timeouts; without this row a future PR changing `TURBO_CONCURRENCY=2` to 4 would move five budgets' measured basis while owing no re-read.

**Two Consequences bullets that are NOT amended, adjudicated rather than left silent:**

- *"ADR-0017 and ADR-0023 are cited and obeyed, and neither is amended … that idiom binds when a record's statement is made false, and it is not."* R3 **annotates** ADR-0017 rather than amending it, precisely because its statement stays true (turbo still fans out — at 2 locally and 10 on CI) and becomes *incomplete*. So the bullet stands as written: no reciprocal `**Amended by:**` header is owed to 0017, and the bullet's own distinction is what says so. **A sentence is added to R2's edit noting the annotation exists**, because the bullet's whole point is about clearing a record wrongly and a reader must not have to re-derive that an annotation was considered.
- *"The measurements do not live here."* Unchanged, and binding on ADR-0057 (R1).

**R2e of the previous revision — ADR-0055 Proposed → Accepted — is DROPPED.** Measured: **eight** ADRs sit at Proposed and every one of them shipped —

```
grep -H "^\*\*Status" docs/adr/*.md | grep -c Proposed   # → 8  (0046, 0047, 0050, 0052, 0053, 0054, 0055, 0056)
```

— and nothing in `docs/agents/domain.md`, `docs/README.md`, `CLAUDE.md` or the napkin names a status lifecycle, an owner for the flip, or a trigger. The argument for flipping ("Proposed is a stale label") is therefore true of eight ADRs, not one; flipping 0055 alone converts an unmaintained field into a meaningful one and implies the other seven are not-yet-adopted, which is false of all of them. The previous revision's own fallback — flip at #107's hand-close — is worse: same inconsistency, plus a side effect with no PR to carry it. **Out of scope here.** Worth doing as **a separate records ticket**: flip all eight, and record the lifecycle rule (who flips, on what trigger) in `docs/agents/domain.md` so the field means something afterwards. Named in §12 so it is not lost.

### R3 — ADR-0017: annotation on the consequence *"Turbo fans out `pnpm test`"*

True as written until D1. **Annotated in place, not amended** — the statement is incomplete rather than false: turbo still fans out, at 2 locally and 10 on CI. Pointing at ADR-0057. Cited by symbol (the consequence's own words), never by line; #110's request names it as `0017:21` and this plan deliberately does not carry that form forward.

### R4 — `.claude/napkin.md`, three items

- **Execution item 8** — the item's headline says the PGlite class is *"still open and unmeasured"*, and its carve-out says the `TURBO_CONCURRENCY=1` clearance does **not** cover *"the PGlite `beforeAll` timeouts … a `hookTimeout` class #107 never measured (~20 `apps/api` files declare `beforeAll(…, 30_000)`)"*. **Those are the sentences that go false**, and they are false in three ways after this ticket: it is measured; it is covered locally; and the population is 26 across two packages, not ~20 in one. Replace with the shipped cap, the CI exemption, **and what remains** — the class is *avoided, not closed*; at default fan-out it still fires; CI, a bare `turbo run test` and any revert of the cap all run the configuration where it fires; a higher cores-to-RAM box re-opens it.

  **What is NOT a contradiction, corrected from the previous revision.** Item 8 retires `TURBO_CONCURRENCY=1` *with an explicit carve-out*, and handoff 048 landmine 1 says the workaround survives *because of #114*. Those two agree. There was never a contradiction to fix, and claiming one would have been exactly the neighbour-claim rot this ticket is about.

- **Execution item 4** — *"hook half unswept, vitest prints no hook durations"* is now false for this population. Replace with the narrowed clause from R2a and the instrument's env var.

- **Shell item 3** — *"The repo ships **no** cap today; #110 owns that question"* is now false. Replace with the shipped shape, the CI flag, and the reason both a flag-on-the-script and a `${VAR:-2}` form were rejected. Every other clause in that item — flag beats env var, double flag is a hard error, `turbo.json`'s key is global and breaks `pnpm dev` below 3 — was re-verified on this tree and stays.

### R5 — `docs/README.md`: two new rows **and one correction**

- New: `plans/049-…` and `adr/0057-…`.
- **Correction**: the existing `adr/0055-…` row says *"swept on the `testTimeout` axis, explicitly unswept on the `hookTimeout` axis because vitest prints no hook durations"* — false after R2a. This is precisely the neighbour-claim rot handoff 048 §4 names, and it would be missed by any sweep that only looks for new rows.

### R6 — `docs/agents/test-ids.md`

A #114 (plan 049) paragraph: reserved `T-WEB-S225…S228`, spent `S225…S227`, tail `S228` burned if unspent; the ids sit on `describe(...)`, which is `apps/web`'s shipped convention; frontier re-derived numerically at step 8; `T-WEB-S228` added to the burned table if it goes unspent. **No `T-DB`, `T-CORE`, `T-API` or `T-LINT` id is reserved.** The paragraph also records that this plan's step-3 revision proposed `T-DB-S59…S64` and that **that reservation was never committed and is therefore not issued and not burned** — the file has no `T-DB` allocation from #114 at all.

### R7 — Issues (living documents; comments, not edits)

- **#114** — posted **before implementation**, stating that AC2 as written will be reported failed with a measured negative on the shipped tree, and **proposing** the re-reading for Fernando to confirm (§9.2). Dated before the evidence, not retrofitted.
- **#110** — the absorption, the measurements it asked for, which of its ACs are discharged and which are re-aimed by D4, and the close-as-delivered-by-#114. **This is the one issue that closes.**
- **#109** — §9.4's file-scoped correction.
- **#107** — after Block C, stating that its AC1 changes meaning identically and **asking** rather than closing (§9.2).

### R8 — The two-way amendment check (handoff 041 §4, handoff 048 §4)

Run in **both** directions and report the **mapping**, never a bare count:

- forward: every row above → at least one hit in the tree;
- reverse: every hit maps to a row, or is in a snapshot class (`docs/plans/`, `docs/handoffs/`) and is therefore correctly left alone.

**The reverse pattern is widened**, because the previous revision's pattern matched **none** of the tokens in the ADR-0055 sentence it missed (R2e) — the mechanism built to prevent this exact failure would have reported clean:

```
grep -rn -E "TURBO_CONCURRENCY|uncapped|no cap|unswept|1\.2 ?s|3[–-]4[×x]|\+ margin|migration.{0,15}replay|PGlite|beforeAll|hookTimeout|never measured|30_000|concurrency" \
  --include="*.md" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" --include="*.yml" . | grep -v node_modules
```

- Citation-drift sweep uses **citation-shaped** patterns (`testing\.ts:[0-9]`, `0055-[a-z-]*\.md:[0-9]`, `0017-[a-z-]*\.md:[0-9]`) and includes `apps/web/test`, per handoff 048 §2.
- **Every citation in every file this PR writes is a symbol, never a `file:line`.**

---

## 9. Acceptance

### 9.1 What is reported, in one sentence

**#114's AC2 as written is NOT MET.** This ticket does not achieve ten consecutive forced green runs at default turbo concurrency, and the measured negative is taken **on the shipped tree**, not on the tree that predates the fix.

### 9.2 The re-reading is PROPOSED, not enacted — and it binds #107 identically

AC2 asks for *"`pnpm test` at **default** turbo concurrency passes 10 consecutive forced runs on `main`"*. After D1, `pnpm test` means concurrency 2 locally and 10 on CI, so the word *default* stops meaning what it meant when the AC was written.

**#107's AC1 changes meaning in exactly the same way**, and the previous revision was silent about it. #107's AC1 is *"`pnpm test` from the root passes 10 consecutive forced runs on `main`, output pasted"* — a ticket whose title and whole subject is *"Root-level `pnpm test` is a coin flip … under turbo's fan-out"*. A capped block no longer exercises the wall suites at the fan-out their budgets exist for, and #107's own deferred `T-LINT-S9` drift diagnosis (29 030 ms, past its `budget / 2`) was explicitly held for *"the measurement to trust is the one taken after #114 lands"* — under the cap that measurement is a capped figure, which by R2b is not an anchor and resolves nothing. The re-worded AC2 and #107's AC1 would also be **the same sentence**, so one ten-run block would discharge both tickets, which is precisely why it must not do so silently.

**The proposal, posted on both issues and in the PR body, labelled as a proposal:**

> After #114, `pnpm test` means turbo concurrency 2 locally and 10 on CI. **Proposal, for Fernando to confirm:** read #114's AC2 and #107's AC1 against the repo's `pnpm test` as it then is — a capped local block — **plus** the uncapped figure recorded separately as a measured negative. **Neither issue closes on this point until that is confirmed.** #110 closes as delivered-by-#114 and is unaffected.

**No fresh block of ten *uncapped* runs is run for the pre-fix record.** Sixteen pooled samples across two sessions and two trees (0/6 this session, 1/10 in handoff 048's Block C on `main` at `aa2fac2`) are stronger evidence than a fresh ten, and landmine 6 makes red-run wall clocks incomparable anyway. What **is** run fresh is Block D below, on the shipped tree, because reporting a red without output from the shipped configuration is the evidence rule inverted.

### 9.3 #110's acceptance, re-aimed by D4

| #110 asked for | Disposition |
|---|---|
| "a cold CI figure at the proposed cap, `Cached: 0 cached, 6 total` quoted, against 5m30.276s" | **Void by construction** — the cap does not bind on CI. Replaced by the artifacts in Block F. No performance claim is made, which is the honest answer to a comparison #110 itself showed is biased by cache warmth. **Re-aimed, not discharged.** |
| "a written decision — ship or close-as-measured — with the number" | **Discharged.** Ship at 2. Numbers in §2.3. |
| "`pnpm dev` shown starting without turbo's persistent-task error" | **Discharged** — and trivially, because `turbo.json`'s global key is untouched. Shown anyway. |
| "`pnpm test --concurrency=10` shown actually running at 10" | **Discharged**, by Block F's two artifacts, and additionally pinned by `T-WEB-S226`. |
| "ADR-0017:21 annotated" | R3 — **by symbol**, not by line. |
| "ADR-0055 decision 2's procedure rewritten + a fifth decision" | R2b + the `**Amended by:**` header. The fifth decision's substance lives in ADR-0057 with decision 2's rewrite naming it, so the cap is stated once — **re-aimed, not discharged**, and R1 says so explicitly to pre-empt a duplication finding. |
| "napkin item 8 corrected" | R4. |

**The artifact that does not exist, and what replaces it.** The previous revision promised *"the gate run's own turbo summary showing the run at concurrency 10"*. **Turbo 2.10.8 prints no such thing** — its run header has no concurrency line, `--dry-run=json` has no concurrency field, and `grep -ril concurren` over all 24 run logs from this session returns **0 files**. Two producible artifacts replace it, both verified on this box:

1. **pnpm's own echoed command line.** `pnpm <script> <flags>` echoes the resolved command including an inline env assignment and the forwarded trailing flags — verified in-repo (`pnpm typecheck --dry-run` → `$ turbo run typecheck --dry-run`) and on a scratch package with an inline assignment (`> FOO=2 node … --extra=10`). After D1, `pnpm test --concurrency=10` echoes `TURBO_CONCURRENCY=2 turbo run test --concurrency=10`, which shows the cap, the override and the precedence in one line.
2. **A behavioural proof from the run log itself.** Turbo emits one `<pkg>:test: cache bypass, force executing <hash>` line per package as it starts it. At fan-out 10 all six appear consecutively before any suite finishes (E1: lines 8–13). At TC=2 they are staggered through the output as lanes free up (TC2-2: lines 8, 9, 24, 35, 62, 73). **The positions of those six lines are the concurrency**, and they are already in every log this session produced.

### 9.4 #109 and the web flakes — the correction, scoped to the file

This ticket **does not fix #109** and re-sizes nothing in `apps/web`'s existing suites. It owes #109 one comment, and the previous revision's draft of it was **false and must not be posted**:

> **`apps/web/test/nonogram-screen.test.tsx` has been seen red** — as `Test timed out in 5000ms` in runs J3 and G1 of #114's diagnostic round, alongside `T-WEB-S119`, `T-WEB-S203` and `T-WEB-S28`. **The `describe` that went red is `the board geometry (T-WEB-S48) > C1`, which is not the test #109 is about**: #109's third residual is the `T-WEB-S43` clue-rails `describe`, *"renders one labelled rail per row and per column"*, and #109 never mentions `T-WEB-S48` at all. So #109's *"It has never been seen red"* and *"None of the three has ever gone red"* both still stand for the tests #109 names. What has changed is that the **file** is now known to time out under load.
>
> All four reds are **starvation victims of the memory exhaustion #114 diagnoses, not defects in the named tests**, and per ADR-0055 decision 2 a run in which anything timed out is never an anchor — so none of these figures sizes anything, here or in #109.
>
> Two consequences for #109: (1) its third row's **2 368 ms figure was taken on an uncapped local run**, and after #114 a local `pnpm test` is capped, so that figure must be re-labelled *"contended local, uncapped"* or re-taken with `--concurrency=10` — ADR-0055 decision 2 as amended by #114; (2) under the shipped cap this class did not appear at all (0 test timeouts in the four capped runs), so #109's remaining work is unchanged and still gated on a CI figure per its own acceptance.

GitHub's `blocked_by` edges are left alone.

### 9.5 The CI hook figure, with its reading rule pre-committed

ADR-0055 decision 4 binds this PR: *"a pull request that touches a timed test's cost driver re-reads that test's CI duration out of its own gate log and into its PR body."* This PR edits `createTestDb`, which D6 itself calls the cost driver. Naming a residual in a **new** ADR does not discharge an obligation in an existing one, and the stated excuse — vitest prints no hook durations — is retired by this ticket's own instrument. **Silence is the one option §8's standard forbids.**

So D4 turns the instrument on at the gate, and the PR body pastes the pooled maximum:

```
gh run view <gate-run-id> --log | grep 'MIOLOS_DB_TIMING .*event=end' | ...  # pooled max total_ms
```

**The reading rule, pre-committed here before the draw** — the #111-disposition discipline from #107, applied to a number instead of to a red:

- **under 12 000 ms** (40 % of 30 000, decision 1's trigger): the budget stands; the explicit timeout is confirmed as required; recorded with the figure.
- **12 000–15 000 ms**: still under `budget / 2`; the budget stands; recorded with the figure and flagged in the napkin as the population's first CI reading.
- **over 15 000 ms** (`budget / 2`, decision 4): a defect to diagnose and record — **not** a number to raise on the first crossing, because decision 2's residual means a single figure over the line may be a draw.

Two ways this can fail to produce a figure, named in advance: the gate's test task could be a **cache hit** (it will not be — this PR edits `turbo.json` and `packages/db/src/testing.ts`, invalidating everything — but the PR body quotes `Cached: 0 cached, 6 total` to prove it), and D7 could be dropped, which would silently make the instrument inert. If neither the figure nor a stated reason appears, the obligation is not discharged.

### 9.6 The evidence blocks

- **Block A — the branch.** 10 consecutive `pnpm test --force` runs on `fix/114-pglite-hook-timeout`. Turbo's own `Failed:` line is the authority (landmine 6). All ten pasted.
- **Block B — equivalence.** A statement that branch and `main` differ only by the §5 file list, with `git diff --stat main...HEAD` pasted **from the actual command**, not retyped (handoff 048 §4 records a diffstat pasted wrong twice).
- **Block C — `main`, after merge, capped.** Ten consecutive `pnpm test --force`. **This is the block #107's AC1 and #114's AC2 would be read against under §9.2's proposal.** Pasted on #107 and #114. **It closes neither** until Fernando confirms. Protocol in §9.7.
- **Block D — the uncapped truth, on the shipped tree.** At least **three** consecutive `pnpm test --force --concurrency=10` runs on the merged code with `MIOLOS_TEST_DB_TIMING=1`, pasted with their hook-timeout counts and pooled boot maximum. **This is the measured negative that AC2 is reported failed against**, and it is the only thing that tells R2b whether its own rewritten anchor command is runnable. §2's pre-fix 1/16 is quoted beside it as the pooled history, clearly labelled as pre-fix.
- **Block E — the mechanical gate.** `pnpm typecheck`, `pnpm lint`, `pnpm test`, output pasted. `npx impeccable detect` is **not** owed: no UI file moves. The one `apps/web` file added is a test.
- **Block F — the overrides and the concurrency artifacts.** `pnpm dev` starting clean; and the two artifacts §9.3 names — pnpm's echoed command line, and the `cache bypass, force executing` line positions at 2 and at 10.
- **Block G — the CI hook figure.** §9.5, with `Cached: 0 cached, 6 total` quoted and the reading rule applied as pre-committed.

**Idle-box hygiene for every block**: the `pgrep` assertion must filter its own wrapper shell (landmine 5) or it never reads empty. And per ADR-0055 decision 2, an agent session resident on the box is *counted as contention*, not excluded from it.

### 9.7 Block C's protocol, reproduced from #107 rather than summarised

#107 pinned this in a comment and called four of its details "not to drop". The previous revision dropped all of them. Verbatim shape:

```bash
cd /home/ferna/projects/miolos                            # NOT a worktree
source ~/.nvm/nvm.sh && nvm use default >/dev/null        # fresh session: nothing has set a node version
git checkout main && git pull && git log --oneline -1     # the squash commit, pasted
pgrep -af "next dev|turbo run dev|vitest|next-server"     # empty, pasted — TAKEN HERE, in this directory
for i in $(seq 1 10); do
  s=$SECONDS
  pnpm test --force > /tmp/114-main-$i.log 2>&1
  echo "MAIN $i rc=$? elapsed=$((SECONDS-s))s"
  tail -4 /tmp/114-main-$i.log
done
```

The four details: the idle assertion is taken **in that directory, immediately before the loop**; `git log --oneline -1` is pasted and must show this PR's squash commit; do **not** remove the sibling worktrees to free `main`; and the nvm preamble is restated inside the block on purpose. Each run shows `Cached: 0 cached, 6 total`.

**And the #111 disposition, which is the pre-committed anti-laundering rule and which stopped #107's own Block C:**

> **If a Block C run goes red on `T-API-S41` with an `AssertionError`, the run is annotated as #111 and the ten-run block is openly re-run to ten consecutive in-class-green. Both blocks are pasted in full, and the discarded one is labelled as discarded, with the failing run identified.** Any *other* red — a `Test timed out in Nms`, an assertion failure anywhere else, a red in a package this PR did not touch — is a real finding: diagnose it, do not re-run it.

---

## 10. Test ids

### 10.1 Placement, decided before the reservation

The three scans read the **repo root's** `package.json`, `turbo.json` and `.github/workflows/ci.yml`. The previous revision put them in `packages/db/test/`, where the weakest of them would have been a leaf package asserting on a workflow file.

**They go in `apps/web/test/fanout-cap.test.ts`, and the ids are `T-WEB`.** The warrant is the repo's own shipped precedent: every existing test that reads a **repo-root** file lives there and resolves `repoRoot` as `../../..` — `eslint-{db,free-play,og}-wall.test.ts` read `eslint.config.mjs`, `medals-content.test.ts` reads `content/medals/README.md`, `og-card.test.tsx` reads `packages/ui/tokens.css`. `apps/web/test/` is where root-config scans already live.

**A precedent the previous revision claimed and which does not exist:** *"a test whose subject is a workflow file: `apps/web/test/route-ssr.test.tsx`"*. Verified false — `grep -rn "workflows\|ci\.yml" apps packages --include="*.test.ts*"` returns exactly one hit, a **comment** in `route-ssr.test.tsx` mentioning `.github/workflows/impeccable.yml`. **`T-WEB-S226` is the repo's first test to assert on a workflow file**, and it is named as a first rather than dressed as a precedent. The precedent that *does* exist is a test asserting on a `package.json` — `packages/games/test/purity.test.ts`, though on its own package's manifest, not the root's.

The `T-LINT` area is not available: `docs/agents/test-ids.md` defines it as the `apps/web/test/eslint-*-wall.test.ts` suites specifically, and this is not one.

### 10.2 The reservation

**Reserved: `T-WEB-S225…S228`**, re-derived numerically:

```
grep -rhoE "T-WEB-S[0-9]+[a-z]?" apps packages | sort -u | sort -t S -k2 -n | tail -1   # → T-WEB-S222
```

`S223`/`S224` are plan 043's burned tails, so `S225` is next free. **Spent `S225…S227` at step 5. `T-WEB-S228` is the review-round headroom and is burned if unspent.** No `T-CORE`, `T-DB`, `T-API` or `T-LINT` id is reserved: nothing in `packages/core`, `packages/db`, `apps/api` or the lint walls adds an assertion. The 26 test-file edits change comments only — no assertion, no id.

**The ids sit on `describe(...)`**, which is `apps/web`'s shipped convention per `docs/agents/test-ids.md`'s opening note. The `eslint-*-wall.test.ts` `it(...)` exception does not apply here.

| id | claim |
|---|---|
| `T-WEB-S225` | the root `test` script caps turbo **and stays overridable**: it sets `TURBO_CONCURRENCY` and carries **no** `--concurrency` flag (a flag would silently make an override impossible) |
| `T-WEB-S226` | CI is deliberately uncapped and instrumented: the gate step passes `--concurrency=10` and sets `MIOLOS_TEST_DB_TIMING`. Fail-closed — drop either and CI silently inherits the cap and its +55 %, or stops measuring the hook |
| `T-WEB-S227` | `turbo.json` carries no global `concurrency` key at any nesting, and its `test` task declares `MIOLOS_TEST_DB_TIMING` in `env` — the placement that breaks `pnpm dev` and silently caps `typecheck`, and the declaration without which D4's measurement is inert |

**What these three do NOT prove, stated so the PR body does not over-claim.** They are **source scans**: they assert what the manifests and the workflow *say*, never what turbo *did*. `T-WEB-S225` cannot show a run happening at 2, and `T-WEB-S226` cannot show the gate running at 10. The evidence #110 asked for is behavioural and lives in Block F (§9.3) — pnpm's echoed command line and the `cache bypass, force executing` line positions. The scans are the tripwire that keeps the configuration from drifting after that evidence is taken; they are not the evidence.

**Why the scan tests exist at all.** `package.json` and `turbo.json` are JSON and carry no comments, so the cap's value and its reasoning have nowhere to live beside them. **These three tests are the comment the manifests cannot have** — they carry the ADR pointer in a place a `git blame` and a red run both lead to.

**The provenance of that argument, stated correctly.** The previous revision attributed it to *"#110's own rejected-option E"*. **#110 has no lettered options and does not contain that sentence.** The sentence is **ADR-0055's own Rejected section**, on a per-package CLI `--testTimeout`: *"`package.json` is JSON and carries no comments, so the arithmetic would have nowhere to live"* (and plan 042 §7's Option E, which ADR-0055 distils). Its subject is a timeout value, not a concurrency cap. **#110's actual words** on the adjacent point are *"Six script edits, the number lands in comment-free JSON, and it does nothing on CI."* Extending the argument from a timeout to the root cap is **this plan's own move**, and is labelled as such wherever it is used — including in the comment posted to #110, which the previous revision would have carried the misattribution into.

**A red from `T-WEB-S225` on a legitimate future change is the design, not a defect** — it is a tripwire, updated with evidence, the way the bundle markers and the walls are.

---

## 11. Build sequence

0. **Baseline, before a single edit — derived, not asserted.** Run and paste: `git status --short` (expect only `packages/db/src/testing.ts` plus this plan), `git log --oneline -3`, the five test-id greps from §0.1, `ls docs/adr/ | tail -1`, and `ls docs/plans/ docs/handoffs/ | sort | tail -3`. **Do not count this plan's own artifacts in any baseline** (handoff 048 §4: a #96 test baseline counted the plan's own probe) — plan 049 is untracked at this point and must be excluded from the docs-numbering derivation.
1. **Post the #114 comment** (§9.2). Before any code. The proposal must be dated earlier than the evidence.
2. **Commit the plan and the ADR-0057 stub to the branch immediately**, with the `docs/README.md` rows. Landmine 3: an allocation held only in orchestrator context gets struck as unsourced. This makes 0057 and 049 sourced from commit one.
3. **Write `apps/web/test/fanout-cap.test.ts` red**, against the un-edited tree — `T-WEB-S225…S227` must fail before D1/D4/D7 exist.
4. **D1, D4, D7** — the three config edits. The scans go green. Run `apps/web` alone.
5. **D6's canonical block** into `packages/db/src/testing.ts`. Verify `createTestDb`'s signature and return are untouched (§7 seam 4).
6. **The 26-file comment edit** — 21 mechanical, 5 by hand (`cron-publish`, `session`, `daily-nonogram`, `daily-termo`, `termo-guess`). Verify by the greps in §7, and the five by reading. `git diff` on `cron-publish.test.ts` must be a three-line replacement.
7. **The records** (§8), including the two-way sweep in both directions with the widened pattern.
8. **Block A**, then the gate (Block E), then push and open the PR with `Refs #114`, `Refs #110`, `Refs #109`, `Refs #107` — **never `Closes`**. Squash-only merge makes the body the commit message and would auto-close before the post-merge blocks can run (landmine 4). Verify: `gh pr view <n> --json closingIssuesReferences` → `[]`.
9. **Merge on a green gate** (the standing decision, handoff 048 §6). Read **Block G** out of that gate's log per §9.5.
10. **Post-merge, on `main`:** **Block C** (§9.7 protocol, #111 disposition applied as written), then **Block D** (three uncapped runs on the shipped tree, §9.6). Paste both.
11. **Close #110** as delivered-by-#114. **Post on #107 and #114 and stop** — §9.2's proposal, the blocks, and the explicit statement that neither closes until Fernando confirms. **Post the #109 comment** (§9.4). **Do not close #107. Do not close #114.**

---

## 12. Open questions and deviation register

Nothing below blocked the plan. Items 1–4 are resolved-and-recorded; 5 onward are live.

1. **PGlite 0.5.4's `close()` on a booting instance — RESOLVED, and the answer is kept even though the decision that needed it is gone.** Step 3 measured it: `close()` on an instance whose `waitReady` is pending settles cleanly, `afterAll` does run after a hook timeout, no unhandled rejection escapes, and process exit is clean in every shape tested. Also measured: a double close throws `PGlite is closed` and a concurrent close throws `PGlite is closing`, so any future teardown that batches must clear its collection **before** awaiting. D3 was dropped on rationale, not on mechanism.
2. **D3's rationale — RESOLVED against it.** §3 D3. The two defects it claimed do not fire; the real mechanism is not reachable by a teardown; and it would have added a second hook timeout in the uncapped worlds.
3. **ADR-0055 Proposed → Accepted — DROPPED as out of scope**, with a successor named: a records ticket that flips all eight Proposed ADRs and writes the lifecycle rule into `docs/agents/domain.md`. Not filed by this plan; §8 R2 is where the reasoning lives.
4. **Scan-test placement — DECIDED before the reservation** (§10.1), `apps/web/test/`, `T-WEB` ids, on the repo's own root-config-scan precedent. The claimed workflow-file precedent was verified false and is replaced by an honest "this is the first".
5. **The `~450 MB` per-worker constant understates a PGlite-bearing worker at peak** (~700 MB pre-GC, ~343 MB steady). The model is a fleet estimate. D2 leans on the two direct whole-run samples instead, and ADR-0057 states the shape without the constant — but the constant is still what §2.2's four-line model prints, and a reviewer may reasonably want it removed from the plan too. Left in, labelled.
6. **CI's contended hook cost is measured for the first time by this PR** (§9.5) — and could still fail to produce a figure two ways (cache hit; D7 dropped). Both are named in advance, with the artifact that proves neither happened.
7. **Shipping `MIOLOS_TEST_DB_TIMING: "1"` on the gate permanently** adds ~52 stderr lines to every gate log, forever. The alternative — set it for this PR and remove it — makes ADR-0057's residual permanent and means the population never accumulates CI samples. Taken deliberately; the cost is stated in D4 and is the smallest attackable decision in this revision.
8. **CI's core count is taken from the repo's own record** — a comment in `packages/games/test/sudoku/generate.test.ts` naming *"GitHub's 2-core runner"* — plus `gh repo view --json visibility` → `PRIVATE`, which puts `ubuntu-latest` in the standard 2-vCPU class. **Not asserted from memory, and `nproc; free -m` on the gate step makes it printed rather than argued from this PR onward.** D4 is built so the answer does not change the decision: the cap does not bind on CI either way.
9. **`turbo run test`'s `dependsOn: ["^build"]` means the cap also throttles dependency builds.** Every measured run used `--force`, so the figures already include forced builds and the effect is priced in; a warm bare `pnpm test` (what pre-commit runs) is strictly cheaper. Stated so no one re-derives it.
10. **ADV1 ran db+api with nothing else resident, whereas a real TC=2 run may have residue from a just-finished package.** Node workers exit, so the residue is bounded, but ADV1 is a slightly optimistic worst case and D2 leans on it. The M1 full-run sample at 8 042 MB / 16 procs is the check that keeps it honest.
11. **The teardown hook population is still unmeasured** — 26 `afterAll`, 75 `beforeEach`, 62 `afterEach`, none with an explicit budget, all on vitest's bare 10 000 ms, and the instrument reports nothing at close. This ticket no longer makes it worse (D3 dropped) and does not measure it either. ADR-0057 residual; a `close_ms` field beside `reportTiming` is roughly three lines whenever someone wants it.
12. **Three step-3 counts were re-derived differently** and are recorded in §4: 9 byte-distinct comment texts rather than 8; three files carrying the distant *"keeps its own"* remark rather than two; 62 `afterEach` rather than 63. None changes a decision.
13. **Where two reviewers' recommended fixes conflicted, the pick is stated in place.** The one real conflict: one reviewer asked to *drop* the "self-refuting arithmetic" claim outright, another to *restate it honestly*. **Restating won**, in the canonical comment's closing paragraph — the loose `+ margin` is genuinely why the shipped sentence cannot be checked, and deleting the observation would lose the only evidence that the 21 comments were never sized against anything. What is dropped is the arithmetic that misquoted itself.
