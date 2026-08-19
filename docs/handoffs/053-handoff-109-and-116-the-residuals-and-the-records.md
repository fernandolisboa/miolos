# Handoff 053 — #109 and #116 merged, the residuals and the records

**Point-in-time snapshot, 2026-08-18.** `main` at `a6993fc`. Not a living document.

Two record-class tickets ran back to back and both merged. Nothing is left open on a decision; everything below is either a rule now in force or a trap the next session will otherwise re-discover.

---

## 1. Where things stand

| | state |
|---|---|
| **#116** | **Closed** — merged as [`6829cf8`](https://github.com/fernandolisboa/miolos/commit/6829cf8) (PR [#122](https://github.com/fernandolisboa/miolos/pull/122), 2026-08-18 19:51 −03) |
| **#109** | **Closed** — merged as [`a6993fc`](https://github.com/fernandolisboa/miolos/commit/a6993fc) (PR [#124](https://github.com/fernandolisboa/miolos/pull/124), 2026-08-18 20:53 −03) |
| **#123** | **Open, `needs-triage`** — filed at #109's step 5; the gate-shape successor the sudoku tripwires now point at |
| **ADRs** | 57 files, **zero `Proposed`**. `grep -H "^\*\*Status" docs/adr/*.md \| grep Proposed` → empty, exit 1 |
| **Open frontier** | 25 open issues, 22 unblocked. Blocked: #37, #36 (M4), #33 (M3) |

Nothing is waiting on Fernando to proceed. Three things are shipped **for veto**, recorded in PR #124's "Decisions for Fernando" — §7 below.

---

## 2. What shipped, per ticket

### #116 — the ADR status lifecycle (`6829cf8`, 22 files)

- **Nine ADRs flipped to `Accepted`, not eight** — 0046, 0047, 0050, 0052, 0053, 0054, 0055, 0056 **and 0057**. ADR-0057 joined between the issue being written and the work being done, when #117 merged, exactly as [ADR-0057](../adr/0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md)'s own consequence (e) predicted it would. The issue's scope item 3 said *re-derive rather than trust this list*, which is what made the correction a correction and not a contradiction.
- **Six lowercase headers normalized** — 0019, 0020, 0021, 0023, 0024, 0025 carried `Status: accepted` plus a separate `Date:` line and were invisible to the acceptance grep. Dates unchanged, H1s and bodies untouched.
- **The rule** lives in [`docs/agents/domain.md`](../agents/domain.md) § "ADR status lifecycle": line 3 is the status line, the four literal header forms, `Proposed` / `Accepted` / `Superseded` (whole vs in part) / `Withdrawn`, amendment as status-neutral, **owner** = the agent driving the shipping PR, who writes the flip into that PR's diff **at step 5, with the code**, **trigger** = the merge, **checker** = the step-6 ADR reviewer, and no mechanical checker with the reason and the reversal trigger written down.
- **`shipped in #PR`** is the new provenance token on every post-rule `Accepted` line. ADR-0053 cites `#94 and #95` (its code shipped in two PRs by its own decision); ADR-0055 is the one date that moved (drafted 08-15, merged 08-16).
- **Reciprocal `**Supersedes in part:**` on ADR-0003 and ADR-0004**, owed to ADR-0001 since July and never written.
- One tense parenthetical on ADR-0057 (e), a pointer sentence in `CLAUDE.md`, one clause on napkin Execution #5.

### #109 — the three timeout residuals (`a6993fc`, 9 files)

| test | before | after | warrant |
|---|---|---|---|
| sudoku `P1 — determinism` | 240 000 | **625 000** | never derived by ADR-0055 decision 2; trigger fires (155 025 ms CI pooled max = 64.6 %) → set now. 155 025 × 4 = 620 100 |
| sudoku `P3 — weekday ramp` | 60 000 | **100 000** | same class; trigger fires on 2 of 7 including the max (24 386 = 40.6 %). 24 386 × 4 = 97 544 |
| sudoku `P2 — solvability` | 240 000 | **240 000** | retained under decision 4; decision 2's arithmetic would say 250 000 — recorded beside it, not moved |
| sudoku `P3 — full-week` | 60000 | **60_000** | retained; respell only |
| `T-WEB-S43` clue rails | (default) | **no timeout** | measured-and-fine: 990 ms CI max = 19.8 % of the 5000 ms default, 624 ms local |

