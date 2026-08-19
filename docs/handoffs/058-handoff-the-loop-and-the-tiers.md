# Handoff 058 — the loop, the tiers, and the night the product moved again

**Point-in-time snapshot, 2026-08-19.** `main` at [`a8d7118`](https://github.com/fernandolisboa/miolos/commit/a8d7118). Not a living document.

This session began as ordinary ticket work on #109's successors and became a course correction. Fernando pushed back with a number rather than an opinion: of the eleven pull requests merged between 16 and 19 August, exactly **one** — [#113](https://github.com/fernandolisboa/miolos/pull/113), the archive done chip — contained product code. Everything below followed from that push-back. The process changed, the loop that produced the number was ended at its cost centre rather than at another wall, and five product tickets shipped in the same night.

---

## 1. Where things stand

| | state |
|---|---|
| **`main`** | [`a8d7118`](https://github.com/fernandolisboa/miolos/commit/a8d7118) — #83, cross-device day state |
| **Merged this session** | **Ten** pull requests, `370f1e1..a8d7118`: #127, #128, #129, #130, #131, #132, #133, #135, #136, #137. 74 files, +7 859 / −604. This handoff's own PR is the eleventh |
| **Open** | **#138** — plan 057, onboarding. Not a draft. Waiting on two answers from Fernando, both posted as a comment on **#35** |
| **Open issues** | **18**, down from **25** at the sweep's start |
| **Closed** | **Nine**: #123 (superseded, a filing error named), #76 (premise already false), #65 (duplicate of #66), #111, #63, #103, #67, #126, #83 |
| **Opened** | **#126** (filed, shipped and closed in the same session) and **#134** (`attach_prompt_dismissed_at` is not merged on account merge — a real defect in shipped code, Tier 1, unfixed) |
| **New ADRs** | **0058** (flows are tiered), **0059** (the property proof splits), **0060** (the day payload is server truth) — 60 ADRs, zero `Proposed` |
| **New plans** | `054` (the triage), `055` (#126), `056` (#83), `057` (#35, on the open #138) |

**#109 and #116 are not on that closed list.** They closed at 20:53 and 19:51 on 2026-08-18, in the session [handoff 053](./053-handoff-109-and-116-the-residuals-and-the-records.md) records. This session opened on their kickoff prompt.

Nothing is blocked on Fernando to *proceed*. Two things are **waiting** on him: #138's two questions, and #58's product decision. Four things are **shipped for veto**, in [PR #135](https://github.com/fernandolisboa/miolos/pull/135) — §8.

---

## 2. What this session actually was

### 2.1 The diagnosis, with its numbers

Five test-infrastructure tickets had been spawning each other — **#107 → #110 → #114 → #120 → #109 → #123** — and a sixth, #126, was about to. Every one of them **moved a wall**: timeout values (#107), turbo's fan-out cap (#114/#117), vitest's worker bound (#120), timeout values again (#109). **None of them touched the cost that kept hitting those walls.**

The cost, from four genuine gate rows (`32091557143`, `32195070489`, `32196991090`, `32198441929`, all `cache miss, executing`):

- `packages/games/test/sudoku/generate.test.ts` was **167–219 s**, i.e. **83–87 %** of `@miolos/games` on every run.
- Its three property tests were **96 %** of that file — `P1` alone runs `numRuns: 100` with two generations per run.
- **300 sudoku generations on every pull request.** The gate has no `paths:` filter, so a markdown-only pull request paid for all of them.

#123 was the reductio. It was filed to record a *conditional future observation* about the gate's shape, because a plan-review rule held that a landmine named in a snapshot must become a tracker entry. Applied mechanically to an observation with no action attached, that rule **manufactures tickets** — and #123 named nothing anyone could do. It was closed as superseded with that said in as many words.

The second symptom was #116: nine markdown status lines and one section of `docs/agents/domain.md`, run through all eight steps with roughly a dozen subagents, six of them parallel review lenses over a diff whose entire code surface was the string `Proposed` becoming `Accepted`.

**Neither is a failure of the eight steps. Both are the eight steps applied to work that was never their shape.**

### 2.2 The other three things Fernando raised, and where each landed

| He said | It landed as |
|---|---|
| WSL was crashing | The box lock, `~/miolos-session/gate-lock.sh` — §6.5. The most memory-intensive thing being done on the box **was the test-infrastructure investigation itself** |
| Why is a Termo test failing because the word *termo* is in the word list? | **#111**, fixed and closed — PR [#128](https://github.com/fernandolisboa/miolos/pull/128). `content/termo/answers.csv:373` is literally `termo,termo`, and the assertion required those five characters to be both present and absent in a body whose scaffolding is `{"games":{"termo":…}}`. 0.25 % false red per root run |
| Different flows for different kinds of work | **ADR-0058** and the two skills — §3 |
| The product frontier is not moving | The triage (`docs/plans/054`), then five product tickets in one night — §4 |

---

## 3. The tiers — [ADR-0058](../adr/0058-implementation-flows-are-tiered.md), shipped in [#127](https://github.com/fernandolisboa/miolos/pull/127)

`CLAUDE.md`'s *"Mandatory implementation flow (eight steps)"* became *"Implementation flows are tiered"*. **The operative copy is `CLAUDE.md`; the ADR records why.** Read the `CLAUDE.md` section, not this summary.

| The work | Tier | Flow |
|---|---|---|
| Typo, comment or doc correction, dependency bump, one-line test fix, records-only change | **0 — Just do it** | One agent: branch → change → gate → PR → merge |
| A real defect, ≲ 50 lines, no new decision and no new surface | **1 — Small fix** | Reproduce → fix → **one** correctness reviewer → gate → merge |
| A vertical slice, a new surface, a schema or contract change, anything needing an ADR | **2 — Feature slice** | The eight steps, **unchanged** |
| Architecture, or work whose shape is unclear | **3 — Foggy** | Find the shape, then Tier 2 on the pieces |

**The six rules.** Name the tier in the PR body *before* the work, where it is a claim a reader can check against the diff · *if a ticket's process artifacts outweigh its code diff, it was the wrong tier* · **no observation-only tickets** — a tracker entry needs an action, and observations go in `.claude/napkin.md` or as an ADR annotation · handoffs at session or milestone close, never per ticket · **escalation is always allowed, skipping is not**, and where two rows both fit, the heavier one wins · records work is Tier 0/1 by default.

**What makes the lighter tiers safe is that the mechanical gate binds identically at every tier.** The light tiers drop agents and documents; they never drop checks. `typecheck`, `lint`, `test`, the property floors, Zod at the boundaries, `impeccable detect` on UI and the pre-commit hook apply to a Tier 0 typo exactly as to a Tier 2 slice, and `--no-verify` stays forbidden. ADR-0058's Consequences state the price plainly rather than eliding it: what the gate cannot express is **unguarded at Tier 0 and guarded by one lens at Tier 1**, which is why Tier 0's row is a **closed list of change kinds** and not a size threshold.

Two skills make the tiers executable: **`.claude/skills/just-do-it/`** and **`.claude/skills/small-fix/`**. They live in the repo, versioned with the rules they implement, and both point at `CLAUDE.md`'s table rather than copying it. `small-fix` also carries the clause worth remembering: **Tier 1's single reviewer is mandatory even when the caller says "no review subagents"**, and Tier 1 owes the red-then-green pair pasted.

### 3.1 The tiers' first honest failure is this session's own

**#35's plan reached 1 796 lines for one dismissible onboarding card.** By rule 2 — artifacts outweigh the diff — that was the wrong weight, and no amount of the plan being *good* changes it. Two things are worth carrying forward rather than defending:

- The weight accumulated in the **review round**, not in the first draft. The review caught three blocking defects before any code existed (§4.5), and writing each one's measurement back into the plan is where the lines went. `~/miolos-session/35-step3-review.md` is 753 lines and `35-explore-identity.md` 455 on top of that.
- **That is not automatically a mistake.** Three blockers found before implementation is the flow working. But a Tier 2 plan document is not the only place they can be recorded, and 1 796 lines is a thing Fernando has to read.

The counter-example in the same session is **#103** ([#136](https://github.com/fernandolisboa/miolos/pull/136)), which ran Tier 2 at **reduced ceremony** — one plan *section* in the PR body instead of a plan document, two step-6 lenses instead of six — and **said so as a named deviation rather than dressing it as compliance**, because ADR-0058 puts *"no plan document"* on the Tier 0 and Tier 1 rows only. The adherence reviewer rejected the first wording of that paragraph, which is the deviation being *judged* rather than assumed. It was not free: both lenses returned a blocker and both were real (§4.4).

---

## 4. What shipped as product — because that was the point

### 4.1 #63 — the running clock stops shifting ([#130](https://github.com/fernandolisboa/miolos/pull/130), `0069ca5`, Tier 1)

Fraunces responds to **no OpenType feature tag at all** — `tnum` is a byte-identical no-op on it, while its `wght`/`opsz` axes are live, which is the positive control saying the file loads. So `font-variant-numeric: tabular-nums` on `var(--font-display)` asked for something the face cannot deliver, and the clock physically moved **≈6.1 px per digit at 30 px, on every tick**, on six play screens. `.timerBar` and `.timerCard` move to `var(--font-ui)`; **two changed lines is the whole fix.**

**The sweep found no third defective site, and that is the useful half.** Every stats readout — `/estatisticas`'s six classes and the conclusion's stat block — was **already** on the UI face and already correct. Four Fraunces + tabular pairings are **left deliberately** and allow-listed with a reason each (`.stampTime` is a frozen value; the Sudoku and Binairo cells are one centred glyph; `.streakNumeral` is decision 2's own example). Pinned by `T-WEB-S230`, whose scan **walks every stylesheet** under `apps/web` rather than reading a hand-maintained list, and resolves the token indirection (`.streakNumeral` reaches Fraunces via `font: var(--text-numeral-lg)` and never names `--font-display`).

### 4.2 #67 — the hint button's tab position ([#133](https://github.com/fernandolisboa/miolos/pull/133), `3f1e86f`, Tier 1)

**The issue's framing was wrong and the correction is the finding.** It called this *"essentially one CSS edit"*. It cannot be: **no CSS property reorders sequential focus navigation** in the browsers this app ships to. `order` and `grid-area` move the paint and leave the tab sequence exactly where it was — they are the *cause* of this bug class, not a cure. (`reading-flow: grid-order` would do it and is Chromium-only, so it would fix one engine and leave the others — a new decision, therefore not Tier 1.)

So the **node moved and zero CSS changed**. `screen.module.css` places every child of `.page` by named grid area, which decouples paint order from DOM order completely; the hint was tab stop **2 of 36** with the whole board behind it. Moving it after `<section class="board">` in both branches of each view makes the two orders agree in **both** layout bands, and paint is byte-identical because nothing is auto-placed.

**Six screens, not three.** Free play has consumed the same sheet since #28 and the issue never mentions it: `/binairo`, `/sudoku`, `/nonogram` plus the three `/modo-livre/*`. `/termo` is the seventh consumer and a genuine control — it ships no hint at all (ADR-0045), so its focus order was already right. `T-WEB-S231`'s 14 assertions are driven by **which screens actually render a hint**, not by a route list, so a fifth game inherits the fixed version.

### 4.3 #103 — a share button on the archive's late-result panel ([#136](https://github.com/fernandolisboa/miolos/pull/136), `ae5c02a`, Tier 2, reduced ceremony)

**The decision this ticket owned: a late share says exactly what an on-time share says. Byte for byte, on all four games.** `T-WEB-S231` asserts it as an *identity* against `ConclusionView`'s own output rather than against a description of it.

The reasoning is worth keeping because it will be re-asked. A late share carries no claim about *when* it was solved — it could not, because `sync.ts` parses and **discards** `onTime`, so no client surface in this app holds the fact. The date it carries is the **puzzle's** date, which ADR-0054 decision 3 explicitly admits. And a locally judged outcome cannot differ from a server-recorded one because `acceptResponse` discards `completionResponseSchema.outcome` too — there is no server-recorded result line for a second version to be keyed on.

`ShareButton` was **extracted** from `conclusion-view.tsx` into `src/play/share-button.tsx` rather than copied — `deliverShare`'s realm-independent `AbortError` test is the subtle part, and a second hand-written copy is how two screens drift. Its CSS moved byte-unmoved into its own module so the archive does not inherit ~1 400 lines of the conclusion's sheet. `T-WEB-S183`'s ban on `conclusion-view` in the archive's module graph is neither widened nor routed around.

### 4.4 #83 — cross-device day state ([#135](https://github.com/fernandolisboa/miolos/pull/135), `a8d7118`, Tier 2, full eight steps) → [ADR-0060](../adr/0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md)

The hub and the conclusion used to answer *"what has **this device** done today"*. They now answer *"what has **the user** done today, as far as this device and the server together know"*.

**`GET /day`** is a line-for-line clone of the `GET /streak` authenticated-read template — **no request parameters at all**, the day being the DB clock's own São Paulo today, 401 `no-session` for a cookieless caller, `Cache-Control: no-store` and the CORS grant on all three branches, Zod parse before `Response.json`. `listCompletionsForDay` projects exactly three columns on the existing index; **no migration**. Five hub consumers cost one credentialed GET through a module-level `day-truth` store.

**The merge invariant, which is the whole decision in one line:**

```ts
merged[game] = server[game] === "pending" ? local[game] : server[game];
```

> The server **makes a claim** exactly when its status is not `pending`; `pending` is the *absence of a counted completion* and therefore the absence of a claim, **never a denial**. Where the server claims, its claim is the day state; where it does not, the device's is. Nothing is blended field by field and no third value is ever synthesised.

…with the precondition that **the payload is discarded in full unless `payload.date === date`**. A payload for another day is not weaker evidence, it is evidence about a different question — and that is also the rollover mechanism.

It is **not** "the stronger verb wins". The one demotion is `completed → played` (won here, lost on another device), which is a *weaker* claim and therefore the direction ADR-0031 decision 2 permits, and it is a **correction**: the completion row is write-once, the day genuinely does not count, and `completedCount` would otherwise disagree with `/streak`'s `todayCounts`. Its mirror is the promotion, from the same one line.

ADR-0060 **amends ADR-0031 decisions 1 and 2 and consequence (d)**, and **discharges** ADR-0048's deferral. Thirteen prose sites were falsified and fixed — the plan inventoried nine and **step 6's ADR lens found four more**, two of which were self-contradicting *within this branch*.

### 4.5 #35 — the plan only, on the open [#138](https://github.com/fernandolisboa/miolos/pull/138)

No code. The plan is `docs/plans/057-issue-35-plan-onboarding.md` and the two questions it still owes are Fernando's, posted as a comment on **#35** so he can answer from a phone: **placement** (confirm *below* the game cards) and **the five pt-BR strings**, including *"horário de São Paulo"* vs *"horário de Brasília"*.

**What the review round caught before any code existed** — all three fixed in the plan:

1. The card was placed **above** the game cards. It materialises after hydration and two sequential round trips, so it would have shifted all four *Jogar hoje* links down ~320 px at the one moment a first-time player is reaching for one. `HubAttach` sits after the cards for exactly this reason.
2. **The mobile slack figure was wrong twice** — the plan claimed ~250 px, the reviewer hand-summed ~188, and headless Chrome at 390×844 measured **162.5 px**. That retired the whole "make it fit above the fold" line of thinking: no version fits, so placement carries the decision instead of height.
3. **The mobile visual gate was vacuous.** It asserted that `first-viewport-column-overflow` does not fire — a rule that needs two side-by-side columns and is *structurally incapable* of firing on the stacked mobile hub at any card height.

Two findings about **shipped** code came out of the same pass. On a genuinely first visit there is **no `users` row yet** — `ensureSession()` mints it post-hydration, so a mount-effect fetch copied from `useAttachState` races that mint into a 401 on precisely the visit the feature exists for, and **four sibling hooks share the shape**. And `attach_prompt_dismissed_at` is not merged at all, which is **#134**.

---

## 5. The infrastructure ticket that ended the loop — #126, [ADR-0059](../adr/0059-the-property-proof-splits-from-the-per-pr-gate.md), [#131](https://github.com/fernandolisboa/miolos/pull/131)

Not another wall. **The proof splits in two, and both halves are named.**

| | run count | where |
|---|---|---|
| **the full proof** | ADR-0023's floor, unchanged — 100, 100, 35 | `.github/workflows/properties.yml`, nightly `schedule` + `workflow_dispatch`, `MIOLOS_FULL_PROPERTIES=1` |
| **the per-PR sample** | `PR_GATE_RUNS = 25` | the `gate` job, pre-commit, every local `pnpm test` |

**ADR-0023's floor is not lowered.** ADR-0059 narrows **where** it binds, never **whether**. A green gate is no longer the full proof and says so in three places. The mechanism is one env var read at module scope (`packages/games/test/property-runs.ts`), because ADR-0017 forbids a `vitest.config.ts` in `packages/games` and `T-WEB-S229` guards that; it lives in `test/`, never `src/`, so `process.env` never enters the purity program; it uses `Math.min` so routing a cheaper property through it can never *raise* cost, and `=== "1"` so it fails closed to the cheap sample.

**25 is sized, not chosen.** Full weekday coverage on the pinned `FC_SEED = 220_022` first arrives at **21** runs — 20 never draws Sunday, the hardest tier — and the reduced sample is a strict **prefix** of the full one, not a different 25. Lowering `PR_GATE_RUNS` below 21 goes **red**, by design. The anti-vacuity control is the proof: a Sunday-only tier-5 regression is red at 25 on run 21, and **invisible at 20**.

### 5.1 The measured result, with the caveat the ticket itself insisted on

Against a contemporaneous baseline taken the same night on an unmodified branch (gate `32215457131` → `32221308441`):

| | before | after | Δ |
|---|---:|---:|---:|
| `test/sudoku/generate.test.ts` | 233 153 ms | **102 758 ms** | **−56 %** |
| `@miolos/games` package | 273.74 s | **157.04 s** | **−43 %** |
| `pnpm test` step | 5m05.8 | 4m43.8 | −7 % |

**`@miolos/games` is not the gate's critical path, and quoting the step figure as the win is reading the wrong column.** Six suites run concurrently on 2 vCPUs, and the last finisher is **`@miolos/web`** — 279.08 s after the change, still 122 s behind games. The step's wall clock is a **makespan**, so removing games' CPU demand **frees share** for `web` and `api` (`api` 246.67 → 227.36 s, `web` 301.48 → 279.08 s) rather than subtracting its own wall time. The ticket's metric is the package; the step figure is a second, weaker reading. Two untouched files went the *other* way (`grade.test.ts` 17 675 → 20 428 ms, `binairo/generate.test.ts` 7 294 → 10 694 ms) — the same CPU-share effect, in the direction that costs — and they are recorded rather than hidden.

The nightly opens or bumps an issue labelled **`property-alert`** on failure *and on cancellation*, because a 30-minute hang is exactly the silent failure this guards and `if: failure()` alone would not catch it. **That label is repository state, created with the ticket**, and it is recorded in ADR-0059 because it cannot appear in a diff.

---

## 6. The durable findings

### 6.1 A timeout figure means nothing without naming its axis — now demonstrated, not inferred

The nightly runs the **same 100-run floor** the old per-PR gate ran. `P1` costs **30.8 s** there (34 522 ms on the `workflow_dispatch` confirmation run `32221990276`) against **105 000–155 000 ms** across nine shared-gate rows on a **byte-identical generator**. The only difference is that `properties.yml` runs `packages/games` **alone** — `Tasks: 1 successful, 1 total` — while the gate ran it beside five sibling suites on the same two vCPUs.

That is a clean **3.4–5× spread on identical work**, with the contended and uncontended cases minutes apart. #109 *inferred* this mechanism from historical gate rows; this run **demonstrates** it directly. The consequence for anyone reading a sudoku timeout: **the 625 000 ms ceiling #109 derived is sized against the contended figure**, and the nightly's uncontended run has roughly 20× headroom under it. Neither number is wrong. They measure different worlds, which is exactly why ADR-0055 decision 2 insists on naming the axis a figure came from.

The unpredicted result, and it is the good one: **the full proof is now cheaper in wall time than the reduced sample was on the shared gate** — 60 999 ms alone at the floor, against 102 758 ms at 25 runs beside five siblings and 233 153 ms at the floor beside them. Moving the proof off the shared path made *the proof itself* ~3.8× cheaper.

### 6.2 The test-id frontier's structural limit — re-deriving prevents a *stale* allocation and **cannot** prevent a *concurrent* one

**Four tickets collided on one `T-WEB` row in one night, and every one of them had re-derived the frontier correctly first.** #63 took `S230`, #103 took `S231`, #67 took `S232`, #126 took `S233` — and #126's id **was renumbered three times before it landed** (`S230` → `S231` → `S232` → `S233`), each renumber caught by the documented grep. #83's reserved range shifted three times for the same reason, ending at `S234…S246`.

**This is the row's structural limit, not an agent's mistake.** The frontier records what has **landed**; parallel branches are by definition what has not. Two branches reading the same row hours apart are both right, and the row cannot tell either one about the other.

**The mitigation, now twice-earned and written into `docs/agents/test-ids.md`: reserve the id on `main` (or on the issue) before step 5 — not in the pull request that spends it.** Nothing is burned by any of it: `S230` #63, `S231` #103, `S232` #67, `S233` #126, `S234…S246` #83, contiguous. Current frontier: `T-CORE` `S98` · `T-DB` `S62` · `T-API` `S117` · `T-WEB` `S247` · `T-LINT` `S49`.

Two sub-rules the same night confirmed: a **Tier 0/1 ticket has no plan document to write a reservation paragraph in**, so it records the allocation in `docs/agents/test-ids.md` at commit time instead (#63's precedent); and **widening an existing claim takes no new id** — `T-LINT-S39`/`S40` gained probes in place under the `T-DB-9a` precedent, so `T-LINT-S47` was still next free.

### 6.3 A conflicting PR produces **no** `pull_request` gate run at all, and CI silence reads exactly like a queue delay

`main` moved four commits under #126's branch and the gate **wedged**: `mergeable=UNKNOWN`, GitHub could not build the merge ref, and run `32215932736` sat **queued for 70 minutes** while newer runs on other branches started and finished around it. It looks identical to a runner backlog from the outside.

**Diagnose before re-pushing:**

```
gh pr view <n> --json mergeable,mergeStateStatus
```

`DIRTY` or `UNKNOWN` means the merge ref is the problem, not the queue. Fix with `git merge origin/main`; it started on the first try. This is the #113 class from the napkin, one step milder — an *absent* gate there, a *stuck* one here, same cause and same fix.

### 6.4 Sub-agent reports are written to disk **before** being returned, never only composed

Carried forward from handoff 053 §3.4 and re-earned here. Two of #109's step-6 reviews died to credit exhaustion **after** writing their files to `~/miolos-session/` — nothing was lost. Earlier, a five-agent batch was killed by a process restart and **did** lose its work, because those agents had only composed final messages.

**Every sub-agent whose output is worth more than a minute writes it to a file under `~/miolos-session/` as its first substantive act, and its final message is a pointer plus a summary.** The cost is one `Write`; the alternative is re-running a review round. This session's artifacts are all on disk — 3 757 lines across nine review and explore files, listed in §9.

### 6.5 The box lock, and the honest admission underneath it

`~/miolos-session/gate-lock.sh` serialises full-suite runs across parallel agent worktrees, because parallel worktrees were the thing crashing WSL:

```
~/miolos-session/gate-lock.sh acquire "<who>"   # blocks, polls 15 s, times out at 60 min
~/miolos-session/gate-lock.sh release
~/miolos-session/gate-lock.sh status
```

**A capped suite peaks at roughly 6.3 GB on a 16 GB box; the uncapped path peaks at 11 629 MB** (ADR-0057 decision 3). Two suites at once does not fit, and `git commit` runs one through the pre-commit hook — so **the lock is taken before any command that runs a suite, `git commit` included**, and released after.

**Say the uncomfortable part plainly: the most memory-intensive thing being done on that box was the test-infrastructure investigation itself.** The suite is not what was destabilising WSL in normal use — running two or three of them concurrently, to measure the suite, was.

---

## 7. What to read first, in order

1. **`CLAUDE.md` § *Implementation flows are tiered*** — the routing table and the six rules. This is the operative copy; [ADR-0058](../adr/0058-implementation-flows-are-tiered.md) is why, and its Consequences section is where the honest cost is stated.
2. **`.claude/skills/just-do-it/SKILL.md` and `.claude/skills/small-fix/SKILL.md`** — the two light tiers as checklists.
3. **[`docs/plans/054-triage-the-open-tracker.md`](../plans/054-triage-the-open-tracker.md)** — all 25 then-open issues read against the tree, tiered, with per-issue validity checks. §10's recommended order comes from here, and the per-issue detail sections (#58, #78, #106, #111, #65/#66, #67/#61, #62/#63/#66, #13, #104/#64/#51, #126) are the reasoning behind every recommendation.
4. **[ADR-0060](../adr/0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md)**, then **[PR #135's body](https://github.com/fernandolisboa/miolos/pull/135)** — the merge invariant, the nine-pair table evaluated against the shipped code, the four decisions for veto, and the thirteen falsified prose sites.
5. **[ADR-0059](../adr/0059-the-property-proof-splits-from-the-per-pr-gate.md)** — and specifically its Consequences, which are where the makespan caveat and the redundancy finding live.
6. **[`docs/agents/test-ids.md`](../agents/test-ids.md)**, the frontier table and the four allocation paragraphs beneath it — §6.2 in full, at the site that governs it.
7. **`.claude/napkin.md`** — curated at [#137](https://github.com/fernandolisboa/miolos/pull/137). Six entries earned tonight, including the frontier's structural limit, `--force` being a **turbo** flag (so `pnpm lint --force` is an error, the root `lint` being a bare `eslint`), and `noUncheckedIndexedAccess` rejecting array-destructuring of regex match groups.

---

## 8. Landmines

**Carried forward, still live:**

- **Read any sudoku gate line against `312 500` and `50 000`.** The four in-file timeouts #109 adjudicated are **deliberately not re-derived** by ADR-0059, because re-deriving a ceiling in the same change that moves its anchor is the loop #126 exists to end. The follow-up has its arithmetic written down: **once three genuine gate rows exist under the reduced sample**, pool their maxima and apply ADR-0055 decision 2 (anchor × 4, rounded to the next 5 000 ms) to `P1`, `P2` and the `P3` ramp **together, in one sweep**, with decision 1's 40 % trigger read first. **Not before three rows** — a single post-merge row is not a pooled maximum.
- **A recorded maximum is a *sample* maximum.** A later run above it is the estimator working, not a falsified record; it owes an update only when it crosses the stated trigger.
- **The worktree trap on `gh pr merge --delete-branch`** — the GitHub merge succeeds, the local checkout step aborts, the remote branch survives. Merge from the main worktree, or verify with `gh pr view --json state,mergeCommit` afterwards.
- **`grep -c timeout apps/web/test/nonogram-screen.test.tsx` is `1`, and that hit is the comment's own word.** The absence of a timeout on `T-WEB-S43` is a shipped verdict. Do not "fix" it.

**New, from #83 — the four decisions shipped for veto** (all in [PR #135](https://github.com/fernandolisboa/miolos/pull/135), each product-visible, none blocking, each reversing cheaply; I proceeded under the stated assumption and Fernando has vetoed none):

1. **A game completed on another device shows `Feito` with no time.** The payload carries no duration. *Adding `elapsedMs` to the wire is one field and one test.*
2. **Termo, both directions of one rule — answer them together.** Demotion: won here, lost elsewhere → the tile flips `Feito` → `Jogado` a moment after the page settles and `X de 4` drops by one. Promotion: lost here, won elsewhere → `Feito` with `em 4/6`, and tapping it restores **this device's loss screen**. The alternative (*"`played` wins whenever either side says `played`"*) buys a consistent Termo tile at the price of the hub disagreeing with `/streak`. **One line in `mergeDayStatus` either way.**
3. **A cross-device `Feito` tile links to a PLAYABLE board, in all four games.** The conclusion swap reads the *local* record and cross-device there is none. This is ADR-0053 decision 10 layer 3's *"honest gap"*, reached from the daily hub for the first time; the replay writes nothing. **Asserted rather than assumed** — `T-WEB-S245` proves the tile keeps its `href`, that `localStorage` holds no record for it, and that the screen behind it renders `[data-play-state="playing"]` with no conclusion stamp.
4. **An already-open, already-focused tab never updates on its own.** Refresh fires on mount, remount, `visibilitychange`, `focus` and `online` — **there is no interval**. A second monitor left sitting on the hub is exactly the case that misses. The successor is a poll or a push, and the trigger for revisiting is a complaint, not a schedule.

**New, other:**

- **#134 is a live defect in shipped code, unfixed.** `packages/db/src/merge.ts` has no statement for `attachPromptDismissedAt`, so dismissing the attach prompt on device A and merging from device B **brings the prompt back**. ADR-0050 decision 9's "one lifecycle per account" does not survive the merge it is supposed to survive. Tier 1, roughly five lines — one `least()` update in statement 5b's idiom, guarded `is not null` + strict `<` so a re-run matches zero rows and `T-DB-S20`'s double-run snapshot stays green. **Plan 057 folds this column into #35's own merge statement, so #35 may close it**; if #35 takes its stated fallback, #134 carries the fix standalone.
- **#35 cannot be seen on a Vercel preview.** Every credentialed call is anonymous on `*.vercel.app` (ADR-0048: `Lax` + the public suffix list), so the card's state endpoint answers 401 there and the card never renders. **CI's `impeccable detect` cannot see it either.** Its gate has to be a static fixture at both viewports plus screenshots in the PR.
- **#66 must not be picked up as "a small perf fix."** Its own body says *do not act on this without evidence*, and the evidence needs a Chrome trace on a throttled CPU, not a jsdom count. If the trace is clean, the correct outcome is to close it.
- **#61 is real but is a rewrite**, not a small fix — it replaces a shipped board's whole focus model. Its one non-negotiable: adopt `onStrokeEnd`, do not derive a second mechanism.
- **#64 costs the markup-substring tripwire** (ADR-0033 consequence (d)) that currently proves `@miolos/games/nonogram` tree-shakes out of `apps/web`. That is a trade, not a task.

---

## 9. Environment gotchas

- **Node is nvm-managed.** Prefix: `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`.
- **Take the box lock before anything that runs a suite, `git commit` included** — §6.5. `--no-verify` is never the answer.
- **`--force` is a *turbo* flag.** The root `lint` script is a bare `eslint`, so `pnpm lint --force` is an **error**. `pnpm typecheck --force` and `pnpm test --force` are fine and are what proves a run is an execution rather than a cache replay.
- **Read a gate figure only from a package line that says `cache miss, executing`.** `cache hit, replaying logs` reproduces an old figure byte-for-byte, epoch stamps included.
- **`gh run view --log` carries the literal three characters `^[[` for colour codes, not an escape byte.** Use `perl -pe 's/\^\[\[[0-9;]*m//g'` on `gh` logs; the `\x1b` form is right for local logs only.
- **This session's artifacts are at `~/miolos-session/`** — `35-explore-identity.md`, `35-step3-review.md`, `83-step3-review.md`, `83-step6-correctness.md`, `83-step6-security-adr.md`, `63-tier1-correctness-review.md`, `67-tier1-correctness-review.md`, `103-step6-correctness.md`, `103-step6-adherence.md`, plus #126's probes, logs and gate captures. Outside the repo, untracked, durable across a WSL reboot in a way `/tmp` is not.
- **The `property-alert` label exists** and `gh issue create --label` fails outright against a label that does not exist. It is repository state, not diff state.

---

## 10. Exit criteria for the next session

**Nothing is owed before starting new work.** Every merged ticket's records are in the tree. Three things want Fernando, and none of them blocks picking something up.

1. **#138 needs two answers** — placement (*below*, recommended) and the five pt-BR strings. Both are on **#35** as a comment. Implementation of #35 starts when they land.
2. **#58 needs a product decision, and it is two sentences.** A player who solves offline at 23:58 and reconnects at 00:05 has their completion stamped with the *server's* write instant, so it derives as **late** and the streak breaks — because letting the client assert its own finish time would put the device clock into streak arithmetic, which `CLAUDE.md` forbids outright. **Fernando chooses:** accept that window, amend #18's *"a connection drop mid-puzzle never costs the day"* wording and record it as an ADR-0026 consequence — which is what ships today; **or** close it server-side without trusting the client clock, by deriving `on_time` against a bounded grace period (one SQL expression in `packages/db/src/completions.ts` plus its tests, **no migration, no client change**), which also amends ADR-0008's definition of on-time. Cheap to defer and cheap to change later: the schema, the route and the client are identical under both. It blocks nothing.
3. **#134 is a Tier 1 fix** — §8. Roughly five lines, or absorbed by #35.

**The recommended order is in [`docs/plans/054`](../plans/054-triage-the-open-tracker.md), and its two load-bearing calls:**

- **#32 (streak-at-risk notifications) is Tier 3 and gates most of what is left.** Its acceptance criteria are written, but *"the player's habitual play window"* has **no schema, no scheduler and no data model anywhere in the tree**. Run the fog-clearing session first; it also unblocks #33 and #36 (whose blocking edges are **soft** — four fifths of #33's events and all of #36's palette work are independent of it).
- **#35 is the clean vertical slice to prove the tiered flow on**, and it is unblocked today. Its only blocker (#27) closed on 2026-08-13.
- **#78's checker is recommended *against*.** The drift is worse than filed — ~85–95 stale citations, not ~20 — but ADRs **0046–0057 carry four line citations between them**, because handoff 048 §4 already changed the convention to *cite symbols, not lines*. A checker would police a form the repo has stopped writing, over a corpus that is not growing, while needing enough grammar to tolerate ADR-0029's legitimately-historical Context and ADR-0043's deliberate as-of-writing annotation. **Rescope it to Tier 0**: write *"cite symbols, not lines"* into `docs/agents/domain.md`, where agents actually read it — today it exists only in a handoff, which makes it folklore. The optional Tier 1 half is one annotation-preserving *form* conversion of ADRs 0038–0044, which buys forever rather than six months.

**Two things not to do.** Do not re-derive the sudoku budgets before three genuine post-#126 gate rows exist (§8). Do not file another test-infrastructure ticket — ADR-0058 rule 3, and #126 was explicitly the last one in that chain: *if its implementation surfaces a further test-infra defect, that defect is Tier 0 or Tier 1 and gets fixed in the same PR.*

---

## 11. Kickoff prompt for the next session

```
Read docs/handoffs/058-handoff-the-loop-and-the-tiers.md and go from there.

PREFLIGHT — assert before doing anything else:
  - `git log -1 --format=%h` on main is a8d7118 or later
  - #83, #103, #63, #67, #111, #126, #123, #76, #65 all CLOSED
  - #35 OPEN, #58 OPEN (ready-for-human), #134 OPEN (bug), #32 OPEN
  - PR #138 is OPEN and not a draft
  - `gh issue list --state open | wc -l` is 18
If any of that does not match, STOP and read the newest addendum at the bottom
of that handoff before acting on anything in this prompt.

State: last session was a course correction, not a feature session. Flows are
now TIERED — read CLAUDE.md § "Implementation flows are tiered" and route every
piece of work through it BEFORE starting. Tier 0 = just-do-it skill, Tier 1 =
small-fix skill (one correctness reviewer, mandatory, plus a pasted red-then-
green pair), Tier 2 = the eight steps unchanged, Tier 3 = clear the fog first.
The mechanical gate binds identically at every tier; that is what makes the
light tiers safe. --no-verify is still forbidden.

Three things want you, none of them blocking:
  1. #138 (onboarding plan) needs two answers — placement and the five pt-BR
     strings. Both questions are a comment on issue #35. I have not answered.
  2. #58 is a product decision only I can make. Two options, both cheap, both
     stated in §10 of the handoff.
  3. Four decisions from #83 are shipped FOR VETO, not for approval, listed
     with their alternatives in PR #135. I have vetoed none, so they stand.

Pick up the frontier. The triage in docs/plans/054 is current: #32 is Tier 3
and its fog-clearing session gates most of what is left in M3/M4; #35 is the
clean vertical slice to prove the tiered flow on and is unblocked today; #134
is a five-line Tier 1. Do NOT build #78's checker — rescope it to the Tier 0
convention note, for the reason in §10.

Three rules to internalise before touching anything:
  - A timeout figure means nothing without naming its axis. The nightly runs
    the SAME 100-run floor in 30.8 s that the shared gate ran in 105–155 s,
    because it runs packages/games alone. Do not re-derive the sudoku budgets
    until three genuine post-#126 gate rows exist to pool.
  - Reserve a test id on main BEFORE step 5, not in the PR that spends it.
    Four tickets collided on one T-WEB row in one night and every one of them
    had re-derived the frontier correctly first. Current: T-WEB next free S247.
  - Take ~/miolos-session/gate-lock.sh before ANY command that runs a suite,
    git commit included, and release after. A capped suite is ~6.3 GB on a
    16 GB box; two at once is what was crashing WSL.

And one process rule: every sub-agent writes its report to a file under
~/miolos-session/ before returning it.
```
