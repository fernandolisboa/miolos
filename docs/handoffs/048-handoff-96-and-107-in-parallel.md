# Handoff — two tickets in parallel, and the ticket that would not close

**To:** the session that picks up next.
**From:** the session that ran **#96** and **#107** through the eight-step flow **simultaneously**, in two git worktrees — three plan-review rounds and four fix rounds on #96, three and three on #107, four step-6 reviewers on one PR and three on the other, a step-7 verification pass on each. Both merged. **#107 did not close, and should not have.**
**Next step:** **#114 is the unblocker — read §1.2 before choosing anything else.**

Point-in-time snapshot; where an ADR disagrees, the ADR wins.

---

## 0. Check this before you read anything else

```
git checkout main && git pull && git log --oneline -3
source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm install --frozen-lockfile
curl -s https://api.miolos.app/health
Y=$(TZ=America/Sao_Paulo date -d yesterday +%F)
curl -s -o /dev/null -D - "https://miolos.app/arquivo/$Y/sudoku/opengraph-image" | grep -iE '^HTTP|^content-type'
TURBO_CONCURRENCY=1 pnpm test --force 2>&1 | tail -5
```

Expect `main` at **`aa2fac2`** (`feat: a per-game done chip on the archive day page (#96) (#113)`) on top of **`0157689`** (`test: size the ESLint wall and Binairo timeouts against contention (#107) (#112)`), or a descendant.

**`TURBO_CONCURRENCY=1` is still required, but for a different reason than before.** #107 fixed the `testTimeout` class. What remains is `@miolos/db`'s PGlite `beforeAll` — **#114** — which fails 9 root runs in 10 at default fan-out. See §1.2.

**No schema change, no migration** in either ticket. `git diff eea445e..aa2fac2 -- packages/db/src apps/api/src` is empty.

---

## 1. What shipped, and what did not

### 1.1 #107 → PR #112 (`0157689`) — merged, **issue still open**

Five explicit in-file timeouts, each with its arithmetic in a comment: the three ESLint wall suites at **40 000 ms** via module-scope `vi.setConfig`, and Binairo `P1`/`P2` at **25 000 ms** via a trailing positional argument (ADR-0017 forbids a vitest config in `packages/games`). No assertion changed; `numRuns` byte-unchanged (ADR-0023). **No concurrency cap** — deferred to #110 with its measurements attached.

[**ADR-0055**](../adr/0055-test-timeouts-are-sized-against-contention.md) records the policy. Its load-bearing sentence is the one that took three review rounds to earn:

> The anchor is the maximum of a sample drawn from a heavy-tailed scheduling distribution, and the maximum of a sample grows with the sample. This ticket watched it grow twice: 4983 (n=3, censored) → 7907 (n=5) → 9832 (n=11). A later session may exceed 9832 ms, and **that would not falsify this rule — it is the expected behaviour of the estimator.**

It did exactly that in Block C: **29 030 ms**. The ×4 and the round-up absorbed it. The drift tripwire sits at `budget / 2`, **not** `budget / 4`, because `budget = anchor × 4` makes `budget / 4` *the anchor itself* — a line there fires precisely when a session sets a new sample maximum, which decision 2 predicts as normal. That reconciliation is the single most important thing in the ADR; do not undo it.

### 1.2 **#107 is open, blocked by #114, and this is the next thing to do**

AC1 is *"ten consecutive forced green runs on `main`, output pasted"*. Block C ran on `aa2fac2`, idle box: **1 green / 10**. All nine reds were `@miolos/db`, `Error: Hook timed out in 30000ms`, on `createTestDb()`. **Zero `Test timed out in 5000ms` in ten runs** — not one failure of the class #107 fixed.

That is **#114**, the `hookTimeout` axis, which ADR-0055 decision 1 **declares unswept** because the corpus sweep reads per-test durations from a gate log and vitest prints no hook durations. It reproduces on `eea445e` with an untouched tree, so it predates both PRs.