Plus the records the ticket owed: **ADR-0055 annotations (j)–(p)** with the header line `**Amended at #109**`; the **ADR-0057 decision 5 reciprocal** and the `**Amends:**` (m) clause; the `T-WEB` frontier corrected `S229` → `S230` (a live trap #120 had left); napkin Execution #4 rewritten; **#123** filed. **No `numRuns` change** — the diff-grep is empty and ADR-0023's floor is untouched.

And one edit to someone else's rule: **#109 added a sentence to `docs/agents/domain.md` hours after #116 landed it.** #109 is the first ticket to amend an `Accepted` ADR at decision level **with no ADR of its own** — every `**Amended by:**` in `docs/adr/` cites an ADR, so the rule as written failed the PR that first hit it. The repair names the `**Amended at #N**` header idiom, makes the plan's records section the reciprocal, and widens "Who checks" to *"or `**Amended at #N**` where the amender is a ticket"*.

---

## 3. The durable findings

### 3.1 The decision-2 / decision-4 partition — ADR-0055 annotation (p)

ADR-0057 decision 5 asked the settling ticket to say which of ADR-0055's decision 2 and decision 4 governs a shipped ceiling. The answer shipped as a **partition**, so that no shipped ceiling falls between them:

> **Decision 2 governs a budget being SET** — for the first time, **or** a shipped budget decision 2 never derived on which decision 1's 40 % trigger fires, with decision 4's diagnosis written **first** where the tripwire is also crossed.
> **Decision 4 governs every other shipped ceiling** — whether or not the trigger fires, whether or not decision 2 derived it: **retain** the number, record any arithmetic disagreement beside it, diagnose anything over `budget / 2`, and **never raise on the tripwire alone.**

**The clause that earns the partition, and the one the first draft left out:** a budget decision 2 *did* derive sits at `anchor = 25 %` of its own budget by construction, and decision 1's trigger sits at 40 % — 1.6× the anchor, against the tripwire's 2×. So on a conformant decision-2 budget the trigger firing is **expected**, not a signal, and any sample between 1.6× and 2× the anchor lights it while the budget is still the right one. The first draft defined decision 4's domain by #109's own instances (*"sound derivation, no defect, never red"*) and left the commonest future case ungoverned. The partition is what makes `P2` holding at 240 000 follow from the rule rather than patch around it.

### 3.2 Annotation (o) — a sample of a configuration nothing ships is history, not an anchor

> Samples taken under a **worker configuration no shipped command reproduces** are history, not anchors; the population's local half is re-taken under the shipped bound.

**This one rule is the whole difference between `T-WEB-S43` shipping a 10 000 ms timeout and shipping none.** The 2 368 ms figure that filed the residual was taken at `apps/web`'s pre-#120 `maxWorkers = cpus − 1 = 7`. Pool it literally and decision 2 gives `2 368 × 4 = 9 472 → 10 000 ms` on a test whose measured maximum is **990 ms** on CI and **624 ms** locally — a ceiling at 16× the worst thing ever observed, sized against a world the repo has no command for.

**Both bounding clauses are load-bearing and must not be dropped when quoting the rule:**

- **"Shipped"** means a configuration **an ADR names as a measurement configuration** — the gate's command (ADR-0057 decision 3) and decision 2's uncapped local command. A bare flag override no ADR names is not one. This is what stops (o) becoming a licence to discard an inconvenient sample by changing a flag.
- **"A worker configuration"** means the configuration of the population's **own** package. A sibling package's change moves the *contention basis* instead (ADR-0055 (f), (m)) and owes a **re-measure**, not a discard.

### 3.3 The gate-row regress: every push produces a new sample, and a recorded maximum is not a fact

This session hit it live. #109's step-7 verification round returned **FIXES NEEDED — one item**, and it did not come from any reviewer: the PR's **own gate** on the merge candidate measured `T-WEB-S43` at **990 ms**, above the 944 ms the shipped comment called the CI maximum and outside its stated range.

**The fix was not to chase the number.** It was to write ADR-0055 decision 2's own residual into the comment: **the anchor is a *sample* maximum**, so a later run above it is the estimator working, not a falsified record — which is precisely why the tripwire is `budget / 2` and not `budget / 4`. The comment therefore **owes an update only when a sample crosses the 2 000 ms trigger, never on every new gate row.**

The very next gate row came back at **666 ms**, a tenth sample inside the comment's own quoted band, and the clause held on its first exercise. Without it, this ticket would have shipped a record guaranteed to go stale on the next push — the exact defect class #109 exists to close.

> **Generalise it:** any comment, ADR annotation or PR body that records a measured maximum states that it is a *sample* maximum and names the threshold that would owe an update. A bare "max = N" is a record with a decay clock on it.

### 3.4 Sub-agent reports are written to disk **before** being returned, never only composed

Two of #109's four step-6 reviews died to credit exhaustion **after** writing their files to `~/miolos-session/` — nothing was lost, and the fix step read them off disk. Earlier in the same session a five-agent batch was killed by a process restart and **did** lose its work, because those agents had only composed final messages.

The rule: **every sub-agent whose output is worth more than a minute writes it to a file under `~/miolos-session/` as its first substantive act, and the final message is a pointer plus a summary.** The cost is one `Write`; the alternative is re-running a review round.

### 3.5 A handoff's *claims* rot slower than its *instructions* — and the fix is in this PR

This session opened on a stale instruction. Handoff 050 §1–7 landed in `7f3661f` at 21:27 with a §7 kickoff saying *"#114 and #107 are open and blocked on ONE decision from me — start by asking me to confirm"*. Both issues closed at ~23:12–23:20, and `8650cf9` appended §8 at 23:29 recording it. **The repo's snapshot rule — bodies are never rewritten, corrections are appended — was applied to §7 as well**, so the kickoff, which is the *entry point* and the one part that must always be current, was frozen as snapshot content two hours before it went false. The next session was told to ask Fernando to confirm something he had already made moot.

**Fixed in this PR**, in `CLAUDE.md` § "Handoffs between sessions": the kickoff prompt is **not** snapshot content — it is regenerated whenever the handoff gains an addendum, it lives at the very end of the file after any addenda so it cannot be orphaned above one, and it **opens with a preflight assertion** (expected `main` SHA, state of every issue it names) plus the instruction to stop and read the newest addendum if any of it fails to match. §8 of this file is the first one written under that rule.

### 3.6 Four smaller ones, each true and each cheap to trip over

1. **The box is 16 GB, not 23.5 GB.** `nproc` = 8, `free -m` total = **15 993 MB**, swap 4 096 MB. Handoff 050 §2's 23 552 MB was a mid-ticket WSL enlargement that was **reverted**; §8 of that handoff records the revert and #109 measured the current figure. It is written into ADR-0055 annotation (k) as the reference box, which is where to read it from rather than from any handoff.
2. **`packages/games` is the one workspace `vitest.shared.ts` does not bound.** Five workspaces (`apps/api`, `apps/web`, `packages/core`, `packages/db`, `packages/ui`) import `maxWorkers` from a `vitest.config.ts`; `packages/games` has none, because ADR-0017 forbids one there. That is *why* its four heavy timeouts are in-file literals at all, and why "`vitest.shared.ts` bounds the workers" is false for the exact package whose tests dominate the gate.
3. **The worktree trap on `gh pr merge --delete-branch` fired on both PRs** (napkin Shell & Command Reliability #5). The GitHub merge succeeds, the local checkout step aborts, the remote branch survives. Both were confirmed via `gh pr view --json state,mergeCommit` and cleaned up by hand.
4. **`P1`'s 4.4× drift is real and it is not the test.** 35 220 ms (gate `30683187834`, 2026-08-01, 39 test files) → 155 025 ms (`31888933252`, 2026-08-15, 161 files) on a **byte-identical** generator, unchanged `fast-check`, vitest, Node and runner class. Mechanism: **CPU share** on the 2-vCPU runner, which **saturates** once the siblings outlast the file — so it is not a function of file count and predicts nothing (08-12 measured 77 461 ms with *more* sibling files than 08-02's 124 686 ms). The successor is the gate's shape, not a bigger multiplier: **#123**.

---

## 4. What to read first, in order

1. [`docs/agents/domain.md`](../agents/domain.md) § "ADR status lifecycle" — 21 lines, the whole of #116, and the sentence #109 added to it.
2. [`docs/adr/0055-…`](../adr/0055-test-timeouts-are-sized-against-contention.md) — the `**Amended at #109**` header line, then the in-place annotations **(o)** at decision 2 and **(p)** at decision 4. Those two are §3.1 and §3.2 in full and are the authority; this handoff paraphrases them.
3. The **file-header comment** of `packages/games/test/sudoku/generate.test.ts` — the one home for the shared arithmetic, the CPU-share finding, the cost drivers, the levers that are and are not available, and the `#123` routing.
4. The comment above `describe("the clue rails (T-WEB-S43)")` in `apps/web/test/nonogram-screen.test.tsx` — §3.3's rule, in twelve lines, at the site it governs.
5. [PR #124's body](https://github.com/fernandolisboa/miolos/pull/124) — the ten gate rows with run ids, the four dismissed findings with written reasons, and "Decisions for Fernando".
6. [`docs/plans/051-…`](../plans/051-issue-109-plan-the-three-timeout-residuals.md) §12 and [`052-…`](../plans/052-issue-116-plan-the-adr-status-lifecycle.md) §12 — the deviation registers, where the plans and the tree are reconciled line by line. Both plans are snapshots; §12 is where they admit it.

---

## 5. Landmines

- **Read the sudoku lines against `312 500` and `50 000` on any gate log you open, for any reason.** That routing is in the header comment because no per-timeout cost-driver list can enumerate "the CPU demand of whatever siblings execute concurrently". A hit **on unchanged generator code** is a gate-shape defect and belongs to **#123** — not another raise.
- **`grep -c timeout apps/web/test/nonogram-screen.test.tsx` is `1`, and that one hit is the comment's own word** (*"Deliberately bare — no timeout"*). The absence of a timeout there is a shipped verdict, not an oversight. Do not "fix" it.
- **Ten genuine CI gate rows now exist for the sudoku tests**, not the seven plan 051 §2.1 was written against — the branch took three gates: [`32195070489`](https://github.com/fernandolisboa/miolos/actions/runs/32195070489) (`0 cached, 6 total`), [`32196991090`](https://github.com/fernandolisboa/miolos/actions/runs/32196991090), [`32198441929`](https://github.com/fernandolisboa/miolos/actions/runs/32198441929). The four sudoku comments' *"seven genuine gate runs"* scoping is the **anchoring window** and stays as written: more runs existing does not falsify a statement about those seven. Rows 2 and 3 read `Cached: 1 cached, 6 total` — the single replay is `@miolos/ui:test` (1 file, 3 tests, ~1.1 s), stated rather than hidden.
- **Millisecond measurements do not go into ADR-0055.** Its own Consequence forbids it; figures live in the plan and the PR body, and the annotations carry budgets, verdicts and box classes only. `944`, `624`, `2 368`, `1 959`, `35 220`, `155 025` are all absent from the ADR on purpose.
- **`**Amended at #N**` is an exception, not a precedent to spread.** `CLAUDE.md` still says a new technical decision of any weight is an ADR, and the domain rule repeats it. #124's Decision 3 names the tension outright: (o) in particular is a *new rule*, and the conservative reading files ADR-0058 instead. If that veto ever lands, the `**Amended at #N**` sentence in `domain.md` lifts out with it.
- **A `Proposed` ADR whose code ships in this PR is flipped in this PR's diff, at step 5, with the code** — merge-dated, citing the PR. Post-green re-dating is a push, which re-triggers the gate. The step-6 ADR reviewer rejects the absence.
- **Plans and handoffs are snapshot classes: append, never rewrite.** The one exception, new as of this PR, is the kickoff prompt (§3.5).
- **Sizing rules that have already cost this repo a round each:** never size from a run in which anything timed out (a killed test reports the wall, so the max is censored and turbo's sibling-kill biases the rest low); a bare local `pnpm test` is capped at `TURBO_CONCURRENCY=2` and is never a contended anchor; a cached turbo run is a **log replay**, so re-run gate evidence with `--force`.

---

## 6. Environment gotchas

- **Node is nvm-managed.** Prefix: `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`.
- **The box: 8 cores, 15 993 MB, 4 096 MB swap.** The uncapped measurement command is `MIOLOS_TEST_DB_TIMING=1 pnpm test --force --concurrency=10`; three such runs finished in 52–56 s, all six packages green, `0 cached`.
- **`gh run view --log` carries the literal three characters `^[[` for colour codes, not an escape byte.** `sed 's/\x1b\[…//g'` strips nothing and `[0-9]{4,}ms` will not match `155025^[[2mms`. Use `perl -pe 's/\^\[\[[0-9;]*m//g'` on `gh` logs; the `\x1b` form is right for local logs only.
- **This session's artifacts are at `~/miolos-session/`** — every step-1 explore, step-3 review, step-6 lens, step-7 verification and the three timing runs, for both tickets. Outside the repo, untracked, and durable across a WSL reboot in a way `/tmp` is not.
- **Read a gate figure only from a run whose package line says `cache miss, executing`.** `cache hit, replaying logs` reproduces an old figure byte-for-byte, epoch stamps included.
- **A conflicting PR produces no `gate` run at all.** `mergeStateStatus: DIRTY` means GitHub cannot build the merge ref; diagnose a missing required context with `gh pr view <n> --json mergeable,mergeStateStatus` before re-pushing, and fix it with `git merge origin/main`.

---

## 7. Exit criteria for the next session

1. **Nothing is owed before starting new work.** Both tickets are closed and their records are in the tree.
2. **Three things are shipped for veto**, all in [PR #124's "Decisions for Fernando"](https://github.com/fernandolisboa/miolos/pull/124), each with its fully-stated alternative: (a) the **decision-2 / decision-4 partition** (§3.1) — the alternative is reading decision 4 as forbidding *any* raise, which holds `P1` at 240 000 with a permanently-tripped tripwire; (b) **rule (o)** (§3.2) — the alternative is pooling the pre-#120 figures and shipping a 10 000 ms ceiling on a 990 ms test; (c) **annotations vs a short ADR-0058** carrying (o) and (p), which would make the `**Amended at #N**` idiom unnecessary. PR #122 carries one smaller one: the `shipped in #PR` suffix. If Fernando says nothing, all four stand.
3. **Do not re-derive the sudoku budgets.** Ten gate rows and three uncapped local runs are on record; the next move on those numbers is **#123**, and it is about the gate's shape.

**Unblocked candidates**, 22 of them. The ones adjacent to this session's work: **#123** (gate shape, `needs-triage` — triage it before it accumulates a second trigger), **#78** (ADR line-citation drift, whose fix is a checker rather than a sweep, and which the `**Amended at #N**` idiom just gave more to check), **#111** (`T-API-S41`, 1 root run in 400). Otherwise the frontier is wide: #106, #104, #103, #83, #76, #74, #67, #66, #65, #64, #63, #62, #61, #59, #58, #51, #35, #32, #13.

---

## 8. Kickoff prompt for the next session

```
Read docs/handoffs/053-handoff-109-and-116-the-residuals-and-the-records.md and
go from there.

PREFLIGHT — assert before doing anything else:
  - `git log -1 --format=%h` on main is a6993fc or later
  - #109 CLOSED, #116 CLOSED, #123 OPEN (needs-triage)
  - `grep -H "^\*\*Status" docs/adr/*.md | grep Proposed` is empty
If any of that does not match, STOP and read the newest addendum at the bottom
of that handoff before acting on anything in this prompt.

State: #109 and #116 both merged and closed. Nothing is blocked on me. Three
decisions are shipped FOR VETO, not for approval, and are listed with their
alternatives in PR #124's "Decisions for Fernando" — I have not vetoed any of
them, so they stand.

Pick up the frontier. #123 (gate shape for packages/games) is the one this
session created and it is untriaged. #78 (ADR line-citation drift) and #111
(T-API-S41) are the other two adjacent to what just landed.

Two rules to internalise before touching any test timeout: a recorded maximum
is a SAMPLE maximum, so a later run above it is the estimator working and owes
an update only when it crosses the stated trigger (ADR-0055 decision 2); and a
sample from a worker configuration no shipped command reproduces is history,
not an anchor (ADR-0055 annotation (o)). Do not re-derive the sudoku budgets —
that conversation is #123 and it is about the gate's shape.

And one process rule: every sub-agent writes its report to a file under
~/miolos-session/ before returning it. Two of last session's reviews survived
credit exhaustion because they had; an earlier batch of five did not.
```