The disposition was written **before** the draw and says *"any other red is a stop"*. So the block was not re-rolled. The full evidence is on [#107's comment](https://github.com/fernandolisboa/miolos/issues/107#issuecomment-5308388229). **#107 owes: #114 lands → Block C re-runs → ten green pasted → close by hand.** GitHub's native `blocked_by` edge is set.

**Do not re-anchor the timeouts on Block C's figures.** They were taken while a different defect held the box for 30 s at a time; sizing against them would size against #114 rather than against contention. The measurement to trust is the one after #114.

### 1.3 #96 → PR #113 (`aa2fac2`) — merged, issue closed

A `Feito`/`Jogado` chip on each `/arquivo/<data>` game card, in an in-flow row beside the kicker. Device state only: server render carries no chip, hydration can only ever add one.

**The issue's own prescribed approach was unimplementable, and that is the ticket's real story.** #96 said *"a chip wants the live `useRecordSnapshot`"*. That hook kept **one module-level cache slot**, so four per-card consumers evicted each other on every `getSnapshot`, every read returned a fresh object, `useSyncExternalStore` never stabilised, and React aborted with `Maximum update depth exceeded` — a white screen, measured in step 1 and reproduced independently four times since.

The repair keys the cache per `(game, date)` and sweeps it by **staleness** off the existing 1 s poll, so `readSnapshot` can only ever add. "No consumer count loops" is now a property of the shape rather than a number someone maintains — verified at 4, 16, 17, 32 and 128 consumers, plain and StrictMode, zero wrong records. An earlier revision used a **count bound of 16**; step 6 measured that bound+1 is not degradation but a crash, and that the guard pinned call-site *files* rather than mounts, so a month page reusing `day-card.tsx` (31 × 4 = 124) would have added no file, stayed green, and crashed. The bound is gone.

[**ADR-0056**](../adr/0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md) records the cache decision, the **late-completion collapse** (the archive publishes a `Conclusão tardia` under the hub's on-time word `Feito` — Fernando's call, reversible in one line), the distinct done/played accessible names, and the accent ring's gate.

**The chip costs 8px per card, and 8 is not arbitrary.** The kicker gains half the growth as leading on each side, so the card's rhythm terms are `24 + g/2` and `8 + g/2` — both on DESIGN.md's 4pt scale **only when `g ≡ 0 (mod 8)`**. 8 is the only multiple of 8 strictly between 0 and the 13px the plan originally shipped, so choosing it *dissolves* the scale exception rather than recording it. The dial (growth × clearance × rhythm) is in `DESIGN.md`; the next person should see the trade, not a constant.

---

## 2. New rules of the road

- **Cite symbols, not line numbers.** This is the session's most repeated finding — **five** rotted `file:line` citations on #96 alone, in living ADRs and source comments, each caused by the diff that shipped alongside them. The fifth was *mis-adjudicated as correct* in the PR body after the sweep had surfaced it, which is worse than missing it. Two independent agents arrived at the same fix when reviewers disagreed over whether a function was at `:915` or `:916`: cite `` `const MAX_DELTA_BYTES` `` or `` `function code(` ``, which cannot rot. **Any sweep for citation drift needs citation-shaped patterns** (`use-record-snapshot\.ts:[0-9]`) and must include `apps/web/test` — a round-2 sweep was blind to it and missed two live hits.
- **`docs/plans/` and `docs/handoffs/` are snapshot classes and are never rewritten**, so a rotted citation inside them is not a defect. Everywhere else it is.
- **A moved `main` produces an *absent* gate, not a red one.** When #112 merged mid-round, PR #113 went `DIRTY` and GitHub then ran **no `pull_request` workflow at all**. A missing check reads as "pending" and can be waited on forever. Merge `main` in, resolve, and the gate returns. Recorded in napkin item 10.
- **A firing `impeccable` scan exits 2.** Never chain the scans with `&&` — the first finding swallows the rest.
- **`impeccable`'s `undersized-ui-text` is structurally blind to `aria-hidden="true"`** (`EXEMPT_CONTEXT` in `checks.mjs`). The archive chip's 11px floor is held by DESIGN.md and review and by **nothing mechanical**. A comment claiming the detector gates it was measured false — with `aria-hidden=""` the rule fires on a 9px chip, with `="true"` (what React ships) it does not.
- **The `--no-config` positive control does nothing on a `file://` target.** The config's `low-contrast`/`cream-palette` ignores are URL-scoped to localhost/vercel, so nothing is suppressed and nothing can be un-suppressed. The working proof-of-life is that the configured run emits `cream-palette` while an empty fixture emits nothing at exit 0.
- **CI's `impeccable.yml` already scans a discovered archive day path at both viewports.** A plan claiming a local localhost run is "the only run producing the signal the repo gates on" was simply wrong, and the CI job is the pending-state evidence. Read **both** viewport steps individually.
- **`vi.setConfig` at module scope cannot leak across files** — the default forks pool with `isolate: true` gives every file its own PID. Proved by experiment, not inference.
- **Test-id frontier at `aa2fac2`**, re-derived numerically (`sort -u` is lexical and reports `S99` — the published command in `docs/agents/test-ids.md` is fixed but check it): next free **`T-CORE-S86` · `T-DB-S59` · `T-API-S109` · `T-WEB-S225` · `T-LINT-S47`**; highest in use S84 / S58 / S107 / **S222** / S46. Burned unspent: `T-CORE-S85`, `T-API-S108`, `T-WEB-S210`, `S211`, **`S223`, `S224`**, `T-LINT-S38`.
- **`docs/` numbering:** 042–047 are consumed. Next plan **049**, this handoff is **048**, next ADR **0057**.

---

## 3. Landmines

Everything in [038 §3](./038-handoff-31-merged-the-archive-is-live.md), [039 §3](./039-handoff-post-31-the-gate-moved.md) and [041 §3](./041-handoff-34-merged-sharing-is-live.md) stands **except the one retired below**. These are new.

1. **`TURBO_CONCURRENCY=1` is still required — and the chain that said so is now formally broken.** Handoffs 034 → 036 → 038 → 039 → 041 each say "all of the previous §3 stands", which re-ratified `TURBO_CONCURRENCY=1` across **eleven statements in eight handoffs**. #107 retired the *`testTimeout`* reason for it. **This handoff explicitly breaks that chain**: the workaround survives, but only because of **#114**, and it retires the moment #114 lands. Do not carry the old reasoning forward; carry #114.
2. **A timing-sensitive ticket cannot run parallel to anything.** #107's entire deliverable was a timing measurement, so #96's step 5 had to be serialised behind it. Two tickets sharing no file still share a CPU. Plan for that when pairing.
3. **An allocation held only in orchestrator context is invisible and will be corrected out of existence.** ADR **0055/0056** were assigned to #107/#96 at session start but never written into the repo. Three reviewers correctly found the reservation "unsourced", a fix round correctly dropped it, and #112 then shipped a PR body asserting `0056` was free while #96 had it committed. **Write pre-assignments into a commit on `main` before either branch starts**, or expect them to evaporate.
4. **`Closes #<n>` in a PR body auto-closes on merge, before any post-merge acceptance step can run.** `protect-main` is squash-only, so the body becomes the commit message. #112 would have closed #107 before Block C existed. Use `Refs #<n>` and close by hand; verify with `gh pr view <n> --json closingIssuesReferences` returning `[]`.
5. **The `pgrep` idle assertion matches its own wrapper shell** if the command string contains `vitest`. Filter it (`| grep -v <script>`), or the assertion never reads empty.
6. **Turbo terminates siblings on first failure**, so a package can print `[ELIFECYCLE] Test failed.` with zero failing tests, and a red run's per-test durations are all biased low because the other packages died early. Turbo's own `Failed:` line is the authority. This also makes before/after **elapsed wall clock** incomparable across a red/green boundary.

---

## 4. The pattern worth carrying forward

Handoff 041 §4 counted seven records falsified by the work that cleared them. **This session produced at least nine more**, so the pattern is not #34's — it is structural, and it now has a shape:

| where | what |
|---|---|
| #107 plan ×3 | an anchor asserted from a censored column; a napkin item's own rule falsified twice; "no ADR claims anything about turbo" contradicted by ADR-0017:21 |
| #107 plan | "nothing in the repo records CI's core count" — contradicted by a comment in a file the plan was editing |
| #96 plan ×2 | a diffstat pasted twice, wrong both times; a test baseline that counted the plan's own scratch probe |
| #96 PR ×5 | five rotted `file:line` citations, the last mis-adjudicated as correct **after the sweep surfaced it** |
| #113 PR | `impeccable` CI evidence pasted from the sibling PR's run |

**The generalisation:** a document's claims about *itself and its neighbours* rot faster than its claims about the code, because the code has tests and the prose has only a sweep — and every sweep has a pattern that misses a spelling.

Three mechanics actually worked, all cheap:

- **Cite symbols, not lines.** Removes the largest single class outright.
- **Run the sweep in both directions and never report a bare count.** *Every row has ≥1 hit, and every hit maps to a row.* Counts were wrong three times (28 vs 31, 12 vs 14, 21 vs 20 routes) while the mappings were right.
- **Verify recorded fixes against the tree, not against the fix report.** The step-7 verification pass caught something on **both** tickets that three step-6 reviewers had missed.

**And the finding that should change how the next session budgets its time:** *every substantive defect this session was found by running something.* The crash at bound+1; the `Maximum update depth exceeded` that invalidated the issue's own prescription; the anchor's four-session growth; `vi.setConfig`'s real semantics; `undersized-ui-text`'s blindness to `aria-hidden`; the `termo,termo` collision; a hardened grep that matched nothing because of ANSI codes. **Review-by-inspection caught records drift almost exclusively.** Weight step 6 toward reviewers instructed to *execute*, and fix records drift with a convention rather than a reviewer.

---

## 5. Open work, in the order it is likely to matter

`gh issue list --state open` returns **28**. The five that are new or changed:

| Issue | Why it might come first |
|---|---|
| [**#114**](https://github.com/fernandolisboa/miolos/issues/114) | **The unblocker.** `@miolos/db`'s PGlite `beforeAll` times out at default fan-out — 9 of 10 root runs on `main`. It blocks #107's closure, it is the only reason `TURBO_CONCURRENCY=1` still exists, and it is on the `hookTimeout` axis ADR-0055 declares unswept. `ready-for-agent`. **Strongest candidate for next.** |
| [**#107**](https://github.com/fernandolisboa/miolos/issues/107) | Merged but **open**. Owes only: #114 lands → Block C re-runs ten green on `main` → close by hand. Nothing to implement. |
| [#111](https://github.com/fernandolisboa/miolos/issues/111) | `content/termo/answers.csv:373` is literally `termo,termo`, and `T-API-S41` asserts a five-letter substring against a body containing game keys — **1 root run in 400**. The defect is the *assertion*, not the redaction; a structural check or a pinned draw fixes it. Small, and it also sits on AC1's instrument. |
| [#109](https://github.com/fernandolisboa/miolos/issues/109) | Three tests at or over #107's own 40 % trigger, left unfixed by design: sudoku `P1` (155 025/240 000), sudoku `P3 — weekday ramp` (24 114/60 000), `nonogram-screen.test.tsx:406` (2368/5000, no timeout in the file). |
| [#110](https://github.com/fernandolisboa/miolos/issues/110) | The concurrency cap, carrying every measured constraint so none is re-derived: turbo's `concurrency` key is global-only and breaks `turbo run dev`; the CLI flag beats the env var, so a flag baked into the script is **not** overridable; `--concurrency` twice is a hard error; the predicted CI cost is ~+55 %. It also inherits an ADR-0017 annotation and an ADR-0055 decision-2 rewrite. |
| [#96](https://github.com/fernandolisboa/miolos/issues/96) · [#103](https://github.com/fernandolisboa/miolos/issues/103) | #96 is **closed**. #103 (a share button on the archive's late-result panel) is now unblocked in a way it was not this morning: `use-record-snapshot` is repaired, so N consumers on one page are safe. |
| [#104](https://github.com/fernandolisboa/miolos/issues/104) · [#106](https://github.com/fernandolisboa/miolos/issues/106) | Unchanged. **#106 no longer conflicts with anything** — #107's wall-suite edits are merged, so it rebases cleanly onto `main`. |
| [#32](https://github.com/fernandolisboa/miolos/issues/32) · [#33](https://github.com/fernandolisboa/miolos/issues/33) · [#37](https://github.com/fernandolisboa/miolos/issues/37) | M3's remaining pillars and launch hardening. Unchanged. |

---

## 6. Pending on Fernando — and blocking nothing

Unchanged from [039 §6](./039-handoff-post-31-the-gate-moved.md): **attach activation** (`~/miolos-activate-attach.sh`, outside the repo, must run in a real terminal) and **the founder grant**, with `medal_grants` still empty.

**This session added nothing to that list, and answered four product questions in session:**

1. **`Feito` / `Jogado`** over `Concluído` / `Jogado` for the archive chip — reversible in one line, recorded as ADR-0056 decision 2 with the late-completion collapse stated honestly.
2. **Chip only, no time and no result figure** — the archive's own note already says it does not count toward times.
3. **The in-flow row over a corner stamp**, after a reviewer measured the stamp colliding with the kicker by 10 × 73 px and proved `impeccable` cannot see it (0.286 occlusion against a 0.45 threshold).
4. **An intermediate point on the growth dial** — +8px, which turned out to be the only value keeping the card's rhythm on the 4pt scale.

**One standing decision was also made:** *merge when the gate is green*, rather than holding each PR for review. Both PRs in this session were merged under it.

**A correction Fernando is owed, on the record:** the first framing of question 1 offered "`Concluído` / `Jogado`" as *"CONTEXT.md's canonical day verbs"*. `grep -c "Concluído" CONTEXT.md` → **0**. The glossary's rows are `Completion (on time) · Conclusão`, `Played · Jogado`, and — the one that mattered — `Late completion · Conclusão tardia`. Neither word offered was the glossary's archive term. The question was re-put with the real rows before anything shipped, and the answer held.
