# Implementation plan — Issue #96: the archive day page's per-game done chip

**Revision 4 — the last planning revision. The next step is 5, implement.** Worktree `/home/ferna/projects/miolos-wt/96`, branch `feat/96-archive-done-chip`, base `main` at `eea445e`. Step 4 of CLAUDE.md's eight-step flow, revising the plan in place for the third time: round 1's five-lens review returned **5 × REJECT** (revision 2 answered it), round 2's three-lens review returned **3 × REJECT** (revision 3 answered it), and round 3's two-lens review returned **2 × REJECT** confined to §9–§12 and to the plan's bookkeeping — the design is settled and is not reopened by this revision.

The findings are `docs/plans/046-issue-96-research-review-round-1-findings.md` and `docs/plans/047-issue-96-research-review-round-2-findings.md`, both untouched and neither restated here. Round 3's findings are answered in §0.3 and in the body; this plan is the answer to all three rounds.

**Revision 4's rule, stated once because it governs several of the edits below: where a claim kept failing re-measurement, it is replaced with the weaker claim that survives every measurement, not with a sharper number that will be wrong again.**

Structural template: `docs/plans/040-issue-34-plan-sharing.md`, including its §14 deviation-log convention.

---

## 0. What revision 2 changed, what revisions 3 and 4 change, and why

### 0.1 Revision 2's two moves, which stand

Two things moved the plan's centre of gravity at revision 2. Round 2 measured both and could not break either, so both stand unchanged.

**(1) The plan no longer routes around `useRecordSnapshot`. It repairs it.** Round-1 finding S1 said the cheaper alternative had never been weighed. It has now been *measured* (§2.2): keying the hook's module-level cache by `` `${game}|${date}` `` in a bounded `Map` is **never larger than the code it replaces — between 0 and 5 lines smaller, depending on the eviction guard's shape** — and it makes four per-card consumers stable, fixes finding F3's two-dates defect in the same stroke, and lets `day-card.tsx` call `useRecordSnapshot(game, date)` directly, which is what issue #96 prescribes. Revision 1's answer was a ~50-line parallel projection plus a cross-check test plus two ADR decisions. That is withdrawn.

**(2) The chip is an in-flow row beside the kicker, not an absolute corner stamp.** Fernando's call, taking round-1 finding D-03: the sheet's own `.rowLink` idiom (`apps/web/app/arquivo/arquivo.module.css:135-143` — `display:flex; justify-content:space-between; align-items:center`). This dissolves findings D-01, D-02, D-04, D-05 and D-13 outright: no reserve constant to guess, no overlap with `.tape` or `.cardTitle` at any width, no `text-occlusion` exposure, zero CLS without leaving flow. It costs **13px** of card height in both states, permanently — measured, `288 × 104 → 288 × 117` at 1440×900. That cost is stated rather than argued away (§3 D6).

Fernando also settled the wording (§5): **`Feito` / `Jogado` stay**, and the on-time/late collapse finding B2 exposed is recorded as an explicit ADR-0056 decision rather than defended on a false reading of `CONTEXT.md`.

### 0.2 What revision 3 changes

Nothing in the shape. Round 2's three reviewers each said the design is right and each rejected the plan anyway, for one reason: **the plan's numbers, guards and citations did not survive being measured.** Revision 3 is that repair, and it is worth naming the pattern rather than only the instances — every one of these came from a figure carried forward from a tree or a fixture the plan itself had already declared invalid, which is exactly what handoff 041 §4 exists to catch.

1. **Numbers that were wrong, now measured.** The repair's diffstat is not net −2 (§2.2) — and revision 4 retracts revision 3's replacement figure too: see §0.3. The suite baseline is **75 files / 1102 tests**, not 76/1106 — the extra file was the plan's own probe, which the plan says it reverted (§2.2, D9, §12). The card is **288 × 104 → 288 × 117**, +13px and **+12.5%**, not `95 → 108` (D6, §5 decision 3). The chip's used box is **23px** desktop and **21px** mobile, because Blink floors a 1.5px border to 1px (D6). D6's clearance arithmetic is replaced with browser figures throughout.
2. **Guards that did not guard what the plan said they guarded** — `T-WEB-S214`'s static floor, `T-WEB-S215`'s agreement-invariance, `T-WEB-S222`'s single-literal tautology, `T-WEB-S221`'s blindness to the mobile block and to `line-height`. Each is sharpened in D9 and §4, or the claim it backed is deleted. A plan does not get to promise a net nobody has.
3. **Two records repaired rather than dismissed.** §1's non-goal on `day-state.ts` gains an explicit **one-comment-sentence carve-out** (R2-B4), because the repair falsifies a cross-reference there and leaving a knowingly-false sentence on `main` is worse than the carve-out. `apps/web/test` joins §7.1's scope, which is where two of the four missed hits lived.
4. **The accessible name stops collapsing `Feito` and `Jogado`** (D3, R2-M3). This is not a new product question: it is D2's own argument — *"a false done would be a lie the player can catch"* — applied to the one channel where the player **cannot** catch it.
5. **`impeccable`'s positive controls are replaced with ones that work** (§11). `--no-config` on a `file://` target was measured byte-identical to the configured run: it un-suppresses nothing, so it could not tell a scanned page from an empty one.
6. **The ring enumeration becomes a scan instead of a list of literals** (D4, R2-M10, m-13), with the fourth ring's real figures computed on **desk** paper.

### 0.3 What revision 4 changes

Round 3 ran two lenses — delta verification and implementation readiness — and both rejected. Neither touched the design: the `Map` repair, the in-flow row, `Feito`/`Jogado`, chip-only-no-time and the four-ring scan are settled, independently verified and **not reopened**. What both lenses found is that **§9–§12 were not executable** and that three claims in the body were still stronger than their evidence. Revision 4 is that repair, and it is the last one — the next step is implement.

**The five things that stopped step 5, now fixed.**

1. **§11's `impeccable` procedure could not be run** — a config with no body, a fixture test with no legal home, and a localhost pair with no server, no `DATABASE_URL`, no rule for choosing the date, and a `rm -rf apps/web/.next` at §9 step 12 destroying the build it would have needed at step 13. **The localhost pair is dropped and `.github/workflows/impeccable.yml` is named in its place** — it already scans a *discovered* archive day path at both viewports against `https://miolos-*.vercel.app/**`, which is exactly the host pattern `.impeccable/config.json` scopes its `low-contrast` and `cream-palette` ignores to, and plans 037 and 040 both took that CI job as this evidence. Revision 3's claim that the localhost run was *"the only run producing the signal the repo gates on"* was false, and the plan mentioned CI nowhere. The file-mode pair stays, because CI genuinely cannot reach the done state.
2. **§9 never branched, never committed and never opened a PR.** It now has a step 0, named commit points with their messages, and a final push-and-open-the-PR step — with the commit granularity argued rather than assumed, since `.husky/pre-commit` runs the full turbo suite on every commit.
3. **Two verifications could not fail.** Steps 1 and 10 verified *markdown* with `pnpm lint`, whose ESLint globs are `.ts/.tsx/.mts/.cts/.mjs`, and lint-staged's `prettier --write` glob is `*.{ts,tsx,css,json,mjs,yml,yaml}` — neither sees a `.md` file. Both now run `pnpm format:check` (`prettier --check .`, root) — with its own limit stated in step 1, since `.prettierignore` excludes `docs/` and the root markdown files, so **nothing in this repo formats these documents mechanically** and the plan says that rather than swapping one unfalsifiable check for another. Step 10 keeps `pnpm lint` as well, because four of its five edits are in `.ts`/`.tsx`, where it does bind. §2.2's *"`pnpm lint` runs prettier"* is deleted as false.
4. **`npx vitest run` was written bare under a "run from the repo root" header**, with no root vitest config and no root binary — `npx` would have gone to the registry. Every vitest invocation in §9 now carries an explicit `cd apps/web &&`.
5. **A red at the wrong moment.** §9 step 7 creates `day-card.tsx`, a new `useRecordSnapshot(` call site, which reds `T-WEB-S214`'s inventory — but step 7 ran only three suites, so the first red would have arrived at step 12's full gate, where the cheapest-looking fix is weakening the inventory. Step 7 now runs `test/record-snapshot.test.tsx` too, and says what the update is.

**The three overclaims retracted. Each says less than revision 3 said, and each says what survived measurement.**

- **The repair's diffstat.** *"Net 0 — the same size as the code it replaces"* does not reproduce: three independent rebuilds to spec measured **−1, −5 and −5**, and prettier changed none of them. The claim everywhere in this plan is now **never larger than the code it replaces, and between 0 and 5 lines smaller depending on the eviction guard's shape.** The prettier mechanism revision 3 offered for the spread is deleted — it was not the cause.
- **What `T-WEB-S214`'s inventory pins.** It pins the set of **call-site files**, not the number of mounts. A surface that *reuses* `day-card.tsx` — the archive month page is the live example, 31 days × 4 games — adds no file and keeps the test green while mounting far past the 16-entry bound, and §2.2 measured that **17 live consumers already loop**. §2.2 and ADR-0056 decision 1 already said this correctly; D9, seam 2 and R2 said *"a new consumer surface reds this test"* and now say **"a new call-site file"**, with mount-count growth held by review, which is what actually holds it. **No new arm is added** — this plan is one pass from step 5.
- **ADR-0041's stale-pointer dismissal.** Revision 3 said three of five pointers had drifted. Re-measured: **five of five** in `:124-128`, and **ten of ten** across the whole table at `:119-128` — every pointer lands on a line that is not the rule it names. The dismissal (record the drift, do not half-repair the table) is **sound**, and the corrected number strengthens it rather than weakening it.

**Bookkeeping, all of it re-derived against the real files at revision 4.** §7.1's bare count is dropped (the plan's own rule is *"never a count"*) and every hit it concealed is rowed, along with a row that named a line the grep does not return; §6's header is corrected; seam 7 gains the extraction shape for every term it parses, because `pixels()` throws on two of them as written; §9 step 8's browser check becomes evidentiary rather than a judgement call; and the swapped `playedAria`/`completedAria` pairing, the `use-termo-play.ts:273` paraphrase, the `hoje:` block's closing line and the D8 probe's missing `cd` are corrected.

### Revision log — every `D<n>` that changed at revision 4

| `D<n>` | rev-4 change | driven by |
|---|---|---|
| **D1** | The size claim is retracted a second time and stated at measurement strength; the prettier mechanism is deleted. | F-3 |
| **D1a**, **D5**, **D6**, **D7** | Unchanged. | — |
| **D2** | `use-termo-play.ts:273` is quoted exactly instead of paraphrased inside code marks. | F-7 |
| **D3** | The `doneAria`/`playedAria`/`completedAria` names are re-paired with their lines (`:124`, `:144`, `:163`). | F-5 |
| **D4** | The scan's `var(--accent)`-exact pattern gains the four `--accent-app` declarations it deliberately excludes, by path and selector — which is also §7.1's missing grep-4 row. | F-2 |
| **D8** | The marker probe's `node -e` gains its own `cd apps/web`; the `hoje:` block's range is corrected to `:107-173`. | R3-m4, F-6 |
| **D9** | `T-WEB-S214`'s inventory is reworded to pin **call-site files**, with its limit stated; the row records that this ticket adds `day-card.tsx` and re-derives 2 → 4. | F-1, R3-B2 |

*(§4 seam 7, §5, §6, §7.1, §9, §11, §12 and §13 also changed; §0.3 is the full account.)*

### Revision log — every `D<n>` that changed at revision 3

| `D<n>` | rev-3 change | driven by |
|---|---|---|
| **D1** | Diffstat claim corrected (and corrected again at revision 4 — §0.3); the docblock's obligations grow by two sentences (the widened staleness window, `cached.hydrated`'s dead branch); the misquoted docblock line is dropped. | R2-B1, m-3, m-12 |
| **D1a** | Unchanged. | — |
| **D2** | Unchanged in substance; the `messages.ts` register citation is corrected to `:132-138`. | m-10, m-11 |
| **D3** | `cardAriaPlayed` becomes a **different sentence**; `T-WEB-S219` asserts the two names differ; `T-WEB-S222` gains value assertions; the monotone claim is narrowed to "at hydration". | R2-M3, R2-M4, R2-M8 |
| **D4** | The ring arm becomes a **scan with a closed site list**, widened to four rings, with the postmark's real desk-paper figures. | R2-M10, R2-B5, m-13 |
| **D5** | Unchanged; `src/i18n/index.ts`'s line reference corrected. | m-15 |
| **D6** | `--done-chip-box: 24px` is restated as the **declared ceiling** against a used 23/21px box; `line-height: 1`'s false justification is deleted and its real one stated; the deliberate divergence from the hub's 29.34px chip is recorded; every clearance figure is replaced with a measured one; three new observations (the tape gap, the 1px `.cardTop` overflow, the two uppercase runs). | R2-M1, R2-M2, R2-M5, m-4, m-16, m-17, n-1, n-2, n-3 |
| **D7** | `T-WEB-S215` gains absolute expectations, so F5 is pinned rather than merely agreed with; the prune path's accessible-name flip is named. | R2-M7, R2-M8 |
| **D8** | The marker probe uses the script's own `normalize`, gains an anti-vacuity assertion and a positive control; the marker's annotation is corrected. | R2-M12, m-9 |
| **D9** | Baseline corrected to 75/1102; `T-WEB-S214` gains a consumer inventory; `S215`, `S221`, `S222` sharpened; `test/use-record-snapshot.test.ts` and `test/conclusion-view.test.tsx` join the must-stay-green list. | R2-M9, R2-M6, R2-M7, R2-M4, m-5, R2-B4 |

### Revision log — every `D<n>` that changed at revision 2

| `D<n>` | rev-2 change | driven by |
|---|---|---|
| **D1** | **Rewritten.** The parallel projection is withdrawn; `use-record-snapshot.ts` is repaired and used directly. The surviving Termo re-derivation becomes a 10-line pure function. | S1, F3, M2-ADR, S5, S7 |
| **D1a** | Kept; its scope widens to `card-status.ts` and to the repaired hook. | — |
| **D1b** | **Withdrawn.** There is no new hook and no status map; the pure function returns one status. | S1 |
| **D2** | Unchanged in substance; the `Concluído` half of the register argument is deleted as false and the `CONTEXT.md` rows are quoted correctly. | B2 |
| **D3** | Accessible names rewritten to keep a verb; the post-hydration name change is stated; the const hoist gains a two-way tripwire. | M4/S3/D-07, S8/N6 |
| **D4** | The ring's gate moves from prose to `T-WEB-S73`; the citation is corrected from `T-WEB-S72`; the per-accent figures are completed. | B3, M1-ADR |
| **D5** | Import list stated exhaustively (no `src/i18n`, barrel or leaf); `T-WEB-S56` is dropped as the guard and `pnpm typecheck` named in its place. | F1, F2 |
| **D6** | **Rewritten.** In-flow flex row, geometry pinned in literals, arithmetic asserted; `--done-chip-reserve`, the `padding-right`s and the absolute positioning are all gone. | D-01, D-02, D-03, D-04, D-05, D-09, D-13 |
| **D7** | Gains the cross-tab prune disappearance path and the decision not to latch. | F4 |
| **D8** | The `bundle-check` pre-decision is replaced by a named, runnable procedure. | M1-test, B1-ADR |
| **D9** | Range extended to `S213…S224`; allocation rebuilt around the repair; `T-WEB-S72` → `T-WEB-S73`; `T-WEB-S56` no longer listed as a guard; `T-WEB-S184` moved to must-stay-green. | B3, F1, m4, m6 |

---

## 1. Scope & non-goals

**In scope.** `/arquivo/<data>` gains a per-game "you finished this" chip on each day card, rendered from this device's local play records, absent before hydration and absent whenever the device holds no record.

**Also in scope, added at revision 2:** a repair to `apps/web/src/play/use-record-snapshot.ts`'s snapshot cache. It is not adjacent work — it is the mechanism the issue names, it is broken for the shape this ticket needs, and §2.2 measures the repair as **never larger** than the code it replaces. Routing around it and leaving the defect on `main` for the next consumer was revision 1's choice and it is withdrawn.

**Non-goals, each with the record that forbids it.**

- **No server read.** No per-day per-user endpoint (ADR-0053 decision 10, *"Why no endpoint"*), no widening of any existing contract, no `fetch` on this route (ADR-0053 decision 2). Revision 2 gives this a mechanical guard rather than a promise — `T-WEB-S220`.
- **No claim on the streak, the statistics or a medal.** ADR-0031 decision 6: device state *"may drive an affordance — a chip, a CTA target — and never an entitlement."*
- **No duration, no result figure.** §3 D4.
- **No touch on `ConclusionView`, the conclusion tree, or `src/play/day-state.ts` — with one carve-out, granted at revision 3.** `T-WEB-S183`, ADR-0053 decision 9 keep this ticket's *code* out of that module and that is unchanged: nothing imports it, nothing calls it, no behaviour in it moves. **The carve-out is one sentence of one comment.** `day-state.ts:186-190` reads *"The same cache `use-record-snapshot.ts` keeps, for the same reason"*, and D1's repair falsifies it: after this ticket the two modules keep different caches. The reason for the carve-out, on the record because a non-goal is being narrowed: **leaving a knowingly-false cross-reference on `main` is worse than the carve-out** — the plan would otherwise falsify a sentence and forbid repairing it, which leaves the implement agent no legal move (round-2 blocker B4). The edit is a comment, so `pnpm test` and `pnpm typecheck` cannot be affected by it; §7(s) states the replacement sentence's content and §12 carries `git diff --stat apps/web/src/play/day-state.ts` as a row so the carve-out cannot quietly become a code edit.
- **No repair to `usePriorConclusion`.** Its slot is mount-scoped *by design* (#31 step-6 finding F4) and its hazard is a key **hit**, not a key miss (`apps/web/src/archive/use-prior-conclusion.ts:34-48`). It has one consumer class and this ticket adds none. It gets one corrected sentence (§7 b), not a `Map`.
- **No change to `packages/ui`.** Project invariant.
- **No new route, no metadata change, no sitemap change.**
- **Not the month page, not the archive index.** Those are hairline row lists, not cards, and a per-row chip there is a different design question with a different density budget. Out of scope; not deferred, not promised.

---

## 2. The measured facts this plan turns on

### 2.1 The issue's prescribed swap, as shipped, is wrong

*(Verified independently by two step-3 reviewers; recorded here unchanged. Do not re-derive.)*

`apps/web/src/play/use-record-snapshot.ts:43-65` and `apps/web/src/archive/use-prior-conclusion.ts:49-61` each keep **one module-level cache slot**. N per-card consumers with different `game` on one page evict each other on every read, so `getSnapshot` returns a fresh value every time and `useSyncExternalStore` never stabilises. `usePriorConclusion` does not loop (booleans compare by `Object.is`) but its documented per-mount **freeze silently breaks** under two consumers. The positive control — `useDayState(date)`, four consumers, four games, one date — is clean.

### 2.2 The alternative revision 1 never weighed, now measured

Round-1 finding S1: the plan proved the hook broken and built a parallel module rather than asking whether the hook should be fixed. Finding F3 separately measured that a **date-keyed** single slot has the identical defect one level up — two archive dates on one page loop the same way, and `/arquivo/<data>` is the first surface where the date is a URL variable.

Both point at one repair. It was implemented in this worktree, measured, and reverted — three times now, once per revision. **The revert is verified mechanically, not by memory** *(blocker R2-B2)*: `git diff --stat apps/web/src/play/use-record-snapshot.ts` is **empty** and `git status --porcelain` shows no `M` row at plan exit, so the tree holds only the three untracked `docs/plans/043-*` files. This matters beyond tidiness: seam 1's red is *"against the shipped single-slot implementation it throws `Maximum update depth exceeded`"*, and an implement agent starting from a tree that still carries the repair would find seam 1 **green on arrival**, paste the green, and silently skip the only design-driving red in the cache half. §9 step 2 makes that check a precondition with pasted output.

**The repair.** `readSnapshot`'s single slot becomes a `Map` keyed `` `${game}|${date}` ``, insertion-ordered, bounded at `GAMES.length * 4`. **Eviction discipline, pinned so seam 1's red is against a determinate target** *(finding m-2 — "the first-inserted key is deleted" admits both orders, and both measure identically at the boundary)*: the new entry is **`set` first, then the `Map` is trimmed** — `if (size > SNAPSHOT_CACHE_LIMIT) delete(keys().next().value)` — so the key just written can never be the key evicted.

**The diffstat, and the claim that survives every measurement of it** *(blocker R2-B1, then finding F-3 at round 3)*. The figure has now been measured five times by four people and it has not reproduced twice: revision 2 pasted `15 insertions(+), 17 deletions(-)` and called it "net −2"; two round-2 reviewers rebuilt the same repair independently and both got 15/15; revision 3 measured `14 insertions(+), 15 deletions(-)`; round 3 rebuilt it three more times to this plan's own spec and measured **−1, −5 and −5**, with prettier changing none of them.

```
 use-record-snapshot.ts | 29 +++++++++++++++---------------
 1 file changed, 14 insertions(+), 15 deletions(-)     # revision 3's rebuild, code only
```

**So the size claim is stated at the strength the measurements support, and no stronger: the repair is never larger than the code it replaces, and is between 0 and 5 lines smaller depending on the shape of the eviction guard.** Revision 3's *"net 0"* is retracted with revision 2's *"net −2"*, and the prettier mechanism revision 3 offered for the spread is deleted — prettier is not what moves it; the guard's shape is. **A headline resting on ±5 lines was never the argument in the first place. The argument is that the repair fixes the defect for every future consumer at no size cost**, and that is what §2.3's table row now says.

**Probe — the shipped hook, before the repair.** Four `useRecordSnapshot` consumers rendering exactly what a per-card chip renders:

```
 ❯ test/zz-s1-probe.test.tsx (4 tests | 3 failed) 153ms
     × A: four per-card consumers, four games, ONE date 63ms
     × F3: two DIFFERENT DATES, same game, one page 39ms
     × D: eight consumers — four games × two dates 44ms
Error: Maximum update depth exceeded. This can happen when a component repeatedly calls setState
inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to
prevent infinite loops.
 ❯ forceStoreRerender  react-dom-client.development.js:8261:18
 ❯ updateStoreInstance react-dom-client.development.js:8241:39

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)
```

The one passing test is arm **C**, the shipped single-consumer contract.

**Probe — the same file, after the repair:**

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**The whole `apps/web` suite, with the repair in place and the probe removed** (the repair touches the reader every conclusion, the hub and the late-result panel share, so this is the load-bearing evidence, not the probe):

```
 Test Files  75 passed (75)
      Tests  1102 passed (1102)
```

*(**Corrected at revision 3 — blocker R2-M9, measured by two reviewers.** Revision 2 pasted **76 files / 1106 tests** in four places. That run included `test/zz-s1-probe.test.tsx`, the plan's own probe, which the plan says in the same paragraph was reverted — so the baseline gated on a file that does not exist and the exit criterion could never go green. `ls apps/web/test/*.test.* | wc -l` on `main` at `eea445e` → **75**. The gate is therefore expressed as **"all 1102 pre-existing tests still pass, plus the ticket's new ones"**, never as a target total, which is the only form that survives a ticket that adds tests.)*

**`pnpm typecheck`, with the repair in place:**

```
 Tasks:    6 successful, 6 total
  Time:    7.944s
```

**The bound is load-bearing, and that is measured too.** Arm **E** put 20 live consumers (four games × five dates) against a 16-entry cache:

```
     × E: 20 live consumers against a 16-entry cache (over the bound) 29ms
Error: Maximum update depth exceeded. …
```

**Where the boundary actually is** *(finding m-1 — revision 2 said "must exceed" and had measured only 20)*: round 2 measured **16 live consumers stable** against a 16-entry cache, stable again under churn; **17 loops**; 20 loops. So the safe property is `bound ≥ live maximum`, **not** `bound > live maximum`, and revision 2 stated it off by one — in the plan, in D9 and in ADR-0056 decision 1. Round 2 also measured that **eviction survives interleaving**: ten simulated client navigations leave 16 dead keys behind and a fresh page of four still stabilises, and a long-lived consumer whose entry is evicted simply re-inserts and stabilises. Dead keys are not the property; **live-consumer count ≤ bound** is.

Reachable maxima on shipped surfaces, by grep (`grep -rn "useRecordSnapshot" apps/web/src apps/web/app`): `late-result.tsx:113` (1), `conclusion-view.tsx:114` (1), `termo-conclusion.tsx:61` and `nonogram-conclusion.tsx:45` (1 each, nested inside a conclusion — same key). Today's maximum is **2**. After this ticket, `/arquivo/<data>` mounts **4**. The bound `GAMES.length * 4 = 16` is 4× that. `T-WEB-S214` holds a **floor** under the constant and an **inventory of the consumer call-site *files*** (D9); the 4× headroom itself is held by review and by the docblock, and revision 2's claim that S214 "pins the bound against the maximum" oversold a test that renders 8 against a bound of 16 and never renders *at* the bound. **The inventory's limit, stated here because three places in revision 3 overstated it** *(finding F-1)*: it pins *files*, so a surface that **reuses** `day-card.tsx` adds no file and keeps the test green while raising the live maximum. The archive month page is the concrete case — 31 days × 4 games — and it is out of scope (§1), but nothing in this test would stop it. Mount-count growth is held by review, by ADR-0056 decision 1's rule and by the docblock, and this plan says so instead of pretending a test holds it.

### 2.3 The decision, in writing

**Repair the hook; do not build a parallel projection.** Recorded as ADR-0056 decision 1.

The honest trade-off, both sides stated:

| | repair (**taken**) | parallel projection (revision 1, **withdrawn**) |
|---|---|---|
| new/changed lines of logic | **never larger** than the code it replaces in `use-record-snapshot.ts` — 0 to 5 lines smaller, by measurement — plus ~10 for the Termo re-derivation | **~50** of duplicated projection, plus ~10 for the same Termo re-derivation |
| the latent defect on `main` | **fixed**, for every future consumer | left in place; a second surface hits it again |
| F3 (two dates, one page) | **fixed by the same key** | still present, and unrecorded |
| new ADR decisions needed | 1 (the cache contract) | 2 (why re-derive, plus the single-slot rule) |
| anti-drift instrument needed | 1 cheap arm over a pure function | a cross-check test whose only job is to insure the duplication |
| does the issue's own "Files" hint hold? | **yes** — `day-card.tsx` calls `useRecordSnapshot(game, date)` | no; #96's closing comment owed an explanation |
| blast radius | a shared play-layer reader — the whole suite is the gate (measured green above) | zero outside `src/archive` |

The last row is the real argument for the withdrawn option, and it is the reason the full-suite and typecheck runs are pasted above rather than promised. Revision 1's record said *"we could not share it"*; the record now says **we repaired it**, which is a different decision and the one that is true.

**What survives from revision 1 either way:** the Termo `outcome === "lost"` → `played` branch cannot be imported, because `T-WEB-S183` and ADR-0053 decision 9 keep `src/play/day-state.ts` out of the archive's module graph. That is ~10 lines of re-derivation under both options, so it was never the thing the choice turned on.

**No wall is crossed by this.** `use-record-snapshot.ts` is **already inside the archive's module graph on `main`** — `apps/web/src/archive/late-result.tsx:16` imports `useRecordSnapshot`, and `late-result.tsx` is reachable from the four `app/arquivo/[data]/<jogo>/page.tsx` entries `T-WEB-S183`'s walker seeds from (`apps/web/test/archive-day.test.tsx:267-350`). The walker's bans are `conclusion-view`, the three per-game conclusions, the four screens, `src/play/day-state` and the raw string `readDayState`; this module is none of them, and the suite is green today with it in the graph.

---

## 3. Decisions register

### D1 — `useRecordSnapshot`'s cache becomes a keyed, bounded `Map`, and the archive's card calls the hook directly. *(Rewritten at revision 2 — S1, F3, M2-ADR, S5, S7.)*

**Changed:** `apps/web/src/play/use-record-snapshot.ts`.

- `readSnapshot`'s single `cachedSnapshot` slot becomes `const cachedSnapshots = new Map<string, RecordSnapshot>()`, keyed `` `${game}|${date}` ``.
- `export const SNAPSHOT_CACHE_LIMIT = GAMES.length * 4`. Written first, trimmed after: on overflow the **first-inserted** key is deleted (`Map` iteration order), never the key just written. `GAMES` is a value import from `@miolos/core`, replacing today's type-only import.
- **The `Map`'s value type is the hydrated variant**, `Map<string, Extract<RecordSnapshot, { hydrated: true }>>`, not `RecordSnapshot` *(finding m-3)*. Only hydrated snapshots are ever inserted, so a `cached.hydrated` check inside `readSnapshot` would be dead code from its first line; narrowing the type deletes the branch instead of leaving it to be read as a live case. The guard becomes `cached !== undefined && sameToTheReader(cached.record, next)`.
- The module docblock at `:32-42` is rewritten. Its `{game, date}` keying claim survives and strengthens; what does not survive is *"Module-level because the store it caches is — one browser has one `localStorage`"* as a justification for **one slot** *(finding m-12: revision 2 quoted this docblock as containing the words "one slot", and it does not — the phrase is `use-prior-conclusion.ts:35`'s. Claim right, quote wrong.)* — module-level is still true and is still the reason, but it justifies a module-level **`Map`** now. Three sentences it owes:
  1. **the bound's rule** — the limit must be **at least** the largest number of simultaneously-mounted consumers (16 is stable, 17 loops — §2.2), today 2 and 4 after this ticket, and `T-WEB-S214` is what holds the floor and the consumer inventory;
  2. **the widened staleness window** *(finding m-3)* — under the single slot a cached snapshot died the moment another key was read, so `sameToTheReader`'s uncompared fields (nonogram `grid`/`size`, termo `answer`/`outcome`) could only ever be briefly stale; under the `Map` an entry survives the whole session. That is safe **only** because of the lockstep invariants this same docblock already names (`T-WEB-S64`, the termo `superRefine`), and the repair makes those invariants load-bearing where they used to be belt-and-braces. The docblock is being rewritten anyway; this is the sentence it owes;
  3. ADR-0056 by number.
  It must not contain the string `readDayState` (D1a).

**New:** `apps/web/src/archive/card-status.ts`, a pure function, no React, no hook, no cache:

```ts
export type ArchiveCardStatus = "pending" | "completed" | "played";
export function archiveCardStatus(record: PlayRecord | undefined): ArchiveCardStatus;
```

Ten lines. `undefined` or `concluded !== true` → `pending`; a `termo` record with `outcome === "lost"` → `played`; anything else concluded → `completed`.

**Why this is a re-derivation and not an import.** `T-WEB-S183` and ADR-0053 decision 9 keep `src/play/day-state.ts` out of the archive's module graph, and `day-state.ts`'s `entryFor` (`:165-181`) is where the identical branch lives. Three of revision 1's four arguments stand; the fourth is added and the third is corrected:

1. `day-state.ts` carries `elapsedMs` as half of `DayEntry`'s contract; the archive publishes no duration (D4).
2. It carries `completedCount` and `nextPendingDaily`, which no archive surface has a use for.
3. ~~It is committed to the server's date.~~ **Struck at revision 2 (finding S5).** Revision 1 argued that `day-state.ts`'s header commits it to *"the SERVER's `date` — never a client-computed today"*, while the plan's own cross-check test called `readDayState(archiveDate)`. Arguments 1, 2, 4 and the wall are decisive without it. What survives, narrowly: ADR-0031 decision 5 (as amended by ADR-0048) reserves `day-state.ts`'s **body** for #83's server day-truth payload, so pointing a production archive surface at that body would put an archive date inside the module #83 is going to replace. That binds production callers; it never bound a test.
4. **The excluded state is the only state here** *(new at revision 2 — finding M2-ADR).* `day-state.ts:26-30` says in its own words: *"CONTEXT.md's verbs, minus the one a local reader cannot see: a LATE completion is an archive fact the server owns (#31), so this reader has three states, not four."* On `/arquivo/<data>`, **every** completion the chip can render is a late completion. The hub's union was built to exclude exactly the state the archive is made of. That is the mechanical root of §5's wording question, and it is why `T-WEB-S215`'s claim is narrowed in words (D9).

**The drift insurance is `T-WEB-S215`**, which imports `archiveCardStatus` **and** `readDayState` and asserts they answer the same status for every game and every record shape. Legal: `T-WEB-S183`'s walker starts from the seven `app/arquivo/**` page entries and follows **relative imports only**; no test file is ever in that graph, and `eslint.config.mjs:529` records that `apps/web/test/**` sits inside the app-wide wall and trips none of it.

### D1a — **Landmine: no module entering the archive's graph may contain the string `readDayState`, in code or in a comment.** *(Unchanged in substance; scope widened at revision 2.)*

`apps/web/test/archive-day.test.tsx:348-350`:

```ts
for (const path of graph) {
  expect(readFileSync(path, "utf8")).not.toContain("readDayState");
}
```

A **raw text** scan with no comment stripping. It now binds on three files rather than one: `src/archive/card-status.ts`, `app/arquivo/day-card.tsx`, and — because the graph reaches it — `src/play/use-record-snapshot.ts`, whose docblock this ticket rewrites. Cite `apps/web/src/play/day-state.ts` **by path**; never by identifier. Napkin item 3 is this class of trap in the other direction; here it bites on prose that is *correct*.

*(`use-record-snapshot.ts` is clean today and must stay clean: `grep -c readDayState apps/web/src/play/use-record-snapshot.ts` → 0. §9 step 9 re-checks it.)*

### D1b — **Withdrawn at revision 2.** There is no status-map hook. `archiveCardStatus` returns one status for one record; the card holds no map.

### D2 — **Two verbs, not one — and for Termo it is not a copy choice.** *(Register argument corrected at revision 2 — finding B2.)*

The chip renders **`Feito`** for a `completed` status and **`Jogado`** for a `played` one. Only Termo can ever be `played` — the restriction is `CONTEXT.md:13` (*"Only Termo can end here"*) plus ADR-0008 rule 3, mechanised at `apps/web/src/play/day-state.ts:165-181`. *(Revision 1 attributed this to ADR-0044 decision 4, which defines the union and the `elapsedMs` rule and restricts nothing — finding N1. Claim true, citation now correct.)*

The issue says the chip *"says 'you played this', nothing more"*, which reads as an argument for one verb. It cannot be taken literally for Termo: a lost Termo carrying **Feito** would be a **false done**, the one direction ADR-0031 decision 2 forbids by name — *"A false pending is invisible; a false done would be a lie the player can catch."* ADR-0043's Rejected list refuses the same collapse for the same reason.

**This is forced by the data, not by taste.** `apps/web/src/termo/use-termo-play.ts:273` writes, verbatim *(quoted exactly at revision 4; revision 3 put a paraphrase inside code marks — finding F-7)*:

```ts
    outcome: closed ? (state.status === "solved" ? "won" : "lost") : undefined,
```

and `ArchiveTermoScreen` composes that same hook — so an archive-route Termo record really does carry the distinction and a one-verb chip would have to discard it.

**What §5 hands to Fernando is the register**, and revision 1 argued it on a false premise. `Concluído` appears **zero** times in `CONTEXT.md` (`grep -c "Concluído" CONTEXT.md` → 0). See §5 for the rows that are actually in the file and for the decision.

### D3 — Copy: new keys under `messages.archive.day.*`, bound to the same module consts the hub reads. *(Accessible names rewritten at revision 2 — findings M4/S3/D-07; tripwire widened — S8/N6.)*

Four additions to `messages.archive.day`, which today holds only `cardAria` (`apps/web/src/i18n/messages.ts:467-470`):

| key | value | why |
|---|---|---|
| `done` | the shared const currently inlined as `hoje.done` (`"Feito"`) | one definition for one word on one card register |
| `played` | the shared const currently inlined as `hoje.played` (`"Jogado"`) | same |
| `cardAriaDone` | `(game, longDate) => \`Ver o resultado do ${game} de ${longDate}\`` | composed whole (ADR-0018) |
| `cardAriaPlayed` | `(game, longDate) => \`Ver o resultado do ${game} de ${longDate} — jogado\`` | **a different sentence, changed at revision 3** — see below |

**The name keeps a verb, and that is a correction.** Revision 1 proposed `"{game} de {longDate} — concluído"`. Three step-3 reviewers independently rejected it: on an interactive `<a>`, WCAG **2.4.4 Link Purpose (In Context)** (Level A) asks the accessible name to make the destination determinable, and a screen-reader user tabbing four cards would hear three *"Jogar Sudoku de …"* and one *"Termo de … — concluído"* — the odd one out being the only card whose name does not say what activating it does. The em-dash precedent revision 1 borrowed (`archive.dayRowAria`) is a **row**, which never carried a verb to lose.

**"Ver o resultado" is accurate exactly when it is rendered, and that is checkable.** ADR-0053 decision 10 **layer 2**: *"A concluded play record for `(game, date)` restores the closed state through the shared lifecycle's own short-circuit, with no new code."* The chip's predicate and that restore's predicate are the same predicate (`concluded === true`) on the same record, so whenever the done name is used, this device *will* open that route closed. Layer 3's honest gap (cross-device, post-retention: the board really is playable) is the case where the device holds **no** record — which is the case that keeps `cardAria`'s *"Jogar …"*. Revision 1's finding-D-07 complaint that the label was written as if layer 2 were the only case is answered by the predicate, not by the wording.

**Two keys, two sentences — corrected at revision 3 (major R2-M3).** Revision 2 made `cardAriaDone` and `cardAriaPlayed` byte-identical *"because the destination is identical"*. That is a 2.4.4 answer to a question 2.4.4 did not ask, and it collapses exactly what D2 spends a decision proving may not collapse. The chip is `aria-hidden` and the anchor's `aria-label` **replaces** its content as the accessible name, so on a done card **the accessible name is the only channel carrying state to assistive tech**. Identical names mean a screen-reader user hears the same sentence for a won Sudoku and a lost Termo while a sighted user sees `FEITO` and `JOGADO` — and D2's own sentence is that *"a false pending is invisible; a false done would be a lie the player can catch."* **An AT user cannot catch it.** This is not a new product question; it is the consistent application of a decision Fernando already endorsed when he kept two verbs.

So the played name carries the played state, in the hub's own register: `"Ver o resultado do {jogo} de {data} — jogado"`. The hub ships **three distinct sentences** for precisely this reason — `doneAria` (`apps/web/src/i18n/messages.ts:124`), `playedAria` (`:144`) and `completedAria` (`:163`) *(the pairing is corrected at revision 4: revision 3 listed the three names in one order and their three lines in another — finding F-5)* — and `hub-day-state.tsx:119-124` writes the reason out. The verb stays first, so WCAG 2.4.4 is satisfied the way D3 already argues; the game name stays contiguous, so 2.5.3 is untouched; and the em dash is `archive.dayRowAria`'s own idiom on this surface. `T-WEB-S181`'s reachability arm covers both keys, and **`T-WEB-S219` asserts the two names differ** — which turns "two keys, deliberately" from a tautology into a falsifiable claim.

**The name changes at hydration, and the invariant is scoped to hydration** *(narrowed at revision 3 — major R2-M8)*. Pre-hydration every card is named `cardAria`; after hydration a card with a record is renamed. **At hydration** that is the same monotone direction as the chip itself (ADR-0031 decision 2): the name only ever becomes *more* specific. Revision 2 wrote that as an unqualified invariant — *"the name may only ever become more specific, never less"* — and D7's own prune path falsifies it: a cross-tab prune flips a card done → pending mid-view, which takes the name from `cardAriaDone` back to `cardAria` (*"Jogar …"*), strictly **less** specific, on an interactive `<a>` that may be focused. D7 reasoned about the chip and not about the name. That flip is **accepted** — for D7's four reasons, which apply to the name exactly as they apply to the chip — and it is stated once, here and in ADR-0056 consequence (b), rather than twice with two different scopes. Neither transition is announced to assistive tech as a live change (no `aria-live`, no `role="status"`; ADR-0043 decision 10 as amended by ADR-0054 decision 4 is untouched). `T-WEB-S219` asserts the server name and the hydrated name in the same test, which is the only mechanical form the hydration transition has.

**`"Feito"` and `"Jogado"` are hoisted to module-level consts** in `apps/web/src/i18n/messages.ts` and read by **both** `hoje` and `archive.day`. That is the file's own idiom for a word two blocks share (`back`, `backAria`, `hintsUsed`).

**The tripwire asserts identity *and* value, and revision 2's "both directions" was a tautology** *(finding S8/N6, corrected at revision 3 — major R2-M4)*. `messages.ts:132-138` documents a **deliberate** register split for one word across two registers — the hub's tile chip is capitalised `Jogado` while the day card's tabular slot is lowercase `jogado`, *"and the difference is deliberate (plan 022 §15.3)"*. *(Revision 2 read this as "a deliberate three-way register split for two other done/played pairs"; it is **one** word across two registers, and the range was cited one line short — finding m-10, m-11.)* So a const shared by two blocks is exactly the shape this file has already split once on purpose, and the tripwire's job is to make a second split a **decision** rather than a drift.

Revision 2's form cannot do that job. With `"Feito"` hoisted to a single const, asserting `copy.day.done === messages.hoje.done` in both orders is **two reference identities on the same binding**: change the const to `"Concluído"` and both surfaces move together, the test stays green, and the silent drift R14 exists to prevent has happened. **`T-WEB-S222` therefore carries four assertions**: the two identities (`messages.hoje.done === ARCHIVE_DAY_DONE_CONST`, `copy.day.done === ARCHIVE_DAY_DONE_CONST`, and the same pair for `played`) **and the two values** (`expect(messages.hoje.done).toBe("Feito")`, `expect(copy.day.done).toBe("Feito")`, likewise `"Jogado"`). The value arms are what red on a rename; the identity arms are what red when one block is pointed somewhere else. Neither claim is "bidirectional" and D3 and R14 stop saying it is.

**[C1] — a correction to the ticket brief, carried forward from revision 1 and re-verified.** The brief warns that *"`T-WEB-S181` asserts the archive `result` key list exactly, so adding keys is a test edit."* Verified against `apps/web/test/archive-copy.test.ts`: the two exact-list assertions are over `copy.result` (`:55-65`) and `copy.meta` (`:66-75`) **only**. `copy.day` has no key-list assertion. Adding keys under `archive.day` does **not** touch a closed list; the edit is to the additive *"every archive string is reachable"* arm at `:40-82`, and it is additive by choice rather than forced.

### D4 — **Chip only. No duration, no result figure.** And the ring's exemption is argued with numbers *and gated by a test*. *(Citation corrected and gate added at revision 2 — findings B3, M1-ADR.)*

The hub pairs its chip with `em MM:SS` and the record does hold `elapsedMs`. The archive does not, for three reasons that stack:

1. `messages.archive.play.note` is shipped copy on the archive's own play screen: *"Puzzle do dia arquivado. Não conta para a sequência nem para os seus tempos."* Printing a time on the archive's day page contradicts the product's own sentence about what the archive does with times.
2. ADR-0031 decision 6 permits an affordance and forbids an entitlement. A chip is an affordance; a published figure reads as a statistic.
3. Termo publishes no duration on any projection at all (ADR-0045 decision 4, ADR-0044 decision 4), so a duration-bearing archive chip would need the hub's three-composer split for a figure the plan has already decided not to show.

**The WCAG 1.4.11 argument.** `apps/web/app/page.module.css:231-237` justifies the ring as *"outlin[ing] 'Feito' beside a tabular result, which carries the whole message."* ADR-0041 decision 5's own wording is narrower and is the one that governs: *"an accent border that outlines an already-legible label is decoration … because the words they enclose are at 15.6663:1 and carry the whole message."* The exemption rests on the **enclosed word**, not on a sibling figure — which is why the archive's result-less chip keeps it.

On the archive day card the numbers are identical, because the paper is identical (`arquivo.module.css:306` declares `background: var(--paper-card)`, the same token the hub card carries):

- **ring**, `1.5px solid var(--accent)`, worst case `--accent-termo` #C08A1E (L 0.29477163) on `--paper-card` (L 0.93262753) → **2.8501:1**;
- **word**, `--ink` #211D19 (L 0.01272250) on `--paper-card` → **15.6663:1**.

**Completing the figures, which revision 1 left as a worst case only.** Termo is the *only* one of the four accents needing the exemption: sudoku **7.8385:1**, binairo **5.5377:1** and nonogram **4.5063:1** all clear WCAG 1.4.11's 3:1 non-text floor unaided. Applying 1.4.11 directly rather than by analogy: the state is carried by the visible word at 15.6663:1, so the ring is not *required* to identify the state and the exemption is genuinely available — not merely inherited from the hub.

**[C2].** `impeccable`'s `low-contrast` never evaluates a border, ring or outline — both `contrastRatio(` call sites in `impeccable@3.4.0` (`cli/engine/rules/checks.mjs:137`, `:217`) take a **text** foreground. The detector will not check the ring either way.

**Which is precisely why the ring needs a test, and revision 1 named the wrong one.** ADR-0041 consequence (f) rules directly: *"`impeccable detect` cannot see any of this and never will, so every decision here is gated by one test file or by nothing."* Revision 1 cited `T-WEB-S72` (`apps/web/test/ink-on-accent.test.ts:31`), whose only scan tests `background: var(--accent)` **plus** `color: var(--paper-desk)` — a desk label on an accent fill, which says nothing about accents colouring words. The real gate is **`T-WEB-S73`** (`:198`), whose `SHARED` list already contains `app/arquivo/arquivo.module.css` (`:212`) and whose scan at `:256-262` is `/(?:^|;)\s*color:\s*var\(--accent[a-z-]*\)/m`. So the *"no accent ever colours a word here"* half is gated for free — via S73, not S72.

**The ring itself is not gated, and this ticket ships a third one.** `T-WEB-S73`'s *"keeps the two accent rings"* arm (`:343-359`) asserts exactly two rings by name, with two `decl(bodyOf(…))` literals: the 3px conclusion stamp (`src/play/conclusion-view.module.css:239`) and the hub's 1.5px done chip (`app/page.module.css:239`). This ticket adds `.doneChip` in `arquivo.module.css`.

**The arm is widened in place** (no new id — the `T-WEB-S100` burn precedent), and at revision 3 it stops being a list of literals and becomes **a scan with a closed site list** — the sheet-scanning idiom this same file already uses twice (`ALLOWED_ACCENT_TEXT` at `:239-244`, the word scan at `:256-262`). The reason is finding **m-13**: revision 2's ADR decision 4 stated an *instance* (*"the third accent ring is gated"*), which binds nothing about a fifth, and revision 2's two `expect`s could not have caught the fourth ring either — the arm's own title says *"the accent rings"*, and an enumeration that omits a shipped member makes the title false. A scan closes it:

```
/(?:^|;)\s*border:\s*[\d.]+px\s+solid\s+var\(--accent\)/m     over the SHARED sheets
```

`var(--accent)` exactly — the **per-game** token, the one that can resolve to mustard — and not `var(--accent[a-z-]*)`, because `--accent-app` is one fixed hex on every screen and is ADR-0041 decision 1's own carve-out. **That exactness is load-bearing rather than stylistic, and revision 4 names what it excludes** *(the §7.1 grep-4 row for `conclusion-view.module.css:487`)*: widening the pattern to `var(--accent[a-z-]*)` would sweep in `src/play/conclusion-view.module.css:499` (`.streakCard`), `app/page.module.css:46` (`.streakStamp`), `app/estatisticas/page.module.css:74` (`.summary`) and `:145` (`.medalRing`) — four app-identity rings whose ratios `T-WEB-S73`'s own `ALLOWED_ACCENT_TEXT` docblock (`:221-238`) already records as 6.0351:1 and 6.2980:1, and which are not this scan's business. Measured over today's `SHARED` list (`test/ink-on-accent.test.ts:204-219`), the scan returns exactly the four shipped sites in the table below — `src/play/conclusion-view.module.css:239`, `app/page.module.css:239`, `src/archive/late-result.module.css:90` and `src/play/screen.module.css:292` — and this ticket's `.doneChip` is the fifth:

| site | what it is | ring vs its paper | the word it encloses |
|---|---|---|---|
| `src/play/conclusion-view.module.css:239` `.stamp` | the daily's 3px postmark | **2.8501:1** on `--paper-card` | `--ink` **15.6663:1** |
| `app/page.module.css:239` `.doneChip` | the hub's 1.5px chip | **2.8501:1** on `--paper-card` | `--ink` **15.6663:1** |
| `src/archive/late-result.module.css:90` `.stamp` | the archive's 3px postmark — **on `main`, unasserted since #31** | **2.7311:1** on `--paper-desk` | `--ink` **15.0124:1** (`.stampDay`), `--ink-2` **5.0791:1** (`.stampLabel`, `.stampMonth`) |
| `app/arquivo/arquivo.module.css` `.doneChip` | **this ticket** | **2.8501:1** on `--paper-card` | `--ink` **15.6663:1** |
| `src/play/screen.module.css:292` `.hint` | *not a ring* — an accent **fill** whose border is its own edge (`background: var(--accent)`, `color: var(--ink-on-accent, var(--paper-desk))`) | n/a | gated by `T-WEB-S72`, which is the fill scan |

**The fourth ring's figures are computed here rather than assumed, and they are the reason the arm's own comment had to be rewritten** *(major R2-M10)*. Revision 2 widened to four while leaving the comment reading *"Both rings are 2.8501:1 against card paper and both enclose text at 15.6663:1"* — which the fourth ring falsifies three ways: `late-result.module.css`'s panel declares no `--paper-card`, so its stamp sits on **desk** paper (2.7311:1, `DESIGN.md:50`'s own figure), and its enclosed words are `--ink-2` at 5.0791:1 as well as `--ink` at 15.0124:1. **The decision is to take the fourth ring, not to defer it**, because every one of those numbers clears the bar the exemption rests on: the lowest enclosed word is 5.0791:1, above PRODUCT.md's 4.5 floor, so each ring genuinely outlines an already-legible label — and the archive stamp is `aria-hidden` besides (`late-result.tsx:145`), so it is decoration by construction as well as by ratio. Deferring it would mean a second ticket to add one entry to a list this ticket is already rewriting.

**What the widened arm asserts**, three things rather than two literals: (i) the scanned site set **equals** the five above, so a sixth accent border in a shared sheet reds the test rather than passing unnoticed; (ii) each of the four rings' `border` declarations, by value, as today; (iii) the comment carries the table above, per-paper, replacing the single-paper sentence.

ADR-0041 decision 5's enumeration is **exemplary, not closed** — the decision states a general rule first (*"An accent border that outlines an already-legible label is decoration; an accent border that is the only thing saying which state a control is in is not"*) and then names two instances of it. So no ADR amendment is owed; what was owed was the gate, and §7(m) records that reading so the next ticket does not re-derive it.

### D5 — The client boundary is the **whole day card**, not the chip. *(Import list stated exhaustively and the guard corrected at revision 2 — findings F1, F2.)*

`apps/web/app/arquivo/day-card.tsx`, `"use client"`, exporting `ArchiveDayCard`. `day-view.tsx` stays a server component and stays the owner of `<main>`, the top bar, the `<h1>` and the `<ul>`; each `<li>` renders `<ArchiveDayCard …/>`, which renders the `<Link>` and everything inside it.

**Why not the smaller boundary.** A chip island inside the server-rendered `<Link>` is smaller and it is broken: the `<Link>` carries `aria-label`, which **replaces** its content as the accessible name, so an `aria-hidden` chip announces nothing and a non-hidden one is swallowed. The done state would be invisible to every screen-reader user. Label and chip must move together, so the component that owns one owns both — the hub's shape exactly (`apps/web/app/hub-day-state.tsx:116-135`).

**It lives beside `page.tsx` and not under `src/`**, for `hub-day-state.tsx:9-13`'s mechanical reason: CSS Modules hash class names per file, so a component painting with `arquivo.module.css` must import that exact module, and `day-view.tsx` cannot carry `"use client"`. `app/estatisticas/stats-view.tsx` is the second instance of the precedent.

**`day-card.tsx`'s import list, stated exhaustively** *(finding F2 — revision 1's §6 and D5 contradicted each other on `archiveGameRoute`)*:

```
react              — nothing, or the type-only imports the props need
next/link          — Link
../../src/play/use-record-snapshot   — useRecordSnapshot
../../src/archive/card-status        — archiveCardStatus
../../src/play/accent                — accentVars
./arquivo.module.css                 — styles
```

**And nothing from `src/i18n`, barrel or leaf.** `href` is composed on the server by `day-view.tsx`, which keeps `archiveGameRoute` — revision 1's §6 said that function *"moves with the card"*, which would have put `apps/web/src/i18n/index.ts` on the client graph. The barrel re-exports `messages` (`apps/web/src/i18n/index.ts:15`) three lines above `archiveGameRoute` (`:18`) *(finding m-15: revision 2 said "two lines above")* and already carries a committed, measured note that this hazard is real: `medalCopy` *"deliberately does NOT ride this barrel … re-exporting it here would put its prose in the module graph of every route that touches i18n (plan 035 §14 watch item 2, measured)"* (`:11-14`). §12 carries a grep on `day-card.tsx` for `src/i18n` as an exit criterion.

**Props are plain data only.** The server passes:

```
game, date, index, name, kicker, cardAria, cardAriaDone, cardAriaPlayed, done, played, href
```

— all strings and one number. **No composer, no function, ever.** The two aria variants and the two chip words are pre-composed on the server and cross as finished strings, which is ADR-0018's own rule read through the RSC boundary.

**The guard is `pnpm typecheck`, not `T-WEB-S56`** *(finding F1, measured by two step-3 reviewers independently)*. `unserializableProps` (`apps/web/test/route-ssr.test.tsx:168-198`) walks the **returned element**, recursing into `element.data.props` only. `ArchiveDayPage` returns `<ArchiveDayView …/>` unrendered, so `ArchiveDayCard` and its props never exist during that assertion — a reviewer's verbatim copy of the walker went green on `expect(found).toEqual([])` **with a live function prop in place**. `T-WEB-S56` therefore does **not** guard this boundary and revision 1's R3 mitigation was empty.

The real guard: `ArchiveDayCard`'s props are declared as a `readonly` interface whose members are `string` and `number` only. Under `strict: true`, assigning `messages.archive.day.cardAriaDone` (a `(game, longDate) => string`) to a `string` member is a red typecheck. §9 runs `pnpm typecheck` at the step where the boundary lands (step 6), not only at the gate (finding F6).

**No row is added to `T-WEB-S56`'s `ROUTES` table.** `/arquivo/[data]` is already there (`:355-357`) and its arms (SSR-without-throw, Flight-serializability of the *page's* return) stay green and stay meaningful. Adding a nested-view probe to that table would give one id two meanings (`docs/agents/test-ids.md:20`).

**Dismissed with a reason, not by silence:** finding F1 offered an optional runtime guard — `unserializableProps(ArchiveDayView({date, games}))`, which *would* see the card's props because `ArchiveDayView` is a synchronous function component and its returned tree carries `<ArchiveDayCard>` elements with their props attached. **Not taken.** It asserts at runtime exactly what the closed typed interface asserts at compile time, one layer later; it costs a new id and an edit to a shipped suite; and CLAUDE.md's gate runs `pnpm typecheck` on every PR. If a reviewer wants it at step 6 it is three lines and `T-WEB-S223` is reserved.

**Consequence:** the client component imports **no `messages` module**. Combined with `accentVars` (20 lines of pure map), the client chunk for `/arquivo/[data]` gains `use-record-snapshot.ts` → `play-record.ts` (`@miolos/core` + `zod`, verified: it imports nothing else) and nothing that carries copy. See D8.

### D6 — Placement: an **in-flow flex row beside the kicker**. *(Rewritten at revision 2 — findings D-01, D-02, D-03, D-04, D-05, D-09, D-13.)*

Revision 1 proposed an absolutely-positioned corner stamp with a `--done-chip-reserve` custom property whose value it did not specify. A step-3 reviewer measured the resulting collision in Puppeteer against the real stylesheet (10.09px × 72.95px of overlap with `.cardKicker` at 1440×900) and measured that `impeccable detect` is **blind to it** — `text-occlusion` (`checks.mjs:5195-5258`) samples the kicker at 21×1, of which 6 fall inside the chip → occFrac **0.286** against the rule's text-occluder bar of **0.45** (`:5238`). A plan may defer a check; it may not defer the constants a gate-invisible failure mode depends on. **The whole failure mode is deleted instead.**

**The shape.** This stylesheet's own idiom, `arquivo.module.css:135-143`'s `.rowLink`:

```
.cardTop { display: flex; justify-content: space-between; align-items: center;
           gap: var(--space-3); min-height: var(--done-chip-box); }
```

A new `<div className={styles.cardTop}>` inside the `<Link>`, containing today's `<p className={styles.cardKicker}>` and, when there is a record, `<span aria-hidden className={styles.doneChip}>`. Kicker left, chip right. **The row is always full because the kicker fills it in both states** — which is exactly the argument that legitimises the hub's reserved box, and exactly the argument the archive card denies only for the *vertical CTA slot*.

`.cardKicker` gains `min-width: 0` (so a long kicker shrinks rather than pushing the chip out); `.doneChip` gains `flex: none; white-space: nowrap`.

**Geometry: `--done-chip-box: 24px` is a declared ceiling over a used box of 23px, and the 1px is Blink's, not the plan's.** *(Restated at revision 3 — major R2-M1, measured independently by two round-2 reviewers.)* Declared on `.card`:

| term | declared | used (measured) | source |
|---|---|---|---|
| border | 1.5px × 2 = 3px | **1px × 2 = 2px** | `border: 1.5px solid var(--accent)` — Blink floors a 1.5px used border width to 1px, at dpr 1, 2 **and** 3 alike |
| padding | 5px × 2 = 10px | 10px | `padding: 5px var(--space-3)` — `apps/web/app/page.module.css:241` |
| text | 11px × `line-height: 1` = 11px | 11px | `font-size: 11px`, with **`line-height: 1` declared explicitly** |
| **total** | **24px** | **23px** | |

```
1440x900 dpr=1 {"borderW":"1px","chipH":23,"rowH":24,"cardH":117}
1440x900 dpr=3 {"borderW":"1px","chipH":23,…}
390x844  dpr=3 {"borderW":"1px","pad":"4px","chipH":21,"rowH":24,…}
```

Revision 2 pinned *"2×1.5px border + 2×5px padding + 11px = 24px"* and had `T-WEB-S221` assert that equality — **an equality that describes a box the browser never renders**. There is no visual defect (the 24px row is ≥ the 23px chip, which is centred in it, and there is no CLS at any DPR), but a plan, an ADR and a permanent test would have enshrined arithmetic about nothing. **The invariant is `declared ≥ used`**: the declared box is what the row reserves, the used box is what the chip paints, and flooring can only ever shrink the second. The stylesheet comment, D6 and `T-WEB-S221`'s comment all say that in those words.

**Why keep 24 rather than declare 23.** Setting `--done-chip-box: 23px` would make row and chip exactly equal at 1440×900 and save one pixel, at the cost of writing Blink's flooring rule into a stylesheet-text test — `T-WEB-S221` would have to compute `floor(border) × 2` to reproduce 23, i.e. encode a rendering-engine rounding behaviour in a CSS-source assertion, which is precisely the kind of clever test the repo's own `css-source.ts` exists to avoid. 24 is the sum of the declarations, which is the only thing a stylesheet-text test can honestly check.

**The mobile override** (`page.module.css:433-438`) is `padding: var(--space-1) 9px` → declared 3 + 8 + 11 = **22px**, used **21px** (measured). `--done-chip-box` stays 24px at both viewports; the mobile chip sits inside a 24px row with **3px** of vertical slack, not revision 2's "a 22px box with 2px of slack" — wrong in both halves, the same way. One constant, no breakpoint-dependent height. **The type stays 11px at both — the legibility floor**, the same rule `.cardKicker` follows.

**`line-height: 1` makes this chip deliberately shorter than the hub's, and that is recorded rather than hidden.** *(Major R2-M2 — revision 2 justified the declaration with a mechanism that does not exist, and the divergence it creates went unstated.)*

- **The false sentence is deleted.** Revision 2 wrote *"the hub's chip inherits its line-height from a flex context this card does not have."* There is no such mechanism: the hub's `.doneChip` inherits unitless **1.5** from `body { font: var(--text-body) }` (`apps/web/app/globals.css:16`, `packages/ui/tokens.css:23`), exactly as this one would.
- **The divergence, measured.** The shipped hub chip is **29.34px** tall (`lh: 16.5px`, 5.5px of leading around an 11px word); the archive chip with `line-height: 1` is **23px**, ~21% shorter, with 2px of leading. Widths are the same to within a rounding step (80.97 vs 81.0), so the two chips differ in exactly one visible dimension — while `arquivo.module.css:288-292` declares this card to be *"the hub's Game-card register"* and D6 presents the chip as carried over.
- **The decision is to keep the tighter box, deliberately**, on three grounds. **(i) Cost.** Matching the hub means a 30px row, 19px of permanent card growth instead of 13px — a ~46% increase on the number §5 decision 3 hands to Fernando and on which he has already taken a position. Changing what he approved as a side effect of a step-4 fix would be the wrong way round; if he wants the chips identical, the switch is `--done-chip-box: 30px` and deleting one declaration. **(ii) Register.** The hub's chip lives in `.done`'s reserved CTA-height box beside a tabular result; this one is one of two items in a micro-row beside an 11px kicker, and 5.5px of leading around an 11px stamp is generous in that row. The two are never on screen together. **(iii) Testability.** With `line-height: 1` declared, the box arithmetic is closed and `T-WEB-S221` can check it from stylesheet text; with the value inherited, the term is not in the sheet at all and the arithmetic arm cannot be written — jsdom has no layout and `css-source.ts` reads text.
- **Recorded in three places**, so a future reader does not read it as drift: this bullet, §7(j)'s `DESIGN.md` clause (which names the size delta explicitly), and ADR-0056 consequence (e).

*(Finding S12/F8: revision 1's "carried over verbatim" list omitted `padding: 5px var(--space-3)` while carrying the mobile override, so a literal implementation would have shipped the desktop chip with no padding. The full carried set is: `border: 1.5px solid var(--accent)`, `border-radius: var(--radius)`, `padding: 5px var(--space-3)`, `color: var(--ink)`, `font-size: 11px`, `letter-spacing: 0.12em`, `text-transform: uppercase`, `transform: rotate(-3deg)` — plus `line-height: 1`, `flex: none`, `white-space: nowrap` as additions.)*

**What this buys, finding by finding:**

- **Zero CLS, without leaving flow.** The row's `min-height` is the chip's box, so the row is 24px tall in both states and hydration adds a chip into space that was already there. There is no reserved *emptiness*: the kicker occupies the row in the pending state, which is the distinction revision 1's rejection of the hub's `--cta-box-min-height` box turned on. `day-view.tsx:25-26`'s *"A short date renders fewer cards and nothing else: no placeholder, no greyed slot"* is honoured — this reserves no slot, it re-shapes a row that already renders. *(Finding D-14: revision 1 cited these lines as `:26-27` three times. They are `:25-26`.)*
- **No overlap with `.tape`, at any width — measured, not derived.** *(Finding m-4: revision 2's four clearance figures were arithmetic and three of them were wrong, all in the safe direction.)* The chip is inside the card's padding box. `.card`'s `padding-top` is `var(--space-6)` = 24px; `.tape` (`:324-334`) is `position: absolute; top: -7px; height: 14px` **and `transform: rotate(-4deg)`**, which revision 2's arithmetic ignored — it paints to +10.49px, not +7. The chip's own `rotate(-3deg)` overhangs its layout box vertically, and its top sits at 25 rather than 24. Net measured worst case: **chip → tape 12.91px** (revision 2 said ≈14.8), **title → chip 6.40px** (revision 2 said ≈5.8). Both clear, neither is what the plan claimed, and the second is the tighter of the two. *(Finding D-13 dissolves with it: `.tape` and `.doneChip` are no longer siblings competing for paint order in the same box.)*
- **Horizontally, the chip and the tape nearly meet, and that is aesthetic rather than structural** *(nit n-1)*. At 1440×900 the chip's painted left edge sits **5.38px** from the tape's painted right edge — the tightest relationship on the whole card, and 42.4px / 27.4px at 390 and 360 where the card is wider. Nothing overlaps and the vertical clearance is 12.91px, so this is a look-at-it item, not a defect: §9 step 8's eyeball checklist names it explicitly so the browser pass is looking for something specific.
- **`.cardTop` overflows its own content box by 1px in the done state, and that is expected** *(nit n-2)*. `scrollWidth 247 / clientWidth 246`, because the rotated chip's bounding box exceeds its layout box. It is absorbed by `.card`'s 20px side padding, and `documentElement.scrollWidth === innerWidth` at all three viewports — no page-level horizontal scroll anywhere. Stated so a later reviewer does not read the 1px as a defect and "fix" it by dropping the rotation, which is a DESIGN.md signature.
- **No overlap with `.cardTitle`, and no reserve spent on it.** Revision 1 put `padding-right` on `.cardTitle` for a chip a reviewer measured as ending **8.91px above it**. The reserve bought nothing and cost ~85px of a 246px measure — enough to wrap `Nonogram` on one card and not the other three, in **both** states, on the ~99% of visits with no record. **`.cardTitle` is untouched.**
- **The desktop card is the binding case and it fits with slack.** *(Finding D-02: revision 1 reasoned about the 390px viewport and called it tight.)* `.cards` collapses to one column below 768px (`:407-409`), so the tight case is **desktop**: `.page` is `max-width: 760px` with 80px padding → 600px content; two columns with a `var(--space-6)` = 24px gap → **288px cards**, 62px narrower than mobile. Content measure = 288 − 2×20px (`padding: … var(--space-5) …`) − 2×1px border = **246px**. The widest chip is `Jogado`, measured **81.52px** desktop / 75.42px mobile. The widest kicker is `Palavras` (8 chars; the four are Palavras, Números, Imagem, Lógica), **measured 72px** — revision 2 estimated 67 arithmetically. 72 + 12 (gap) + 81.52 = **165.5px against 246px — 81px of slack** (revision 2 said 85.5). Round 2 measured the whole row at 1440×900, 390×844, 360×800 **and 320×700**: no kicker wraps, no title wraps, `Nonogram` is 130.34px against the 246px measure, and the chip stays wholly on `--paper-card` at every width. **The failure mode if a future kicker is longer is a wrapped kicker, never occlusion**, because both boxes are flex items in one row.
- **No `text-occlusion` exposure at all**, so the detector's blindness at 0.286 stops being a risk this plan has to reason about.

**The cost, stated plainly and with the measured numbers.** `--text-kicker` is `600 11px/1` (`packages/ui/tokens.css:22`), so the kicker's line box is 11px today. The row is 24px. **Every day card grows by 13px, in both states, permanently:**

```
1440x900  baseline card 288x104  → done 288x117
390x844   baseline card 350x104  → done 350x117
360x800   baseline card 320x104  → done 320x117
```

**+13px, +12.5%.** *(Corrected at revision 3 — major R2-M5. Revision 2 wrote "a 288 × 95 card becomes ≈ 288 × 108" in D6 **and** in §5's decision to Fernando. The delta was right; both absolutes were 9px wrong, because `95` is round 1's D-01 figure, taken on a shell with no `globals.css`, where `.cardTitle` falls back to `line-height: normal`. That is finding **D-11 exactly** — revision 2 wrote D-11's fix into §11's fixture spec while carrying D-11's number into the decision it hands to the principal.)*

**And the cost is not only height** *(round 2's first correction to how this is stated)*. With the row at 24px and the kicker's line box at 11px, the kicker gains 6.5px of leading on each side: the card's optical top padding goes 24 → **30.5px** and the kicker-to-title gap goes 8 → **14.5px**. The card's internal vertical rhythm changes in the **pending** state — the state 99% of visits see — and revision 2 left that unsaid.

**What the 13px is actually the price of** *(round 2's second correction)*. Revision 2 called it *"the price of deleting the reserve"* / *"of not having a corner stamp with a reserve constant"*. That is not accurate, and the record should carry the real alternative set: zero CLS here does **not** require a `min-height`. Negative block margins (`margin-block: -6.5px` on the chip) would keep the row at the kicker's 11px in both states while the chip overhangs into the 24px card padding above and the 8px title margin below — and the measured headroom for exactly that is 12.9px above and 6.4px below. **This is not a request to change the shape.** Fernando chose the in-flow row, it is the safer of the two, and an overhanging chip re-opens the paint-order and clearance questions D6 exists to close. But 13px is the price of *this particular* way of getting zero CLS, not of having no corner stamp, and §5 decision 3 says so.

**The impeccable rules at risk, each retired with the actual predicate** (read out of `impeccable@3.4.0`'s `cli/engine/rules/checks.mjs`; the survey is completed at revision 2 per finding D-09):

- **`nested-cards`** — **[C3]**: there is no rule id `card-inside-card`; the id is `nested-cards` (`cli/engine/registry/antipatterns.mjs:79`). Card-likeness is `(hasShadow || hasBorder) && (hasRadius || hasBg)` where `hasBorder` is a **class-string** test (`:3887`, `:4161`) and never a stylesheet border. The chip declares no `box-shadow`, no `background`, and its CSS-module class name contains no `border` token — not card-like at its first line. It is then skipped again by `if ((el.textContent?.trim().length || 0) < 10) continue` ("Feito" is 5, "Jogado" 6) and by `if (rect.width < 50 || rect.height < 30) continue` (height 24). Cannot fire. *(The `position === 'absolute'` skip revision 1 also cited no longer applies and is not needed.)*
- **`hero-eyebrow-chip`** requires `headingTag === 'h1'` **and** `headingFontSize >= 48` (`checks.mjs:416`, `:422`), then inspects that h1's `previousElementSibling`. The day page's only `h1` is `.title` inside `.titleBlock`, with no previous element sibling; the cards contain no heading. Cannot fire.
- **`kicker-above-heading`** collects `h1`–`h4` and `[role="heading"]` (`:2492`) and reads `previousElementSibling`. **The day card's title is a `<p className={styles.cardTitle}>`.** Cannot fire — and that is a **hard rule**: `.cardTitle` may never become a heading and may never take `role="heading"`, exactly as `late-result.tsx:160-165` records for `.word`. Promoting it would light the shipped `.cardKicker` as a kicker instantly, with or without this ticket.
- **`all-caps-body`** fires on `hasDirectText && textLen > 30 && textTransform === 'uppercase'`, exempting `h1`–`h6`. The chip's text is a fixed 5- or 6-character literal and — unlike the `Mês anterior · <mês>` bomb of napkin item 9 — **not a template**, so no date can grow it.
- **`layout-transition`** bans transitions on layout properties. The chip declares no `transition` and must not gain one.
- **`text-occlusion`** *(added at revision 2)* — the detector's name for revision 1's R4. Its 0.45 occluder bar sits above the 0.286 a reviewer measured for the corner design, i.e. it would not have caught it. Under D6 nothing overlaps, so the rule is inert rather than merely lenient.
- **`border-accent-on-rounded`** *(added)* — needs a dominant edge; a uniform 1.5px border on all four sides has none. Cannot fire.
- **`undersized-ui-text`** *(added)* — the gate is `< 11`; the chip is exactly 11. Passes, with zero margin, at both viewports. This is why the mobile override takes the tighter padding and **not** F2:38's 10px type.
- **`wide-tracking`** *(added)* — exempts uppercase. The chip is `text-transform: uppercase`, so its 0.12em is exempt. (`.monthNavMonth`'s comment in this same sheet records the other half of that rule.)
- **`cramped-padding`** *(added)* — both arms miss on a 24px-tall inline label.

**DESIGN.md's section-5 anti-references are law independent of the detector, and each is checked** *(finding: the detector's predicate is not an argument about them)*: no gradient, no glassmorphism, not card-in-card under any reading, no grey-on-colour, no icon tile, no mascot or emoji, no diffuse shadow, not Inter. **None breached.**

**The sheet's own card-inside-card comment, answered in its own voice** *(finding m-17)*. `arquivo.module.css:105-108` argues the rule for this very file — *"BARE on desk paper, never a card. A day row inside a card inside a section is exactly how card-inside-card happens, which the anti-references ban"* — and `day-view.tsx:19-23` repeats it. This ticket adds a second bordered box inside a card in that same sheet, so it owes the distinction rather than a silence: **a stamp chip is not a nested card.** It carries no background, no shadow and no independent destination; it is a mark *on* the card the way a postmark is a mark on an envelope, and `DESIGN.md:48` prescribes exactly this object for this register. The banned shape is a *container* that repeats the card's own affordances one level down; a 23px inline label with a 1px ring is not one — which is also why `impeccable`'s `nested-cards` predicate cannot fire on it (above, three independent skips).

**Two uppercase micro-type runs land on one line for the first time on this sheet, and it was looked at** *(nit n-3)*. The chip inherits `font-weight: 400` from `body` while `.cardKicker` is 600 — two 11px uppercase runs, 12px apart, at different weights. Screenshotted at 1440×900: the ring plus the `--ink` / `--ink-2` split carries the difference and the chip reads as a stamp rather than as a second kicker. No declaration is added for it; it is recorded because it is the kind of thing that reads as an oversight when it was a choice.

**Vocabulary** *(finding D-10)*: DESIGN.md reserves **"Completion stamp"** for the 150 × 150 postmark (`DESIGN.md:39`). This is the **Game-card chip** (`DESIGN.md:48`). It is called a chip throughout, and `docs/design/006-*` has no archive frame — the done state appears only on the hub card, **in flow**, which is now also where this one is. D6 is therefore no longer a new placement class; it is the shipped one applied to a second card.

### D7 — Retention and cross-tab pruning: absence is accepted **silently**, and both paths are recorded. *(Gains the prune path and an explicit subscription decision at revision 2 — finding F4.)*

`prunePlayRecords` keeps the 50 most recent settled records dated before the mount's keep-date (`apps/web/src/play/play-record.ts:574`, `:617-647`; ADR-0053 decision 14), so a day page for an older solved date can legitimately show no chip. Likewise a browser with no usable store (`playRecordsAvailable()`, `:433-435`).

**Position: no copy, no caveat, no "we may have forgotten" line.** ADR-0031 decision 2 makes absence render as the neutral default and nothing else, and its Rejected list refuses *"treating the absence of a record as 'not done' authoritatively"* — a hedge sentence is the same move wearing an apology. ADR-0053 decision 10 layer 3 already owns this gap. It is documented in `card-status.ts`'s header and in ADR-0056's consequences, and nowhere in the UI.

**The subscription, and the flip it opens** *(new at revision 2)*. Revision 1 justified subscribing with the sentence *"one subscription mechanism, so a settled sync can never reach one reader and not the other"*, carried over unexamined — and attributed it to `day-state.ts:122-125`, where it is not: the string is `apps/web/src/play/use-record-snapshot.ts:74-75`, and `day-state.ts:123-125` is a different sentence *(finding m-8)*. It does not transfer: `sync.ts` moves `pendingSync` and `syncOutcome`, and this projection branches on `concluded` and `outcome` only (D2, F5 below). **The reason that does apply** is a *second tab* concluding the archived game while this page is open — `subscribeToPlayRecords` (`use-record-snapshot.ts:77-84`) is a 1s poll **plus** a `storage` listener, and `storage` fires only in other tabs.

The same mechanism opens a **done → pending flip**: `prunePlayRecords` runs on **every play mount** (`use-play-lifecycle.ts:141`). Tab A sits on `/arquivo/2025-11-02` with a chip; tab B opens `/sudoku`; the prune drops a record beyond the 50th, fires `storage`, and **tab A's chip disappears while the player is looking at it — and its accessible name flips with it**, from `cardAriaDone` back to `cardAria` (*"Jogar …"*), on an `<a>` that may be focused *(added at revision 3 — major R2-M8; D3 narrows its monotone invariant to hydration for the same reason)*. Same-tab paths are safe (day-page-D → archive-play-D prunes with `keepDate = D`, and `record.date < keepDate` is false against itself).

**Decision: keep the live subscription; add no latch.** Written reasons, since a reviewer named the alternative:

1. The subscription is not a choice here. `useRecordSnapshot` subscribes; using the repaired hook directly (D1) means taking its mechanism. Forking a no-op-subscribe-with-teardown variant (`usePriorConclusion`'s shape) to avoid a 1s poll on a page that writes nothing would mean a second reader class in the same module — the exact thing S1's repair exists to avoid.
2. The direction is the **understating** one, which ADR-0031 decision 2 permits by name: after the prune the device genuinely no longer holds the record, so `pending` is the honest answer and the page now agrees with what a reload would render. A latch would make the chip outlive the record it claims to read — a stronger claim than the device can support.
3. It is not an ADR-0031 violation and it is not a false done; it is an unrecorded UI event, and revision 2's answer is to record it (ADR-0056 consequence (b)) rather than to suppress it.
4. The conjunction required — more than 50 settled past records, a concurrent tab, *and* the pruned record being the one on screen — is rare, and every other `useRecordSnapshot` consumer on `main` carries the identical theoretical flip today with no latch.

**F5 — `pendingSync: true` and `syncOutcome: "rejected"`: decided.** *(Round-1 finding F5 flagged these as reachable on an archive date and unaddressed; `messages.archive.result.rejected` is shipped copy at `apps/web/src/i18n/messages.ts:533-534`.)* **The chip renders `Feito` on a rejected record, deliberately.** The chip is device state about *this device's board*: `concluded: true` means this device finished it, which is true whether or not the server stored a row. Branching on `syncOutcome` would make the chip an authority on **server** state — precisely what ADR-0031 decision 6 forbids and what ADR-0053 decision 10's "why no endpoint" argues against. The archive's own result panel owns that truth and says it in a full sentence one tap away. The hub's `entryFor` (`day-state.ts:165-181`) ignores both fields for the same reason, so the two surfaces agree.

**How this is checked, and why revision 2's version checked nothing** *(major R2-M7)*. Revision 2 said `T-WEB-S215`'s matrix *"asserts the archive and the hub answer identically, so this decision is checked rather than merely written."* **Agreement is invariant under both sides being wrong.** If a later edit made `entryFor` branch on `syncOutcome === "rejected"` → `pending`, the drift test would simply force `archiveCardStatus` to follow, S215 would stay green, and F5 would reverse silently — which is the one failure mode a drift test cannot see by construction. So **S215 carries an absolute arm as well as an agreement arm**: `expect(archiveCardStatus(rejected)).toBe("completed")` and the same for `pendingSync: true`, on the value, not on the comparison. Two notes the matrix owes, both from round 2: the `won-termo` / `lost-termo` shapes are meaningless for the three grid games, so **12 of the 28 cells duplicate `concluded`** and the matrix should say so rather than implying 28 independent facts; and both termo shapes must be built with `concluded: true` or the `lost` arm is vacuous.

### D8 — Bundle: measured with a procedure that can actually produce the measurement. *(Rewritten at revision 2 — findings M1-test, B1-ADR.)*

`/arquivo/[data]` is BUDGETED at the shared `MAX_DELTA_BYTES = 40 * 1024`. This ticket gives it `day-card.tsx`, `card-status.ts`, `use-record-snapshot.ts`, `accent.ts` and `play-record.ts` (which imports **only** `@miolos/core` and `zod` — verified by reading its import block).

**Two separate claims in `route-client-js.mjs`, and revision 1 conflated them.**

**(i) `:216-219` is falsified unconditionally, and no measurement can save it.** Verbatim: *"The index, the month page and the day page ship near-zero client JS and ride the shared 40 KB with enormous slack — measured at -38.7 KB against `/` … They are BUDGETED anyway, because 'ships nothing today' is precisely the route that acquires a library silently."* After this ticket the day page does not ship near-zero client JS — this plan's own ADR-0056 consequence says the archive's client graph gains `play-record.ts` (zod + `@miolos/core`) for the first time. **The comment was written to be re-checked by the first ticket that put JS on these routes, and this is that ticket.** The edit is unconditional and is §7(c1).

**(ii) `:53-56` is a different claim and it is conditional.** *"The chunk carrying `messages` is absent from `/_not-found`, `/arquivo`, `/arquivo/mes/[mes]`, `/arquivo/[data]` and `/modo-livre`."* Under D5 the client component imports no `messages`, so the prediction is that it survives — but a prediction is not a result.

**The measurement, and it is not `pnpm bundle-check`** *(finding M1-test)*. `bundle-check` prints a First Load JS table with deltas, chunk-attribution counts and marker presence checks, and its markers are the Termo answer/dictionary sets. **Nothing in its output says which chunk carries `messages`.** The procedure that does, reusing the script's own mechanism (`route-client-js.mjs:604` already does `readAll(entry.firstLoadChunkPaths.map(normalize))`):

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null \
  && cd apps/web && rm -rf .next && pnpm build && pnpm bundle-check
# then, over the same build — the SAME cwd, `apps/web`, because every path
# below is resolved relative to it (R3-m4: revision 3 wrote this line bare
# under a "run from the repo root" section header, where `./.next/...` does
# not exist):
source ~/.nvm/nvm.sh && nvm use default >/dev/null && cd apps/web && node -e '
  const { join } = require("node:path");
  const fs = require("node:fs");
  const s = require("./.next/diagnostics/route-bundle-stats.json");
  const routes = s.routes ?? s;
  // messages.ts:264 — `conclusion.ctaHome` (the `conclusion:` block opens at
  // :183; `hoje:` is :107-173, and :174 is the doc comment above `play:`).
  // One literal, in messages.ts and nowhere else.
  const marker = "Fechar o dia — voltar para Hoje";
  const scan = (route) => {
    const e = routes.find((r) => r.route === route);
    if (!e) throw new Error(route + " is missing from the stats file");
    // `join(path)`, exactly as the script normalizes (route-client-js.mjs:519)
    // — the stats file and the disk walk spell the same chunk differently.
    const paths = e.firstLoadChunkPaths.map((p) => join(p));
    const read = paths.filter((p) => fs.existsSync(p));
    if (read.length === 0) throw new Error(route + ": no chunk could be read — vacuous");
    return { route, chunks: paths.length, read: read.length,
             messagesChunks: read.filter((p) => fs.readFileSync(p, "utf8").includes(marker)) };
  };
  console.log(JSON.stringify([scan("/arquivo/[data]"), scan("/")], null, 2));
'
```

**Three things revision 2's probe did not have, all of them findings** *(major R2-M12, nit m-9)*:

1. **The script's own path mapping.** `route-client-js.mjs:519` is `const normalize = (path) => join(path);` and `readAll` (`:556` — re-derived at revision 4 against the file, where round 3 read `:557`; `:557` is the blank line under it) reads the result straight off disk — `firstLoadChunkPaths` are already disk-relative. Revision 2 substituted `p.replace(/^\/_next\//, ".next/")`, which is a mapping the script never performs; if the stats file does not spell paths `/_next/…`, **every `existsSync` is false, `messagesChunks` is `[]`, and the plan reads that as confirmation of its own prediction.** D8 claimed to reuse the script's mechanism and did not.
2. **Anti-vacuity, which this repo treats as first-class everywhere else** (`route-client-js.mjs:537-543` exits 2 on an empty chunk set; `ink-on-accent.test.ts:274-282` is an anti-vacuity arm; §11 mandates controls). The probe now throws if the route is missing or if no chunk could be read.
3. **A positive control.** `/` is scanned in the same run and **must** come back non-empty: the hub's client components import `messages`, so a run where both routes report `[]` is a broken probe, not a green result.

Run **from `apps/web`** — from the root `bundle-check` exits 0 silently (napkin item 2) — and paste both outputs. `/arquivo/[data]` → `messagesChunks: []` **with `/` non-empty** keeps `:53-56` as written; a non-empty array on `/arquivo/[data]` corrects it in the same commit with the new figures, per napkin item 5. If the probe throws and cannot be made to run, **the branch is not pre-decided**: report the measured delta against −38.7 KB and say in the PR body that `:53-56` was not re-measured. Either way `MAX_DELTA_BYTES` is **not** raised (the script's own standing rule) and the route's delta is stated against the −38.7 KB baseline.

### D9 — Test-id allocation, and which existing tests widen. *(Rebuilt at revision 2 — findings B3, F1, m4, m6, S10.)*

**Reserved: `T-WEB-S213 … T-WEB-S224`.** *(Finding S10: revision 1 called this "the ticket's pre-assigned range". `gh issue view 96` assigns no range. The range is this plan's own allocation, per `docs/agents/test-ids.md:15` — "A plan reserves a contiguous per-area range up front and states it".)*

**Frontier, re-derived by grep at the end of this revision** (the third independent derivation; round 2 did two), with the doc's own titles-only command plus the numeric re-sort §9 step 14 now mandates — `docs` is deliberately excluded so a cross-reference in a plan is not mistaken for an allocation:

```
$ grep -rhoE "T-WEB-S[0-9]+[a-z]?" apps packages | sort -u | sort -t S -k2 -n | tail
T-WEB-S202  T-WEB-S203  T-WEB-S204  T-WEB-S205  T-WEB-S206  T-WEB-S206a
T-WEB-S207  T-WEB-S208  T-WEB-S209  T-WEB-S212
```

Highest in use **S212** (`apps/web/test/og-image.node.test.ts:712`); `S210`/`S211` absent from source, consistent with `docs/agents/test-ids.md:120`'s burned tails. **Next free: `S213`**, matching the table at `docs/agents/test-ids.md:41`. The range `S213…S224` is clean.

**`apps/web` puts its ids on `describe(...)`, never also on `it(...)`** — the shipped convention (`docs/agents/test-ids.md:5`), and shipping them on both was step-6 finding F18 on the last archive PR *(finding m6)*.

| id | claim | file |
|---|---|---|
| **S213** | `useRecordSnapshot` is **N-consumer safe**: four games on one date, and two dates on one game, render together with no `Maximum update depth` and each reads its own record | `test/record-snapshot.test.tsx` (new) |
| **S214** | the snapshot cache's bound, in the two forms a test can actually hold *(rebuilt at revision 3 — R2-M6)*: **(a) a floor** — `SNAPSHOT_CACHE_LIMIT >= GAMES.length * 2`, with `GAMES.length * 2` simultaneous consumers rendering stable; **(b) a consumer inventory** — the set of files under `apps/web/src` and `apps/web/app` containing `useRecordSnapshot(` equals a pinned list, so a **new call-site file** reds this test and forces the bound to be re-derived. **This ticket adds `app/arquivo/day-card.tsx` to that list** and re-derives the live maximum 2 → 4 against the bound of 16 (§9 step 7). *(Reworded at revision 4 — finding F-1: it pins call-site **files**, not mounts. A surface that reuses `day-card.tsx` — the month page, 31 days × 4 games — adds no file and stays green. Mount-count growth is held by review and by ADR-0056 decision 1, as §2.2 says.)* | `test/record-snapshot.test.tsx` |
| **S215** | `archiveCardStatus` and the hub's `readDayState` **read the same record the same way** — every game × {absent, unconcluded, concluded, won-termo, lost-termo, `pendingSync: true`, `syncOutcome: "rejected"`} — **plus an absolute arm** *(R2-M7)*: `archiveCardStatus` returns `"completed"` on `pendingSync: true` and on `syncOutcome: "rejected"`, asserted by value rather than by agreement | `test/archive-done-chip.test.tsx` (new) |
| **S216** | **absent-first**: the server render of the day view with records seeded reads no `localStorage` and no clock, and contains neither chip word | `test/archive-done-chip.test.tsx` |
| **S217** | the chip renders on the concluded game's card and **on no other**, publishes **no duration**, and **carries `aria-hidden`** *(finding m-7: round 1 raised this and revision 2 did not answer it — the chip's `aria-hidden` is argued twice in the plan and asserted nowhere, and D5's rejection of the smaller boundary turns entirely on it. One line.)* | `test/archive-done-chip.test.tsx` |
| **S218** | a **lost** archived Termo renders *Jogado* and never *Feito*; a won one renders *Feito* | `test/archive-done-chip.test.tsx` |
| **S219** | the card's **accessible name** is `cardAria` in the server markup and `cardAriaDone`/`cardAriaPlayed` after hydration; a pending card keeps `cardAria` in both; **and the done and played names differ** *(R2-M3)* | `test/archive-done-chip.test.tsx` |
| **S220** | **never a server read**: `globalThis.fetch` is a throwing spy and never fires, in either state | `test/archive-done-chip.test.tsx` |
| **S221** | the chip sits in a **flex row whose height is the chip's declared box**: `.cardTop` is `flex`/`space-between`/`center` with `min-height: var(--done-chip-box)`, `.doneChip` declares **no** `position`, and `--done-chip-box` equals `2×border + 2×padding + pixels(font-size) × Number(line-height)` — **with `line-height` required to be unitless**, and the arm **run twice**: at top level against the constant, and inside the `@media (max-width: 768px)` block asserting the mobile box is **≤** the constant *(rebuilt at revision 3 — R2-M1, m-5)* | `test/archive-done-chip.test.tsx` |
| **S222** | the archive chip words **are** the hub's own consts **and are the expected literals** — two identity assertions plus two value assertions per word *(rebuilt at revision 3 — R2-M4; revision 2's "both directions" form was two reference identities on one binding and could not fail)* | `test/archive-copy.test.ts` |
| **S223**, **S224** | **reserved review-round headroom.** Burned if unspent, per `docs/agents/test-ids.md`'s own rule | — |

**Widened in place, no new id** — the `T-WEB-S100` burn precedent (a row added to an existing suite carries no id):

- **`T-WEB-S73`** (`test/ink-on-accent.test.ts:198`) — the *"keeps the two accent rings"* arm at `:343-359` becomes **a scan with a closed five-site list**: the four accent rings (the two it names today, plus `arquivo.module.css`'s new `.doneChip` and the pre-existing `late-result.module.css:90` postmark) and `screen.module.css:292`'s accent-**filled** `.hint`, which the same pattern matches and which is `T-WEB-S72`'s business. D4 states why and carries the per-paper figures the rewritten comment needs. The `SHARED` list already carries `app/arquivo/arquivo.module.css` (`:212`), so the *"no accent colours a word"* scan at `:256-262` needs no edit.

**One id, two claims — flagged rather than split** *(finding m-14)*. `T-WEB-S217` carries *"the chip renders on the concluded card and no other"* **and** *"publishes no duration"*, and revision 3 adds *"carries `aria-hidden`"*. Per `docs/agents/test-ids.md:20` that is the shape that later needs a sibling letter — *"a new letter is opened only when the previous space has become ambiguous"*. It is not ambiguous yet: all three are one claim about what the done card renders, asserted in one render. If a step-6 reviewer wants it split, `T-WEB-S217a`/`S217b` is the move and `S223`/`S224` stay reserved for other things.
- **`T-WEB-S181`** (`test/archive-copy.test.ts:40-82`) — the *"every archive string is reachable"* arm gains the four `archive.day.*` keys. The `copy.result` (`:55-65`) and `copy.meta` (`:66-75`) exact lists are **untouched** (**[C1]**). The pt-BR literal scan at `:84-97` walks `app/arquivo/**` and `src/archive/**`, so `day-card.tsx` and `card-status.ts` are inside it and neither may carry a quoted accented run. Under D5 they carry no copy at all; it is stated because it is the thing that would go red if a later fix hard-codes a word.

**Must stay green, no edit and no new assertion:**

- **`T-WEB-S184`** (`test/archive-day.test.tsx:52`) — the day page's shipped assertions through the boundary move. *(Finding m4: revision 1 listed this under "widened in place" while also saying "no new assertion". It is a must-stay-green, and now sits in the right list.)*
- **`T-WEB-S183`** (`:267`) — the new modules enter the graph and must not trip the four bans (D1a is the live one).
- **`T-WEB-S56`** (`test/route-ssr.test.tsx:410`) — `/arquivo/[data]` is already a row (`:355-357`). **It is not a guard on this ticket's boundary** (D5, finding F1) and no row is added to its `ROUTES` table.
- **`T-WEB-S72`** (`test/ink-on-accent.test.ts:31`) — *(finding B3: revision 1 cited this as the gate on D4's claim in four places. Its only scan tests `background: var(--accent)` + `color: var(--paper-desk)` and says nothing about accents colouring words. The gate is `T-WEB-S73`.)* Listed only so the correction is on the record.
- **`T-WEB-S20`** (`test/conclusion-view.test.tsx:623-629`) — *(added at revision 3, blocker R2-B4's class.)* Its docblock says *"The snapshot cache is module-level — one browser has one `localStorage` — so … a cache keyed on `date` alone would hand the second route the first one's record."* Both halves stay **true** after D1: the cache is still module-level and still keyed `{game, date}`. Listed because the reverse sweep found it and silence is indistinguishable from having missed it (§7 u).
- **`apps/web/test/use-record-snapshot.test.ts`** — *(added at revision 3, blocker R2-B4.)* It drives `sameToTheReader` through the hook, so the repair runs under it directly; and its docblock at `:24-25` is **falsified** and takes a one-sentence edit (§7 t).
- The whole `apps/web` suite, which the D1 repair touches through every conclusion, the hub and the late-result panel. Baseline before any change: **75 files, 1102 tests passed** (§2.2). The gate is *"all 1102 still pass, plus this ticket's new ones"* — never a target total.

---

## 4. TDD seams

Seven seams. CLAUDE.md step 5 drives with `/implement`; each seam's test goes **red first**, against nothing or against a deliberately wrong implementation, and the seam is done when it is green and the ones before it still are.

**Three of these are guards rather than design-driving reds, and are labelled so** — seams **2**, **4** and **7** *(finding F7/m2/m3 — revision 1 presented all six as reds; revision 2 named two and finding **m-6** measured that seam 4 is a third: before `day-card.tsx` exists, `ArchiveDayView` renders no chip at all, so all three of its assertions pass against the shipped tree. It is worth writing anyway — it is the absent-first contract — but calling it a red would be a paste of a green)*.

| # | Seam | Red first | The assertion that must fail before the code exists |
|---|---|---|---|
| 1 | **the cache repair** | `T-WEB-S213` | Four `<Probe game={g} date={D}/>` plus two `<Probe game="sudoku" date={…}/>` on different dates, **each asserting its own record per key rather than merely "no throw"**. **Against the shipped single-slot implementation it throws `Maximum update depth exceeded`** — §2.2's measured failure, now a permanent guard. Green means: no throw, each probe reads its own record. A genuine red — **provided the tree is clean when it is written**, which §9 step 2 checks with pasted output before the seam is started (R2-B2). |
| 2 | **the cache bound** | `T-WEB-S214` | `expect(SNAPSHOT_CACHE_LIMIT).toBeGreaterThanOrEqual(GAMES.length * 2)` plus `GAMES.length * 2` live consumers rendering clean, **plus the consumer inventory** (D9): the set of files calling `useRecordSnapshot(` equals a pinned list. Red if the constant is not exported, is set below the floor, or **a new call-site file** appears without the bound being re-derived — *not* if an existing call-site file is reused by a new surface, which is the inventory's stated limit (§2.2, F-1). A **guard**, not a design red: seam 1's implementation already satisfies the first two arms. |
| 3 | **the status projection** | `T-WEB-S215` | For each game × each of {absent, unconcluded, concluded, won-termo, lost-termo, `pendingSync: true`, `syncOutcome: "rejected"`}: `archiveCardStatus(readPlayRecord(game, date))` `toBe` `readDayState(date)[game].status`, **and** `archiveCardStatus` `toBe("completed")` by value on the two sync shapes (R2-M7). Red until the Termo `outcome === "lost"` arm exists — the arm a naive `concluded === true` predicate omits. A genuine red. |
| 4 | **absent-first** *(a **guard** — m-6)* | `T-WEB-S216` | **Seed, then spy** — `writePlayRecord(concludedSudoku())` *first*, then `vi.spyOn(Storage.prototype, "getItem")` and `vi.spyOn(Date, "now")`; then `renderToStaticMarkup(<ArchiveDayView date={D} games={GAMES}/>)`; assert **neither spy fired** and the markup contains neither `copy.day.done` nor `copy.day.played`. Red against any implementation that reads the store in a component body or omits the server snapshot. |
| 5 | **the render contract** | `T-WEB-S217`, `T-WEB-S218`, `T-WEB-S220` | `writePlayRecord(concludedSudoku())`, render, `within(cardFor("sudoku")).getByText(done)`; `queryByText(done)` null on the other three; `container.textContent` matches no `\d\d:\d\d`. Then a lost termo record → `getByText(played)` and `queryByText(done)` null. `globalThis.fetch` stubbed to throw, asserted never called, in both states. The chip's `aria-hidden` asserted once (m-7). Red against a one-verb chip, against a chip keyed off `concluded` alone, and against any future fetch. |
| 6 | **the accessible name** | `T-WEB-S219` | `renderToStaticMarkup` contains `cardAria(name, longDate)` and not `cardAriaDone`; after `render`, `getByLabelText(cardAriaDone(name, longDate))` resolves and `queryByLabelText(cardAria(name, longDate))` is null for that card; **and `expect(copy.day.cardAriaDone(g, d)).not.toBe(copy.day.cardAriaPlayed(g, d))`** (R2-M3). Red against D5's rejected small-boundary design, which cannot change the label at all, and red against a played name that says the same thing as the done one. |
| 7 | **the row's geometry** | `T-WEB-S221` | Via `./css-source`, and **two passes, not one** *(m-5)*. Pass A, the top-level block: `decl(bodyOf(sheet, ".cardTop"), "display") === "flex"`, `"justify-content" === "space-between"`, `"align-items" === "center"`, `"min-height" === "var(--done-chip-box)"`; `decl(bodyOf(sheet, ".doneChip"), "position") === undefined`; and the arithmetic — `2×1.5 + 2×5 + 11 × 1 === 24`, with `line-height` **required unitless**. Pass B, the `@media (max-width: 768px)` block's `.doneChip`: the same formula, asserted **≤** the constant (22 ≤ 24). **Every term's extraction shape is named below, because two of them throw if read the obvious way** (R3-m2). A **guard**. jsdom has no layout (`test/css-source.ts:5-21`), so this is the only mechanical form the claim has. |

*(Revision 1's seam 6 was unfalsifiable on all three of its claims — finding M3-test: an unpinned reserve value meant `--done-chip-reserve: 0px` passed, `.card { position: relative }` was never asserted so deleting `arquivo.module.css:304` would leave the seam green, and `.cardKicker` was named in D6 but only `.cardTitle` asserted. The design change deletes the first and third; the arithmetic answers the second.)*

**Seam 7's extraction shapes, term by term** *(new at revision 4 — finding R3-m2: revision 3 said "parse `border`/`padding`/`font-size`/`line-height` off `.doneChip`", and `pixels()` (`test/css-source.ts:82-88`) requires `^-?[\d.]+px$`, so two of those four throw)*. `sheet = stylesheet("app/arquivo/arquivo.module.css")`:

```ts
const chip = bodyOf(sheet, ".doneChip");
// `--done-chip-box: 24px` on `.card` — a bare px length, so `pixels` reads it directly
const box = pixels(decl(bodyOf(sheet, ".card"), "--done-chip-box"));           // 24
// `border: 1.5px solid var(--accent)` — a SHORTHAND. `pixels(decl(chip, "border"))`
// throws; take the width term.
const border = pixels(decl(chip, "border")!.split(/\s+/)[0]);                  // 1.5
// `padding: 5px var(--space-3)` — a SHORTHAND whose second term is a token.
// `pixels(decl(chip, "padding"))` throws; the vertical term is the first.
const padY = pixels(decl(chip, "padding")!.split(/\s+/)[0]);                   // 5
const fontSize = pixels(decl(chip, "font-size"));                              // 11
const lineHeight = Number(decl(chip, "line-height"));                          // 1
expect(Number.isNaN(lineHeight)).toBe(false);   // unitless, or the product is meaningless
expect(2 * border + 2 * padY + fontSize * lineHeight).toBe(box);               // 24
```

**Pass B needs a nested `bodyOf` and a `token()`**, and both are verified against the helpers rather than assumed: `bodyOf` line-anchors its prelude and `escape()` (`test/css-source.ts:104-106`) escapes the parens, so `bodyOf(bodyOf(sheet, "@media (max-width: 768px)"), ".doneChip")` resolves — the media block opens at `arquivo.module.css:365`, at column 0. The mobile override carries **`padding` only**, so `border`, `font-size` and `line-height` come from the top-level block above; and its vertical term is `var(--space-1)`, not a px length, so it is read with `token("--space-1")` (→ 4, `packages/ui/tokens.css:44`) and never with `pixels`. Declared mobile box = `2 × 1.5 + 2 × 4 + 11 × 1` = **22 ≤ 24**.

*(**Revision 2's seam 7 had two holes its claim did not admit — finding m-5, and both are closed above.** (i) The **mobile override was invisible to it**: `bodyOf` matches the first line-anchored block, so bumping the `@media` padding to `var(--space-2) 9px` would give a 30px box inside a 24px row with every assertion still green — hence pass B. (ii) The formula used `font-size` alone, so changing `line-height: 1` → `1.5` passed while the row went 5.5px short — hence the `× Number(line-height)` term and the unitless requirement. A guard that cannot see the two edits most likely to be made to the thing it guards is not a guard.)*

*(Revision 1's seam 3 installed its spies **before** the seed — finding M4-test. `writePlayRecord` goes through `store.getItem` (`play-record.ts:450`) and `setItem` (`:520`), so a spy installed first records the seed's own reads and fails against a **correct** implementation. The shipped idiom is seed → spy, `test/hoje.smoke.test.tsx:430-433`. Seam 4 above follows it.)*

**No `vi.mock` preamble is needed** *(finding m9)*. Every seam renders `ArchiveDayView({date, games})` directly — a synchronous server component taking two plain props, with no db access and no `next/navigation` call. `ArchiveDayPage` is what needs `archive-day.test.tsx:14-37`'s hoisted mocks, and it is the wrapper that fetches `games`; nothing in this ticket's contract lives there. `T-WEB-S184` covers the page wrapper and stays green.

**Both new files are `.tsx`** *(finding m1: `apps/web/test/archive-day-state.test.ts` could not have held a seam that renders JSX — verified, it fails at transform).*

`beforeEach` in both new files does `window.localStorage.clear()`. Fake timers are **only** `["Date"]` if used at all: the record store's 1s poll deliberately stays on real timers (`hoje.smoke.test.tsx:134-138`).

**Why not `apps/web/test/archive-day.test.tsx`, which the issue names** *(finding S11 — revision 1 stated the mechanism and never the reason)*. That suite has no `localStorage.clear()` in its `beforeEach` and is built around server-markup assertions on the page wrapper. A suite that seeds play records needs the clear, and adding one to a shipped file changes the conditions under which its 87 passing assertions run. The named file stays a must-stay-green rather than becoming the host; the new behaviour gets files whose setup it can own.

---

## 5. The product decisions Fernando can reverse

**Surface all four in the PR body. The first is the one that needs him.** *(A fourth block was added at revision 4 — finding R3-B5: chip-only-no-duration is a product decision Fernando took this session, and it reached D4, the ADR and a test but never the PR body, where the reversible product decisions are supposed to be surfaced.)*

> ### 1. The chip says `Feito` / `Jogado` — the hub's Game-card words — for a **late** completion.
>
> **What the glossary actually says**, quoted, because revision 1 of this plan got it wrong and a step-3 reviewer measured it (`grep -c "Concluído" CONTEXT.md` → **0**):
>
> | `CONTEXT.md` | Term | pt-BR | |
> |---|---|---|---|
> | `:11` | **Completion (on time)** | Conclusão | *"A daily solved during its own `America/Sao_Paulo` day. The only event that feeds the streak."* |
> | **`:12`** | **Late completion** | **Conclusão tardia** | *"A past daily solved from the archive. Recorded; never feeds streak, time stats or Dia Perfeito … a lost archived Termo is **played**, not completed."* |
> | `:13` | **Played** | Jogado | *"Reached a terminal state without winning. Only Termo can end here."* |
>
> `Concluído` is not in the file. Neither `Feito` nor `Concluído` is the glossary's archive term — **`Conclusão tardia`** is, and it is the term for every completion this chip can render.
>
> So the collapse is real and it is worth stating plainly: on the hub, *Feito* means an on-time completion that feeds the streak. On `/arquivo/<data>` the identical word will mean one that feeds nothing. The archive's own shipped copy says so one route away — `messages.archive.play.note`: *"Puzzle do dia arquivado. Não conta para a sequência nem para os seus tempos."*
>
> **The decision is to keep `Feito` / `Jogado`**, for cross-surface consistency: `arquivo.module.css:288-292` already declares the day card to be *"the hub's Game-card register (DESIGN.md 'Game card')"*, and this chip is that register's own component. The collapse is acceptable because the chip is **device state claiming nothing about the streak** — it says "you finished this here", which is true of a late completion — and because the surface that owns the distinction states it in a full sentence one tap away. `messages.ts:132-138` documents a deliberate register split for **one** word across two registers — the hub's capitalised chip `Jogado` against the day card's lowercase tabular `jogado` — so per-surface wording is a live convention here, not a slip. *(Revision 2 called it "a three-way split for two other done/played pairs", which overstates what the file documents — finding m-10 — and cited it one line short — m-11.)*
>
> **This is recorded as ADR-0056 decision 2**, not left in a plan. It is the one thing a future reader will need the reasoning for.
>
> **Reversing it is a one-line change**: split the shared const in `messages.ts` and update `T-WEB-S222`, which exists to make exactly this split deliberate. No component, no stylesheet, no test structure changes.
>
> **What is not reversible, and is not a copy question:** *two* verbs rather than one. A lost Termo showing *Feito* is a false done, which ADR-0031 decision 2 forbids by name. The issue's *"the chip says 'you played this', nothing more"* is honoured in substance — no time, no count, no streak, no medal — but not by collapsing the two verbs.
>
> *(Related, and worth one sentence: the visible chip reads **FEITO** while the accessible name reads *"Ver o resultado do Sudoku de …"*. That is not a WCAG 2.5.3 Label in Name issue — the label is the game name and the hub ships the same shape — but it is a real input to the register question rather than a purely typographic one. Finding D-08.)*

> ### 2. The plan repairs `useRecordSnapshot` instead of routing around it.
>
> A shared play-layer reader — used by every conclusion, the hub and the archive's result panel — gets a change to its cache that is **never larger than the code it replaces** and that fixes the defect for every future consumer. The alternative was ~50 lines of parallel projection in `src/archive` with zero blast radius outside it. §2.2 has the measurements, the full-suite green (**75 files, 1102 tests**) and the typecheck. **Nothing needs deciding here unless you want the smaller blast radius**, in which case revision 1's shape is on the record and recoverable.
>
> *(The size claim has been retracted twice. Revision 2 sold it as "net −2"; revision 3 as "net 0". Rebuilt to spec three more times at round 3 it measured **−1, −5 and −5**, with prettier changing none of them. So the claim is now the weakest one every measurement supports — **never larger than the code it replaces, and 0 to 5 lines smaller depending on the eviction guard's shape** — and it will not need retracting again. Nothing about the decision turns on which of those figures lands.)*

> ### 3. Every day card gets 13px taller, in both states, permanently.
>
> The chip sits in a flex row beside the kicker (D6), whose `min-height` is the chip's declared box (24px) against the kicker's 11px line. Measured, all three viewports: **`288 × 104 → 288 × 117` — +13px, +12.5%**, and it is paid on the ~99% of visits with no record too.
>
> **Three things about this cost that revision 2 stated wrongly and that you should have straight before deciding:**
>
> 1. **It is not only height.** The kicker gains 6.5px of leading on each side, so the card's optical top padding goes 24 → 30.5px and the kicker-to-title gap 8 → 14.5px. The pending card's internal rhythm changes, not just its bounding box.
> 2. **13px is the price of *this* way of getting zero CLS, not the price of having no corner stamp.** Negative block margins on the chip would hold the row at 11px in both states while the chip overhangs into the card's own padding (measured headroom 12.9px above, 6.4px below). That option exists; it was not weighed; it is more fragile. You chose the row and the row is the safer of the two — but the record should say what the real alternative set was.
> 3. **The archive chip is deliberately 23px where the hub's is 29.34px** (D6, R2-M2). Matching them means a 30px row and **19px** of growth instead of 13. If you want the two chips identical, that is the switch, and it is one constant plus one deleted declaration.
>
> **Reversing the placement entirely means going back to the absolute stamp**, which reopens findings D-01, D-02, D-04, D-05 and D-13 — a component and stylesheet change, not a one-liner.

> ### 4. The chip carries no time and no result figure — the hub's chip does.
>
> **Your call this session, recorded here because it is a product decision and not a technical one.** The hub pairs its `Feito` chip with `em MM:SS`, and the device's own record holds `elapsedMs`, so the archive could print it. It does not (D4), for three reasons that stack:
>
> 1. The archive's own shipped copy says the opposite one route away — `messages.archive.play.note`: *"Puzzle do dia arquivado. Não conta para a sequência nem para os seus tempos."* A published time on the day page contradicts the product's own sentence about what the archive does with times.
> 2. ADR-0031 decision 6 permits an **affordance** and forbids an **entitlement**. A chip is an affordance; a published figure reads as a statistic.
> 3. Termo publishes no duration on any projection at all (ADR-0045 decision 4, ADR-0044 decision 4), so a duration-bearing archive chip would need the hub's three-composer split for a figure this plan has already decided not to show.
>
> It is also what the issue asks for in as many words — *"the chip says 'you played this', nothing more"* — which this plan honours in substance while declining only its implied one-verb reading (decision 1).
>
> **Reversing it is not a one-liner, and that is the thing to know before choosing.** It needs a duration on the card's props, the hub's three-composer accessible-name split (`doneAria` needs an elapsed a played entry does not have), a new `archive.day.*` result key, and an edit to `T-WEB-S217`, which asserts the rendered card matches no `\d\d:\d\d`. It changes the register of the card from affordance to record — which is the same line ADR-0056 decision 2 draws between the stats calendar and this chip.

---

## 6. Every file that moves

**Created (5)**

| path | what |
|---|---|
| `apps/web/src/archive/card-status.ts` | D1's pure status function (~10 lines) |
| `apps/web/app/arquivo/day-card.tsx` | D5's client card, `"use client"` |
| `apps/web/test/record-snapshot.test.tsx` | `T-WEB-S213`, `S214` |
| `apps/web/test/archive-done-chip.test.tsx` | `T-WEB-S215`…`S221` |
| `docs/adr/0056-the-record-snapshot-cache-is-per-key.md` | §8 |

*(`docs/plans/043-issue-96-plan-archive-done-chip.md` — this file — and the two findings files, `046-issue-96-research-review-round-1-findings.md` and `047-issue-96-research-review-round-2-findings.md`, are already in the tree. All three are committed with the ticket; neither findings file is ever edited.)*

**Modified (14 files, 15 rows — `route-client-js.mjs` takes one unconditional edit and one conditional one, so it holds two rows)** *(finding S9: revision 1's header said "8, one conditional" over a table of nine plus the conditional. Re-counted against the table itself at revision 4 — **R3-m1: revision 3 said 13/14 over a table of 14 distinct paths and 15 rows**, having counted `route-client-js.mjs` once while listing it twice.)*

| path | what |
|---|---|
| `apps/web/src/play/use-record-snapshot.ts` | D1's cache repair + the rewritten docblock at `:32-42`, citing ADR-0056 |
| `apps/web/app/arquivo/day-view.tsx` | the `<li>` body becomes `<ArchiveDayCard …/>`; the pre-composed strings are resolved here. **`archiveGameRoute` stays**; only `accentVars` and `styles.card*` move with the card *(finding F2)* |
| `apps/web/app/arquivo/arquivo.module.css` | `.cardTop` + `--done-chip-box` on `.card` + `.doneChip` + `.cardKicker`'s `min-width: 0` + the mobile `.doneChip` padding override in the `:365` media block; the rule comment carries D4's figures |
| `apps/web/src/i18n/messages.ts` | hoist `"Feito"`/`"Jogado"` to consts; add the four `archive.day.*` keys |
| `apps/web/test/archive-copy.test.ts` | widen `T-WEB-S181`'s reachability arm; add `T-WEB-S222` |
| `apps/web/test/ink-on-accent.test.ts` | rebuild `T-WEB-S73`'s ring arm (`:343-359`) as a scan with a closed five-site list, four rings enumerated with per-paper figures — D4 |
| `apps/web/src/archive/use-prior-conclusion.ts` | **one sentence** — §7(b); its `:35` sentence *"for the same reason `use-record-snapshot.ts` keeps one"* is falsified by D1 |
| `apps/web/src/archive/late-result.tsx` | **one sentence** — §7(a); its `:111-112` *"its single-slot cache"* is falsified by D1 |
| `apps/web/src/play/day-state.ts` | **one sentence, no code** — §7(s); its `:186-190` *"The same cache `use-record-snapshot.ts` keeps, for the same reason"* is falsified by D1. The §1 carve-out, and the only reason this file is on the list |
| `apps/web/test/use-record-snapshot.test.ts` | **one sentence** — §7(t); its `:24-25` *"the cache is one module-level slot"* is falsified by D1 |
| `DESIGN.md` | one clause on `:48`'s Game-card entry — §7(j) |
| `docs/README.md` | the two "Current" rows (plan 043, ADR-0056) — a blocking review finding in four consecutive PRs, per the napkin |
| `docs/agents/test-ids.md` | at **step 8**: the spent range, the burned tails, the re-derived frontier |
| `apps/web/scripts/route-client-js.mjs` | `:216-219`'s *"ship near-zero client JS"* corrected with this ticket's measured figure — **unconditional** (§7 c1) |
| *(conditional)* `apps/web/scripts/route-client-js.mjs` | `:53-56` corrected **iff** D8's marker probe shows the `messages` chunk landing on `/arquivo/[data]` (§7 c2) |

**Deleted:** none.

---

## 7. Records — every ADR, test, comment and doc this touches or falsifies

Each row was re-opened against the real file at step 4.

**The two-way amendment check** (handoff 041 `:96` — *"every checklist row has ≥1 hit, every hit maps to a row — never a count"*) is applied in **both** directions: rows (a)–(v) below are direction (i), and **§7.1 is direction (ii)** — the four greps, run at step 4, with every hit mapped. Revision 1 applied only the first *(finding N5)*, which is exactly how blocker B1-ADR reached step 3 as a hit with no row.

**(a) `apps/web/src/archive/late-result.tsx:111-112` — FALSIFIED at revision 2, one sentence owed.**
Verbatim: *"Two archive dates cannot coexist (one page renders at a time), so its single-slot cache is a miss at worst and never a wrong answer."* Revision 1 kept this as a mere annotation on the strength of the comment's own prose. A step-3 reviewer measured that two dates against a date-keyed slot loop identically, so the sentence was doing real work on an unmeasured premise. **D1 removes the mechanism it describes**: the cache is no longer single-slot. One sentence, replacing it, stating the key and citing ADR-0056 by number. *(Finding S7: one sentence, not a paragraph. If a fuller account is wanted it belongs in the ADR, which is where it now is.)*

**(b) `apps/web/src/archive/use-prior-conclusion.ts:34-48` — partially falsified, one sentence owed.**
Its opening — *"One slot, for the same reason `use-record-snapshot.ts` keeps one"* — is false after D1. The mount-scoped argument itself stands whole and is not touched: this hook's hazard is a key **hit**, and the freeze is what #31 step-6 finding F4 fixed. One sentence: the reference module now keys its cache; this one stays a single mount-scoped slot deliberately, and its measured bound is **one consumer** (§2.1). *(Under revision 1 this file was to be edited only to add a measurement sentence; under revision 2 it is edited because a sentence in it is now wrong. Different obligation, same size.)*

**(c1) `apps/web/scripts/route-client-js.mjs:216-219` — FALSIFIED UNCONDITIONALLY, amendment owed.** *(Blocker B1-ADR; revision 1 had no row for it and cleared it via a conditional row about a different sentence.)*
*"The index, the month page and the day page ship near-zero client JS."* After this ticket `/arquivo/[data]` does not. The comment is rewritten with the ticket's measured figure; the surrounding *"BUDGETED anyway, because 'ships nothing today' is precisely the route that acquires a library silently"* rationale is **kept and vindicated** — it is the sentence that made this edit predictable.

**(c2) `apps/web/scripts/route-client-js.mjs:53-56` — conditional, decided by the D8 procedure.**
Under D5 the prediction is that it survives. Corrected in the same commit if the marker probe says otherwise.

**(c3) `apps/web/scripts/route-client-js.mjs:221-226` — CONFIRMED, no edit.**
*(Finding N2: revision 1 read this as a general archive claim.)* Its subject is *"The three grid play routes"*, and the sentence naming `day-state` as outside their graphs is scoped to them, not to `/arquivo/[data]`. D1 keeps it true — the day page imports `use-record-snapshot.ts`, never `day-state.ts`. The conclusion revision 1 reached is right; its scope is now stated correctly, which matters because it sits four lines below the sentence (c1) falsifies.

**(d) ADR-0031 consequence (d) and (e) — CONFIRMED, no amendment.**
Verified verbatim: consequence (e) reads *"`impeccable detect` launches a clean browser profile, so the local store is always empty and both viewports always scan pending … The done state is covered by jsdom tests and by the file-mode run."* The archive day page is a third surface of the same class and confirms it. The enumeration *"Tiles and day chips"* is in consequence **(d)**, not (e), and is already generic enough to cover an archive day chip — no widening owed to either. ADR-0056 cites (e) as the reason for §11's file-mode run.

**(e) ADR-0043 consequence (d) — CONFIRMED, cited as precedent.**
*"A clean browser profile has no record, so the URL scan always renders `empty`. Compliance is proved the way ADR-0034 decision 4 names: a file-mode detect run, jsdom smoke tests, and stylesheet-text assertions."* This ticket is a second instance and cites it rather than re-deriving it.

**(f) ADR-0043 decision 10 — checked, untouched.**
Already amended by ADR-0054 decision 4. This ticket does not touch `ConclusionView` and adds no `role="status"` and no `aria-live` (D3), so it neither falsifies it again nor needs its disjointness rule.

**(g) ADR-0053 decision 9 / `T-WEB-S183` — checked, unbroken.**
D1 re-derives the Termo branch instead of importing `day-state.ts`, and `use-record-snapshot.ts` is already inside the archive's graph on `main` (§2.2). The assertion set is unchanged and must stay green; D1a is the live trap, now binding on three files.

**(h) ADR-0053 decision 10 — obeyed, not amended.** No endpoint. Layer 2 is what makes D3's *"Ver o resultado"* accurate; layer 3's honest gap is what D7 accepts.

**(i) ADR-0031 decision 2 — obeyed, and the one edge is recorded.** Absence renders pending; hydration only ever adds. The cross-tab prune's done → pending flip (D7, F4) is the understating direction the decision permits by name, and it is recorded in ADR-0056's consequences rather than left to be discovered.

**(j) `DESIGN.md:48` — scoped, gains a clause that names the right differences.** *(Finding M5-ADR: revision 1's proposed clause named only the dropped result.)*
Verbatim: *"**Game card** (Hoje): card paper, 1px line border, hard shadow in the game accent at 0.22, washi tape top-center, kicker + Fraunces title + description; done state is an outlined 'Feito' stamp chip (rotated −3deg) + tabular result, pending state is a solid accent button."* Scoped to Hoje, so not falsified — but DESIGN.md is the living design context `/impeccable` reads, `arquivo.module.css:288-292` declares the archive day card to be in this exact register, and the archive's variant differs in **five** ways *(three named at revision 2; two more from finding m-16, and the size delta is the one a `/impeccable` run comparing the two cards would actually see)*:

1. **no tabular result** (D4);
2. **no description** — `:48`'s anatomy is "kicker + Fraunces title + description" and the archive card ships kicker + title only, today, before this ticket;
3. **the chip is a flex-row item beside the kicker**, not an item in `.done`'s reserved box — and therefore sits **above** the title, inverting `:48`'s anatomy, where the done state is terminal;
4. **the chip is a different size**: a 23px used box against the hub's measured 29.34px, because this one declares `line-height: 1` (D6, R2-M2) — deliberate, and the clause says so in those words;
5. **there is no pending counterpart at all** — the archive card's pending state is the card as it ships today, with no accent button.

One clause naming all five and D4/D6's reasons, so a reader of `:48` is not left looking for a button that does not exist, and so the size delta is on the record where a design review would look for it rather than only in a plan.

**(k) `docs/agents/test-ids.md` — re-derived at step 8**, per the doc's own instruction. The range `S213…S224`, the burned tails `S223`/`S224` if unspent, and the new frontier.

**(l) `CONTEXT.md` — no row owed, and the reason is now the true one.** *(Blocker B2; revision 1's version of this row asserted a verb the file does not contain.)*
This ticket introduces **no new domain term**. It renders two existing ones — `Played · Jogado` (`:13`) and a **`Late completion · Conclusão tardia`** (`:12`) — under the hub's on-time word. That collapse is a **wording** decision recorded in ADR-0056 decision 2, not a glossary change: the glossary keeps saying exactly what it says today, and nothing in the product's vocabulary moves. Checked against `:11-13` line by line, not skipped.

**(m) ADR-0041 decision 5 — CONFIRMED, no amendment; the gate is what was owed.** *(Finding M1-ADR.)*
The decision states a **general rule** first — *"An accent border that outlines an already-legible label is decoration; an accent border that is the only thing saying which state a control is in is not"* — and then names two instances of it. The enumeration is **exemplary, not closed**, so a third instance obeys the decision rather than falsifying it, and no amendment row is owed. What consequence (f) does demand — *"every decision here is gated by one test file or by nothing"* — is met by rebuilding `T-WEB-S73`'s ring arm as a **scan with a closed site list** (D4), which enumerates this ticket's ring and the `late-result.module.css:90` postmark that has been an unasserted fourth ring on `main` since #31, and which reds on a fifth.

**(n) `docs/plans/037-…:1272` deviation I60 — becomes stale, not amended.**
It reads *"DEFERRED, in writing: the day page shows no per-game done state."* Plans are point-in-time snapshots (`docs/README.md:21`) and are never rewritten. Recorded here and in **#96's closing comment**.

**(o) `docs/plans/046-issue-96-research-review-round-1-findings.md` and `docs/plans/047-issue-96-research-review-round-2-findings.md` — untouched by design.** Same rule: a point-in-time record of a review round. Both are committed with the ticket and neither is edited, ever — including to mark a finding as fixed.

**(s) `apps/web/src/play/day-state.ts:186-190` — FALSIFIED, one comment sentence owed. The §1 carve-out.** *(Blocker R2-B4. Revision 2 falsified this sentence and forbade repairing it in the same document.)*
Verbatim: *"The same cache `use-record-snapshot.ts` keeps, for the same reason: `getSnapshot` must return a referentially stable value or `useSyncExternalStore` loops forever, and `readDayState` builds a fresh object on every call. Keyed on the date, because that is this projection's whole key — it already spans every game."* After D1 the first clause is false: the two modules no longer keep the same cache. The replacement sentence says what is true and what it costs — **this projection keeps a single date-keyed slot; `use-record-snapshot.ts` now keys a bounded `Map` because it has per-game consumers and this one does not** — and cites ADR-0056. **No code changes**, and §12 carries `git diff --stat` on the file as a row to keep it that way.

**Also owed, and it is one line in ADR-0056 decision 1** *(R2-B4's second half)*: `day-state.ts:192-204`'s `cachedDayState` is **a single date-keyed slot with the identical F3 defect one level up** — two archive dates in one session would evict each other the same way. It is not reachable today (the hub renders one date and this ticket adds no consumer), so it is **not repaired here**; but decision 1 states a general rule about this cache family, and leaving the only sibling unmentioned would repeat round 1's F3 omission one module over.

**(t) `apps/web/test/use-record-snapshot.test.ts:24-25` — FALSIFIED, one comment sentence owed.** *(Blocker R2-B4: revision 2's grep saw neither this file nor its wording, because `apps/web/test` was outside §7.1's scope.)*
Verbatim: *"Each case uses its own date, because the cache is one module-level slot keyed `{game, date}`."* After D1 it is a bounded `Map`. The conclusion still holds and the premise inverts: distinct dates are now distinct **entries**, so the cases cannot collide — which is a better reason for the same test design. One sentence. The file joins D9's must-stay-green list because the repair runs under it directly.

**(u) `apps/web/test/conclusion-view.test.tsx:623-629` (`T-WEB-S20`'s docblock) — CONFIRMED, no edit.** *(Found by revision 3's widened sweep.)*
*"The snapshot cache is module-level — one browser has one `localStorage` — so with two conclusion routes live in one SPA session `/binairo/concluido → /sudoku/concluido` on the same day is a real navigation, and a cache keyed on `date` alone would hand the second route the first one's record."* Both halves survive D1 intact: the cache is still module-level, still keyed `{game, date}`, and the hazard it describes is the one the `Map` also prevents. Recorded because the sweep found it and a silent hit is indistinguishable from a missed one.

**(v) ADR-0054 `:982-986` — CONFIRMED, no amendment.** *(Found by revision 3's widened sweep.)*
Its Rejected list weighs *"two more `useRecordSnapshot` subscribers on the same `(game, date)` key — a key whose sharing hazard is documented twice in the tree"*. The hazard it names is **two subscribers on the same key**, which is a key *hit*; D1's repair is about different keys evicting each other, a key *miss*. Nothing in the sentence is falsified. The word *"twice"* becomes conservative once ADR-0056 documents it a third time, and that is a count in a Rejected-list aside, not a claim the tree depends on — noted here rather than edited, per the plans-and-ADRs distinction in (p)/(r) below.

### 7.1 The reverse direction: every hit in the tree, mapped to a row

*(Handoff 041 `:96`: **every checklist row has ≥1 hit, and every hit maps back to a row — never a bare count.** Rows (a)–(v) are the first direction. This subsection is the second, which revision 1 omitted entirely — finding N5 — and which is exactly how blocker B1-ADR reached step 3 as a hit with no row. Four greps, every hit accounted for, no counts used as evidence. Re-run at step 4 **and** at step 5, and pasted in the PR body per §12.

**Revision 3 re-ran all four with widened scope and patterns, and they found four live hits revision 2's versions could not see** — two of them in `apps/web/test`, which was outside the scope entirely, and one inside grep 4's own target file. The lesson is the one handoff 041 §4 already carries: a sweep is only as good as its pattern, and a sweep that returns exactly the hits the plan expected is the one to distrust.

**Revision 4 re-ran them again, and the lesson repeated one round later** *(finding F-2)*: revision 3's own tables left hits unrowed in grep 1 and in grep 4 — including, again, one inside grep 4's target file — and rowed one line in grep 4 that the grep does not return at all. What concealed them was a **bare count** in grep 1's header — lines and files, both wrong — which is the exact instrument this subsection forbids. It is gone, and every hit is rowed below.)*

**Grep 1 — cache prose. Scope and patterns both widened at revision 3** *(blocker R2-B4: revision 2's pattern matched neither of the two live falsifications, and its scope excluded `apps/web/test` entirely — which is where two of them live)*:

```
grep -rn "single-slot\|single slot\|One slot\|one slot\|keeps one\|same cache\|module-level slot\|useRecordSnapshot\|readSnapshot\|snapshot cache" \
  apps/web/src apps/web/app apps/web/scripts apps/web/test docs/adr DESIGN.md CONTEXT.md
```

Run at step 4 and again after the last fix (§12). **Every line it returns is mapped in the table below, and the count is deliberately not stated** — the rule this subsection exists to obey is *"never a bare count"* (handoff 041 `:96`), and revision 3 broke it in its own header, with a figure that was wrong in both terms and that hid an unmapped hit (`use-record-snapshot.test.ts:22`) behind a number that looked like a result. *(Finding F-2.)* Call sites (a bare `import`, a bare `useRecordSnapshot(…)` call) are grouped as one row: they are code, not prose claims, and the inventory that governs them is `T-WEB-S214` (D9).

| hit | row |
|---|---|
| `apps/web/src/archive/late-result.tsx:112` | **(a)** — falsified |
| `apps/web/src/archive/use-prior-conclusion.ts:35` | **(b)** — falsified |
| `apps/web/src/play/day-state.ts:186` | **(s)** — falsified; the §1 carve-out |
| `apps/web/test/use-record-snapshot.test.ts:24` | **(t)** — falsified |
| `apps/web/test/conclusion-view.test.tsx:624` | **(u)** — confirmed, no edit |
| `docs/adr/0054-…:984` | **(v)** — confirmed, no amendment |
| `apps/web/src/play/use-record-snapshot.ts:17`, `:33`, `:51`, `:87`, `:90` | **D1** — the module being repaired; its docblock is rewritten and its `readSnapshot` is the change itself |
| `apps/web/src/archive/late-result.tsx:16`, `:113`; `src/play/conclusion-view.tsx:33`, `:114`; `src/termo/termo-conclusion.tsx:8`, `:61`; `src/nonogram/nonogram-conclusion.tsx:6`, `:45` | **call sites, not prose** — the four shipped consumers §2.2 counts and `T-WEB-S214`'s inventory pins |
| `apps/web/test/use-record-snapshot.test.ts:22` | **(t)**'s own docblock, two lines above the falsified sentence — *"The comparator is module-private, so it is driven where its output lands: on the snapshot `useRecordSnapshot` hands back"*. **Confirmed, no edit**: it is a claim about where the comparator is exercised, not about the cache's shape, and D1 changes neither. *(Added at revision 4 — F-2: this was the hit revision 3's bare count concealed.)* |
| `apps/web/test/use-record-snapshot.test.ts:5`, `:62`, `:88`, `:106`; `test/conclusion-view.test.tsx:15`, `:638` | test call sites — covered by D9's must-stay-green list |
| `apps/web/test/conclusion-share.test.tsx:246` | about `SERVER_SNAPSHOT` being a constant — untouched by D1, no row owed |
| `docs/adr/0054-…:146` | *"`ConclusionView` **is** that client component (`useRecordSnapshot(game, date)`)"* — an ownership claim, unaffected |
| `apps/web/src/i18n/messages.ts:285` | not a cache claim (*"keeps one auditable home"*, about emoji) — no row owed |
| `docs/adr/0030-…:143` | tab stops per playable cell — unrelated |
| `docs/adr/0041-…:350` | the kicker's character tracking — unrelated |

**Grep 2 — the archive's bundle prose:** `grep -rn "near-zero\|ships nothing today\|38.7" apps/web/scripts docs/adr`

| hit | row |
|---|---|
| `apps/web/scripts/route-client-js.mjs:216-217` | **(c1)** — falsified unconditionally |
| `docs/adr/0054-…:947` | **(c4)**, below — quotes the rationale, not the figure |

**(c4) ADR-0054 `:944-948` — CONFIRMED, no amendment.** It quotes `route-client-js.mjs`'s *"'ships nothing today' is precisely the route that acquires a library silently"* and applies it to the four `/<jogo>/concluido` routes joining `BUDGETED`. That clause is **vindicated** by this ticket — it is the sentence that made (c1)'s edit predictable — and ADR-0054 quotes no figure and makes no claim about `/arquivo/[data]`'s current client JS. Recorded because the reverse check found it, and silence here is indistinguishable from having missed it.

**Grep 3 — done-chip and done-state prose:** `grep -rn "done chip\|doneChip\|done state" docs/adr DESIGN.md apps/web/app/arquivo apps/web/src/archive`

| hit | row |
|---|---|
| `docs/adr/0031-…:151` | **(d)** — confirmed |
| `DESIGN.md:48` | **(j)** — gains a clause |
| `docs/adr/0041-…:127` | **(p)**, below |
| `docs/adr/0041-…:279` | **(q)**, below |
| `docs/adr/0043-…:239` | **(r)**, below |

**(p) ADR-0041 `:127` — CONFIRMED, no amendment; its stale pointer is recorded, not repaired, and the reason is now the true one.** *(Major R2-M11 — revision 2 dismissed this and (r) with *"an ADR body is not rewritten for line movement, `docs/README.md:21`"*, and `:21` says no such thing: it governs **"Handoffs, briefs, plans and specs"**, while `docs/README.md:5-7` and `:15` put `adr/` under **living documents … edited in place**. The dismissal was defensible; the rule cited for it said the opposite.)*
The row itself is a contrast-table entry for the **hub's** `.doneChip` text at 15.6663:1. This ticket adds a chip in a different stylesheet with the same figures on the same paper (D4), so the row is neither falsified nor an enumeration the archive joins.
Its `app/page.module.css:222` pointer **has** drifted — `.doneChip` is at `:238` today. **Not repaired here, and not because ADRs are immutable.** The drift is **systemic, not a stale row** — and revision 3 stated that conclusion against too small a number *(finding F-4: it said three of five)*. Re-measured line by line at revision 4, **every one of the five pointers in `:124-128` lands on a line that is not the rule it names**: `play/conclusion-view.module.css:176` (`.stamp` text) lands on a `transform: rotate(-4deg)`, `:354` (`.chipDone .chipName`) inside `.pictureRow`, `app/page.module.css:150` (`.kicker`) mid-comment, `:222` (`.doneChip`) on `.done` — the wrong rule, sixteen lines above `.doneChip` at `:238` — and `play/screen.module.css:56` (`.page a:hover`) mid-comment. Widened to the whole table at `:119-128` it is **all ten rows**, the other five landing mid-comment, on `.wordmark`, inside `.rules`, on `.back` and inside `.barKicker`. **So the dismissal is sound and the correction strengthens it**: repairing one row of a table not one of whose pointers is current would make the table *look* current while none of it is — strictly worse than uniform, visible drift. The whole table is a mechanical pass of its own, and #96's closing comment records it as a candidate ticket rather than pretending a plan can file one.

**(q) ADR-0041 `:274-285` — CONFIRMED, no amendment.** A **Rejected**-list counterfactual about what a `--ink-on-paper` token *would have* left byte-identical. It names `.doneChip` inside a hypothetical and enumerates nothing this ticket joins. *(Range corrected at revision 3 — the bullet starts at `:274`, not `:272`; finding m-11.)*

**(r) ADR-0043 `:233-239` — checked, untouched; its stale pointer recorded, not repaired.** Its border semantics govern `DayChip` in the conclusion — a different component with a different border rule (`done` is *"a tinted fill and no border at all"*), and this ticket's chip is the Game-card chip, so neither is touched. *(Range corrected: the bullet ends at `:239`, not `:243` — m-11.)* ADR-0043's own `apps/web/src/play/conclusion-view.tsx:586-594` pointer has drifted badly — `DayChip` is at `:864-899` today and `:586-594` is inside a distribution bar — and is **not** repaired here, for (p)'s reason and not for revision 2's: the citation `docs/README.md:21` was wrong, the drift is real, and a single-pointer repair inside a document with systemic pointer drift buys the appearance of currency rather than currency. Recorded in #96's closing comment with (p).

**Grep 4 — the accent-ring enumeration. Case-insensitive and widened at revision 3** *(blocker R2-B5: the old pattern was `accent ring|rings` and the tree spells it `RING`, so grep 4 missed hits inside its own target file)*:

```
grep -rniE "\bring(s)?\b" docs/adr/0041-*.md apps/web/test/ink-on-accent.test.ts \
  apps/web/src/archive/late-result.module.css apps/web/app/page.module.css \
  apps/web/app/arquivo/arquivo.module.css apps/web/src/play/conclusion-view.module.css
```

| hit | row |
|---|---|
| `apps/web/test/ink-on-accent.test.ts:343`, `:346` | **(m)** — the arm D4 rebuilds as a scan and widens to four rings |
| `apps/web/test/ink-on-accent.test.ts:47`, `:214` | **the fourth ring, named in prose in this very file** — *"the late-result panel paints the game's accent on the completion stamp's RING and nowhere else"*, twice |
| `apps/web/src/archive/late-result.module.css:34`, `:77`, `:80` | the same ring, named in its own sheet — *"the accent colours the RING — a shape"* and *"a ring in the game's accent, pressed slightly crooked"* |
| `apps/web/app/page.module.css:231-233` | the hub chip's ring comment, D4's source for the card-paper figures — confirmed, untouched |
| `apps/web/src/play/conclusion-view.module.css:218-229` | the daily stamp's ring comment, same figures — confirmed, untouched |
| `apps/web/src/play/conclusion-view.module.css:303-306` | `.stampLost`'s **`--ink-2`** ring — not an accent ring, outside the scan's `var(--accent)` pattern by construction |
| `apps/web/src/play/conclusion-view.module.css:39-43`, `:783`, `:825` | focus rings — a different mechanism (2.4.7), untouched |
| `docs/adr/0041-…:164`, `:185`, `:190`, `:197`, `:200`, `:206-212` | decision 5's own two instances, and the per-game **focus** rings *"left alone, measured and passing"* — a different mechanism |
| `docs/adr/0041-…:66`, `:338` | the general rule (*"a stamp ring, a card border, a graph bar"*) — the rule D4 obeys |
| `docs/adr/0041-…:282`, `:297` | **(q)** — the Rejected-list counterfactual |
| `apps/web/test/ink-on-accent.test.ts:383`, `:391` | the focus-ring arm — its title (*"paints the shared layer's one focus ring in ink, never the accent"*) and the comment inside it. A different mechanism (WCAG 2.4.7), unrelated. *(Corrected at revision 4 — F-2: revision 3 rowed `:275`, which produces no hit on this grep at all — the anti-vacuity control there names no ring. The real hits are `:383` and `:391`.)* |
| `apps/web/src/play/conclusion-view.module.css:487` | `.streakCard`'s comment — *"1.5px --accent-app ring"* — describing the `border: 1.5px solid var(--accent-app)` it declares at `:499`. **This is the hit that explains why D4's scan matches `var(--accent)` exactly and not `var(--accent[a-z-]*)`**: `--accent-app` is one fixed hex on every screen, never per game, and is ADR-0041 decision 1's own carve-out, so this ring is correctly *outside* the scan — as are `page.module.css:46`, `estatisticas/page.module.css:74` and `:145`, which a widened pattern would sweep in with it. Confirmed, no edit. *(Added at revision 4 — F-2.)* |
| `docs/adr/0041-…:138` | ADR-0041 decision **4**'s hover affordance — *"the treatment decision 5 gives the stamp ring"* — about a 2px `text-decoration-color` underline, not a border, and outside D4's scan by construction. Confirmed, no amendment. *(Added at revision 4 — F-2.)* |

**The claim revision 2 made here was false in both halves and the substantive point survives.** It read: *"`src/archive/late-result.module.css:90` produces **no** hit on this grep, which is the point: it is a shipped accent ring that **no prose and no test names**."* It is named in prose in **four** places — twice inside grep 4's own target file, 130 lines above the arm being widened, and twice in its own stylesheet. The true statement, and the one that justifies taking it: **the archive postmark's ring is named in prose four times and asserted by no test.** Prose is not a gate (ADR-0041 consequence (f) says so in as many words); D4's scan is what puts it on the record.

---

## 8. Is an ADR needed? **Yes — ADR-0056.** *(Reduced from six decisions to four at revision 2 — finding M3-ADR.)*

Reserved number for this ticket (`0055` belongs to the parallel #107). CLAUDE.md: *"New technical decision of any weight → propose an ADR before implementing, even a short one."*

Revision 1 proposed six decisions of which two bound: one was a CSS positioning choice the plan itself called stylesheet-reversible, one restated ADR-0031 decision 6 and said so, one was a measurement plus an application of an existing decision — and **the novel one was missing**. Four that bind beats six that mostly narrate.

**Title:** *The record-snapshot cache is per key, and the archive's done chip wears the hub's on-time word.*

**`Depends on:`** ADR-0008, ADR-0018, ADR-0029, ADR-0031, ADR-0041, ADR-0043, ADR-0044, ADR-0048, ADR-0051, ADR-0053. *(This header is what carries revision 1's decision 6 — "device state may never look like an authority on the streak; no read endpoint ships" is ADR-0031 decision 6 and ADR-0053 decision 10, unamended, and a dependency edge says that better than a restatement.)*

**Proposed decisions.**

1. **`useRecordSnapshot`'s snapshot cache is keyed per `(game, date)` in a bounded `Map`, and the bound must be at least the number of simultaneously-mounted consumers.** The shipped single slot loops (`Maximum update depth exceeded`) with two consumers of different keys, and does so across **games** and across **dates** alike — the second was never recorded and `/arquivo/<data>` is the first surface where the date is a URL variable. The repair is **never larger than the code it replaces** — rebuilt to spec independently several times and measured between 0 and 5 lines smaller, the spread being the eviction guard's shape and nothing else; the whole `apps/web` suite (**75 files, 1102 tests**) and `pnpm typecheck` are green on it. **The bound is load-bearing and measured**: 16 live consumers against a 16-entry cache are stable, **17 loop**, so the safe property is not "a `Map` fixes it" but **`bound ≥ live maximum`** — today 2, after this ticket 4, bound 16. *(Revision 2 wrote "must exceed", which is off by one against the measurement; finding m-1.)* The property is about **live** consumers, not entries: eviction survives interleaving, and dead keys left by ten simulated navigations change nothing. `T-WEB-S213` holds the repair, `T-WEB-S214` holds a floor under the constant and an inventory of the consumer **call-site files**; the 4× headroom itself is held by review and by the docblock. **The inventory pins files, not mounts** — a surface that reuses an existing call-site file (the archive month page would mount 31 × 4 through this ticket's own `day-card.tsx`) raises the live maximum past the bound without redding anything — so **this decision, not that test, is what a new surface has to be read against**. **Eviction is `set`-then-trim**, so the key just written is never the key evicted. **`usePriorConclusion` is deliberately not repaired**: its slot is mount-scoped by design (#31 step-6 F4), its hazard is a key hit rather than a miss, and its measured bound is one consumer. **`day-state.ts:192-204`'s `cachedDayState` is the one sibling with the identical defect** — a single date-keyed slot, one level up, which two archive dates in a session would evict the same way. It is unreachable today and is **not** repaired here; it is named so that the next surface to mount two day-states finds the rule already written rather than rediscovering it.
2. **The archive day chip publishes a *late* completion under the hub's *on-time* word, and that collapse is deliberate.** `CONTEXT.md:12` names the archive's term — **`Late completion · Conclusão tardia`**, *"never feeds streak, time stats or Dia Perfeito"* — and it is the term for **every** completion this chip can render. `CONTEXT.md:11`'s `Conclusão` is the on-time one. The chip nonetheless says **`Feito`**, the hub's Game-card word, for cross-surface consistency: `arquivo.module.css:288-292` declares this card to be that register. It is acceptable because the chip is device state claiming nothing about the streak, and because `messages.archive.play.note` says *"Não conta para a sequência nem para os seus tempos"* one screen away. **It is reversible in one line** — split the const in `messages.ts`, update `T-WEB-S222`. Two verbs (`Feito` / `Jogado`) are **not** reversible: a lost Termo showing *Feito* is the false done ADR-0031 decision 2 forbids by name. Sharpening the record: the union this projection re-derives (`day-state.ts:26-30`) was built to exclude *"the one a local reader cannot see: a LATE completion"* — on the archive, the excluded state is the only state.

   **The counter-precedent, engaged rather than left for a future reader to find** *(major R2-M14)*. `CONTEXT.md:12` does not only say a late completion never feeds the streak; it says it is *"**Shown distinctly in the calendar** when its date falls inside the account's own range"* — the product already distinguishing late from on-time on another user-facing surface, which is the first thing anyone will raise against this collapse. The distinction is real and the two surfaces are different kinds of object: **the stats calendar is a history *record*, where the whole point is which day was which; the day card's chip is a device *affordance*, whose whole job is "you finished this here, open it".** A record must disambiguate; an affordance must be legible. That is the line, and it is why one distinguishes and the other does not.
3. **The done card's accessible name keeps a verb and names the destination.** *"Ver o resultado do {jogo} de {data}"*, not a bare state, because WCAG 2.4.4 (Level A) asks an `<a>`'s name to make the destination determinable, and a card whose name states a state while its three siblings state a purpose is the one a screen-reader user cannot act on. It is accurate exactly when it renders: the chip's predicate and ADR-0053 decision 10 layer 2's local-restore predicate are the same predicate on the same record. **The done and played names are different sentences** — `"… — jogado"` on a played card — because the chip is `aria-hidden` and the anchor's label replaces its content, so the name is the **only** channel carrying state to assistive tech, and one sentence for both states is the false done decision 2's own argument forbids, in the one place the player cannot catch it. **The name changes at hydration** — pending `cardAria` → done `cardAriaDone` — which is the same monotone direction as the chip and is announced by nothing (`T-WEB-S219` asserts both ends, and that the two done-state names differ). **The monotone claim is scoped to hydration**: consequence (b)'s cross-tab prune flips the name back to `cardAria`, and that is accepted for the same four reasons the chip's flip is.
4. **Every accent ring in a shared sheet is enumerated by a scan, not by a comment and not by a list of instances.** *(Stated as a rule at revision 3 — finding m-13: revision 2 said "the third accent ring is gated", which binds nothing about a fifth.)* The rule: **`T-WEB-S73`'s ring arm scans the `SHARED` sheets for `border: <n>px solid var(--accent)` and asserts the site set equals a closed list** — so a new accent ring reds the test on arrival rather than joining the tree unasserted, which is what the archive postmark did for the whole of #31. The list is four rings plus `screen.module.css`'s accent-**filled** `.hint`, which the same pattern matches and which `T-WEB-S72` gates. This ticket's chip qualifies for ADR-0041 decision 5's WCAG 1.4.11 decorative exemption on its own terms: `1.5px solid var(--accent)` is 2.8501:1 on `--paper-card` and the word it encloses is 15.6663:1, and termo is the only one of the four accents that needs the exemption (sudoku 7.8385, binairo 5.5377, nonogram 4.5063 all clear 3:1 unaided). The archive postmark qualifies on **desk** paper: ring 2.7311:1, enclosed words 15.0124:1 (`--ink`) and 5.0791:1 (`--ink-2`), and `aria-hidden` besides. ADR-0041 consequence (f) — *"`impeccable detect` cannot see any of this and never will, so every decision here is gated by one test file or by nothing"* — is why this is a scan and not a paragraph; `impeccable@3.4.0`'s `low-contrast` provably never evaluates a border. Decision 5's own enumeration is exemplary, not closed, so no amendment is owed there.

**Consequences to draft.**
(a) `impeccable detect`'s URL scan renders this surface empty, a third confirmation of ADR-0031 consequence (e) and ADR-0043 consequence (d) — so the **done** state is proved by a file-mode run, jsdom tests and stylesheet-text assertions. The **pending** state, which this ticket also changes, is proved by the **`impeccable.yml` CI job**, which discovers a real `/arquivo/<data>` path out of the deployment's own HTML and scans it at both viewports against the preview host the project config's ignores are scoped to (§11). No local `localhost:3000` scan is owed or run. The config's ignores do cover `http://localhost:*`, so such a run would be legitimate; it is dropped because it needs a running server, a `DATABASE_URL` and a hand-picked archive date that no rule in this plan could supply, and because it duplicates a signal the CI job already produces on the host the gate reads.
(b) **A cross-tab prune can make the chip disappear while the player is looking at it, and the card's accessible name flips with it**: `prunePlayRecords` runs on every play mount, drops settled records dated before that mount's date beyond `RETAINED_PAST_RECORDS = 50`, and fires `storage` into the tab holding the archive page. The chip goes done → pending and the name goes `cardAriaDone` → `cardAria` (*"Jogar …"*) on an `<a>` that may be focused — **strictly less specific, which is the one direction decision 3's monotone claim does not cover**, hence its scoping to hydration. Accepted without a latch, both halves together — the direction is the understating one ADR-0031 decision 2 permits, and after the prune the device genuinely holds no record, so `pending` and *"Jogar"* are the honest answers.
(c) The archive's client graph gains `play-record.ts` (zod + `@miolos/core`) on `/arquivo/[data]` for the first time, so `route-client-js.mjs:216-219`'s *"ship near-zero client JS"* is corrected in this commit, and the route's delta is re-measured against the shared 40 KB budget.
(d) Past-retention and cross-device absence render as pending with no caveat copy — ADR-0053 decision 10 layer 3's gap, accepted in the UI's silence.
(e) DESIGN.md's Game card gains a documented archive variant, five differences (§7 j): no tabular result, no description, no pending button, the chip in a flex row **above** the title rather than in a reserved box below it, and **a deliberately tighter chip — a 23px used box against the hub's measured 29.34px**, because this one declares `line-height: 1` so its geometry can be asserted from stylesheet text. The size delta is the one a design review comparing the two cards would see, so it is recorded here and in `DESIGN.md:48`'s clause rather than only in the plan.
(f) `T-WEB-S215` is the standing anti-drift instrument between `archiveCardStatus` and the hub's `readDayState`; a change to either's status semantics goes red there rather than diverging quietly. **Its claim is narrow by design** — *the two read the same record the same way* — and explicitly **not** that the two surfaces' states mean the same thing, which `day-state.ts:26-30` says they do not. **Agreement alone cannot hold decision 3 of ADR-0053's F5 case**, because agreement is invariant under both sides moving together; the absolute arm on `pendingSync: true` and `syncOutcome: "rejected"` is what pins it, and it is a separate assertion for that reason.

**Reciprocal headers.** ADR-0056 cites ADR-0031, ADR-0041, ADR-0043, ADR-0044 and ADR-0053 as **obeyed, not amended** — no statement in any of them is falsified (§7). No `**Amended by:**` header is owed in `docs/adr/`. What *is* falsified is source prose in **five** places (§7 a, b, c1, s, t), which is a comment edit, not an ADR amendment *(corrected at revision 4: this sentence still said "three places" after revision 3 added rows (s) and (t), contradicting §9 step 10 and §12 in the same document)*. That claim is an exit-criterion row (§12), because "nothing is amended" is exactly the conclusion a fix round most often invalidates — and it already did once: revision 1 made this same claim while `route-client-js.mjs:216-219` sat unconditionally falsified.

---

## 9. Build sequence

Prefix every command with `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&` (napkin item 1). **The cwd is written out on every line rather than inherited from a header** *(blocker R3-B4)*: `pnpm` scripts run from the repo root, **`vitest` always runs from `apps/web`**. There is no root `vitest.config.*` and no root vitest binary, so a bare `npx vitest run` at the root resolves nothing in the workspace and `npx` would fetch a vitest from the registry — the one shape that can look like it worked. Every vitest line below therefore carries an explicit `cd apps/web &&`.

**Commits, and why there are four of them** *(blocker R3-B6 — revision 3's sequence never branched, never committed and never opened a PR)*. `.husky/pre-commit` runs `pnpm exec lint-staged`, then `pnpm typecheck`, then the **full** `pnpm test` — so every commit costs a whole gate run, and commit granularity is a real cost decision rather than a style one. **Four commit points are chosen** (after steps 1, 4, 8 and 10) and they cut the work where a reviewer would want to read it: the records, the shared-reader repair, the feature, the falsified-comment repairs. Two more follow where the work genuinely lands later: step 11's `route-client-js.mjs` correction, and step 14's test-id ledger if it changed. **Prefix every commit with `TURBO_CONCURRENCY=1`** (napkin item 8), and **never** `--no-verify` (CLAUDE.md).

| # | Step | Verification |
|---|---|---|
| 0 | **Branch.** The worktree `/home/ferna/projects/miolos-wt/96` was created on `feat/96-archive-done-chip` at `eea445e` and is already on it; a fresh agent that finds itself on `main` runs `git switch -c feat/96-archive-done-chip` before touching anything. Nothing is pushed yet. | `git rev-parse --abbrev-ref HEAD` → `feat/96-archive-done-chip`, `git rev-parse --short HEAD` → `eea445e`, and `git status --porcelain` shows **only** the three untracked `docs/plans/043-*` files. Paste all three — the last is also half of step 2's precondition. |
| 1 | Write ADR-0056 and the `docs/README.md` rows. | `pnpm format:check` from the root (`prettier --check .`) — **not `pnpm lint`**, which is `eslint --max-warnings 0 .` over `.ts/.tsx/.mts/.cts/.mjs` and cannot see a `.md` file at all; lint-staged's `prettier --write` glob (`*.{ts,tsx,css,json,mjs,yml,yaml}`) cannot either *(blocker R3-B3: revision 3 verified two markdown-only steps with a check that cannot fail on markdown)*. **And the honest limit of the substitute, stated rather than papered over: `.prettierignore` excludes `docs/` and the root markdown (`CLAUDE.md`, `CONTEXT.md`, `DESIGN.md`, `PRODUCT.md`, `README.md`), so no formatter in this repo checks this step's files either.** What `format:check` proves is that nothing else in the tree drifted; what actually gates this step is the commit's own pre-commit run and reading the ADR against §8's decision list and `docs/README.md`'s rows against its table. **Then commit** — `docs: ADR-0056 and the plan for the archive done chip (#96)`, with the plan and both findings files, which are untracked in the tree today (§6). |
| 2 | **Seam 1** — first the **precondition**, then `test/record-snapshot.test.tsx` with `T-WEB-S213` only, red against the shipped hook; then the `Map` repair + the rewritten docblock. | **Precondition, pasted before the seam is written** *(blocker R2-B2)*: `git diff --stat apps/web/src/play/use-record-snapshot.ts` is **empty** and `git status --porcelain` shows **no `M` row**. The repair has existed uncommitted in this worktree three times; if it is present when the seam is written, seam 1 is green on arrival, the only genuine design-driving red in the cache half is skipped, and the paste looks identical to a pass. Then `cd apps/web && npx vitest run test/record-snapshot.test.tsx` — red before, green after. Paste all four outputs. |
| 3 | **Seam 2** — add `T-WEB-S214`; export `SNAPSHOT_CACHE_LIMIT`. | `cd apps/web && npx vitest run test/record-snapshot.test.tsx`. |
| 4 | **The repair's blast radius**, and **the reverse sweep's first run**. | `cd apps/web && npx vitest run` — the whole web suite, against the §2.2 baseline of **75 files / 1102 tests** (all 1102 still pass, plus this ticket's new ones). Paste. **A red here is the signal to stop**, not to patch forward. Then run §7.1's **grep 1 with the widened scope and patterns**, here rather than at the end, because the repair is what falsifies the four sentences (§7 a, b, s, t) and this is the moment they are all visible. Paste it. **Then commit** — `fix: key the record-snapshot cache per (game, date) (#96)`. The repair and its two tests are a self-contained change to a shared play-layer reader; committing it here is what makes step 4's whole-suite paste mean something in the history. |
| 5 | **Seam 3** — `test/archive-done-chip.test.tsx` with `T-WEB-S215`, red on the Termo arm; then `src/archive/card-status.ts`. | `cd apps/web && npx vitest run test/archive-done-chip.test.tsx`. |
| 6 | `messages.ts`: hoist the two consts, add the four `archive.day.*` keys. | `cd apps/web && npx vitest run test/archive-copy.test.ts` (widened `T-WEB-S181` + new `T-WEB-S222`). |
| 7 | **Seams 4–6** — `app/arquivo/day-card.tsx` + the `day-view.tsx` boundary move; `T-WEB-S216`…`S220`. **`day-card.tsx` is a new `useRecordSnapshot(` call site, so `T-WEB-S214`'s inventory (D9) is updated in this step**: the pinned list gains `app/arquivo/day-card.tsx` and the live maximum is re-derived **2 → 4** against the unchanged bound of 16. | `cd apps/web && npx vitest run test/archive-done-chip.test.tsx test/archive-day.test.tsx test/route-ssr.test.tsx test/record-snapshot.test.tsx` — **`record-snapshot.test.tsx` is in this list deliberately** *(blocker R3-B2)*: without it the inventory's red lands for the first time at step 12's full gate, several steps from its cause, where the cheapest-looking fix is to weaken the inventory instead of re-deriving the bound. `T-WEB-S184` and `T-WEB-S56` must stay green through the boundary move. **And `pnpm typecheck` from the root, here**, because per D5 it is the ticket's only real guard on the boundary that lands at this step *(finding F6)*. |
| 8 | **Seam 7** — the stylesheet: `.cardTop`, `--done-chip-box`, `.doneChip`, `.cardKicker`'s `min-width`, the mobile override, the rule comment with D4's figures; `T-WEB-S221`. Widen `T-WEB-S73`'s ring arm. | `cd apps/web && npx vitest run test/archive-done-chip.test.tsx test/ink-on-accent.test.ts`. Then **look at it in a browser** at **1440×900 first** (the 288px card is the binding case — finding D-02) and then 390×844. **The vehicle is §11's fixture pair, built here** — `pending.html` and `done.html`, the real component with `globals.css`, `arquivo.module.css`, the real faces and unhashed class names — opened in the Puppeteer Chrome the repo already installs. It is used again at step 13, and it is **deleted before this step's commit** and rebuilt from §11's bodies at step 13; the two files are ~40 lines each and fully specified there. The fixture rather than `pnpm dev` because the day route is database-backed and needs a published past day, which no rule in this plan can guarantee — the same reason §11 drops the localhost scans. If the environment happens to have both, look at the real route too and say so; it is never the source of the figures. **The pass produces evidence, not an impression** *(finding R3-m3: two of revision 3's five checklist rows reduced to "does it look right", which nobody can fail)*. **What goes in the PR body, and what the step passes or fails on:** a **screenshot pair at both viewports** (pending and done), plus three `getBoundingClientRect()` figures read at each viewport — (i) the vertical gap from `.tape`'s painted bottom to `.doneChip`'s painted top (D6 measured **12.91px**; the pass condition is that it is positive and within a pixel or two of that, not that it equals it); (ii) `.card`'s height in the **pending** state; (iii) `.card`'s height in the **done** state, which must equal (ii) — that equality is the zero-CLS claim and it is the one number in this step that can genuinely fail. **Two items are looked at rather than scored**, and are named so the pass is looking for something specific: the ~5.4px horizontal gap between the tape's painted right edge and the chip's painted left edge (n-1 — the tightest relationship on the card) and the two 11px uppercase runs at weights 600 and 400 reading as kicker + stamp rather than as two kickers (n-3). If either reads wrong, that is a finding for step 6, not a red here. **Then commit** — `feat: a per-game done chip on the archive day page (#96)`. |
| 9 | The graph wall. | `cd apps/web && npx vitest run test/archive-day.test.tsx` — `T-WEB-S183` green, with D1a checked by grep: `grep -rn readDayState apps/web/src/archive apps/web/app/arquivo apps/web/src/play/use-record-snapshot.ts` returns nothing. |
| 10 | The **five** source-comment repairs (§7 a, b, c1, **s**, **t** — one sentence each; `day-state.ts` is the §1 carve-out and takes **no code change**), `DESIGN.md`'s clause. | `pnpm lint` from the root, which **is** the right check here because four of the five edits are in `.ts`/`.tsx` files; `pnpm format:check` as well, for the same reason and with the same stated limit as step 1 — `DESIGN.md` is in `.prettierignore`, so no formatter checks that half *(blocker R3-B3)*. Then `cd apps/web && npx vitest run test/archive-copy.test.ts`. The literal scan reads `src/archive/**`, but `code()` (`test/archive-copy.test.ts:31-37`) strips block, line **and** JSX comments first — so the annotations may contain accented pt-BR prose freely. Napkin item 3 is the same trap read the other way. **Then commit** — `docs: correct the four cache comments D1 falsifies, and DESIGN.md's Game-card variant (#96)`. |
| 11 | **Bundle.** | `cd apps/web && rm -rf .next && pnpm build && pnpm bundle-check`, then D8's marker probe over the same build. Paste both. Decide D8(ii)'s branch; land D8(i)'s unconditional edit. **Then commit** — `chore: correct route-client-js.mjs's near-zero client-JS claim for /arquivo/[data] (#96)`, carrying `:53-56`'s correction too if the probe demanded it. |
| 12 | **Mechanical gate.** | §10. |
| 13 | **`impeccable detect` — the file-mode pair plus the empty control.** | §11. **No build is needed and none is consumed**, which is why §10's `rm -rf apps/web/.next` at step 12 no longer collides with this step *(blocker R3-B1(c): revision 3 put two `http://localhost:3000/arquivo/<data>` scans here, downstream of the command that deletes the build they would have served from, with no server start, no `DATABASE_URL` and no rule for picking the date)*. The **pending** state's evidence is the `impeccable.yml` CI job on the PR's own preview deployment, read at step 15. |
| 14 | Step 8: re-derive the test-id frontier, update `docs/agents/test-ids.md`, burn the unspent tail. | `grep -rhoE "T-WEB-S[0-9]+[a-z]?" apps packages \| sort -u \| sort -t S -k2 -n \| tail` — titles only, `docs` excluded. **The `\| tail` needs the numeric re-sort** *(major R2-M13)*: `sort -u` is lexical, so revision 2's command reported `T-WEB-S99` as the frontier, not `S212`, and `docs/agents/test-ids.md:26`/`:50` are explicit that a wrong frontier at step 8 is the recurring failure of this step. `docs/agents/test-ids.md:33` gives the command **without** `\| tail`, which is also correct; the plan added the `tail` and owed it the sort. **Then commit** if this step changed anything — `docs: spend T-WEB-S213…S222 and re-derive the frontier (#96)`. |
| 15 | **Push and open the PR.** `git push -u origin feat/96-archive-done-chip`, then `gh pr create` with §12's body. | The PR body carries every gate's real output inline (CLAUDE.md's evidence rule), the §5 decisions, and §12's checklist worked through. Then **wait for the checks**: the required `gate` context (napkin, Shell item 4 — `main` is protected by the `protect-main` ruleset, which requires it), and the **`Impeccable` job on the preview deployment**, whose two viewport steps are this ticket's evidence for the **pending** state (§11). Read **both** viewport steps, never only the first (napkin item 9). Nothing merges until both are green and step 6's reviewers are satisfied — which is CLAUDE.md steps 6–8, not this step. |

---

## 10. The mechanical gate

All from the repo root, all with output pasted (CLAUDE.md's evidence rule; napkin item 2).

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null && rm -rf apps/web/.next && pnpm typecheck
source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm lint
source ~/.nvm/nvm.sh && nvm use default >/dev/null && TURBO_CONCURRENCY=1 pnpm test
```

- `TURBO_CONCURRENCY=1` is mandatory: the root suite is a coin flip without it (napkin item 8). **A red root run is diagnosed, never dismissed** — re-run serially, and if it is still red it is a finding. *(Finding m5: revision 1 wrote "a single red root run at default concurrency is not a finding", which is an escape hatch. This plan mandates `TURBO_CONCURRENCY=1` unconditionally and does not depend on #107 landing, so the sentence was doing nothing but weakening the gate.)*
- A **cached** turbo run is a log replay, not evidence. Use `--force` for the run whose output goes in the PR body.
- **Ordering trap:** `rm -rf apps/web/.next` is required before `typecheck` and it deletes the stats file `bundle-check` and D8's marker probe read. So §9 step 11 runs **before** this block, or is re-run after it.
- Pre-commit (Husky + lint-staged + typecheck + tests) stays green; **never** `--no-verify`. Prefix commits with `TURBO_CONCURRENCY=1`.

Not applicable and stated so rather than silently skipped: no `packages/games` change, so no property-based test is owed; no boundary crosses the client/server line with data, so no new Zod parse is owed. The one boundary this ticket opens is guarded **by shape at compile time** (D5), and #96's "never a server read" is guarded by `T-WEB-S220`.

---

## 11. `impeccable detect` — a file-mode pair locally, and **CI** for the pending state

`impeccable@3.4.0` and `puppeteer@25.4.0` are **root** devDependencies, so detect runs **from the repo root only**.

**Why file mode at all.** The scanner launches a clean browser profile, `localStorage` is empty, and `/arquivo/<data>` always paints the absent state — ADR-0043 consequence (d)'s exact situation, and ADR-0031 consequence (e)'s. So the **done** state is proved the way ADR-0034 decision 4 names: a file-mode run, jsdom smoke tests and stylesheet-text assertions. **CI cannot reach the done state and never will**, which is why this pair is not optional.

**The pending state's evidence is the `impeccable.yml` CI job, not a local `localhost:3000` scan** *(blocker R3-B1(d) — and revision 3's justification for the local pair was **false**)*. The pending state is not unreachable and this ticket changes it: `.cardTop`, `--done-chip-box` and `.cardKicker`'s `min-width` all ship unconditionally, and every card grows 13px (D6). Revision 3 concluded from `.impeccable/config.json`'s `files`-scoped ignores that *"the localhost run is the only run producing the signal the repo gates on"*. Read the config and the workflow together and that is not what they say:

- `.impeccable/config.json:21-25` and `:32-36` scope the `low-contrast` and `cream-palette` ignores to **`http://localhost:*`, `http://localhost:*/**` and `https://miolos-*.vercel.app/**`** — three patterns, of which the third is the preview host.
- `.github/workflows/impeccable.yml`'s `detect` job fires on `deployment_status` for `Preview – miolos-web` and **discovers a real archive day path out of the deployment's own HTML** rather than hardcoding a date (`:176-187`, ADR-0053 decision 12), exporting it as `day_path`.
- **Both viewport steps scan it**: `impeccable detect — desktop 1440x900` (`:237-280`) and `impeccable detect — mobile 390x844` (`:281-320`) each pass `$DEPLOYMENT_URL$ARCHIVE_DAY_PATH…` on a `https://miolos-*.vercel.app` host — exactly the pattern the ignores are scoped to.

So the project config applies there, in CI, on this PR's own preview, at both viewports. **Plans 037 and 040 both took this job as the archive's scan evidence**, and revision 3 mentioned CI nowhere. The local pair is dropped: it needs a running server, a `DATABASE_URL` and a hand-picked `<data>` that no rule in this plan supplies, it ran downstream of §10's `rm -rf apps/web/.next`, and it duplicates a signal CI already produces on the host the gate reads.

**How the CI evidence is read, and the one way it can be vacuous.** Read **both** viewport steps' logs, never only the first (napkin item 9 — `/estatisticas` failed mobile-only once). The preflight prints `preflight /arquivo/<date>: 200 + data-page= (discovered)` when the day page was found; **if the preview's archive is empty it prints `the archive is empty, skipping the date-bearing scans` and the day page is not scanned at all** — a deliberate skip-not-red (`:156-163`), and in that case this ticket has **no** CI evidence for the pending state and the PR body says so in those words rather than citing a green job that never looked.

**File mode has a trap that must not be tripped.** A bare path (`out/done.html`) goes to the **static jsdom engine** and silently ignores `--viewport`. Only an absolute `file:///…` URL gets the Puppeteer pass where layout rects, `--viewport` and the pixel checks are live (`cli/engine/cli/main.mjs:288-296`).

**The fixture, which must be the shipped page and not an approximation** *(finding D-11 — revision 1's shell linked two stylesheets and would have painted cards on white in a fallback font, so it could not have answered a layout question)*:

**Both temporary files live in `apps/web`, and the config is given in full** *(blocker R3-B1(a) and (b) — revision 3 said "a temporary vitest config in the scratchpad" with no body and no invocation, and put the fixture test "in the scratchpad" too, where vitest would never collect it: vitest resolves `include` against its root, and moving the root out of `apps/web` also breaks the relative `setupFiles`, the `react()` plugin's resolution and every relative import in the test)*.

**`apps/web/vitest.fixture.config.ts`** — the real config (`apps/web/vitest.config.ts`) plus two lines, so nothing about the environment changes except the class-name strategy and what is collected:

```ts
// TEMPORARY — written at §9 step 8, deleted before any commit. Not tracked.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/fixture-emit.test.tsx"],
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
```

**Run it from `apps/web`, with the cwd as the root** — that is what keeps `./test/setup.ts` and the include glob resolving:

```
source ~/.nvm/nvm.sh && nvm use default >/dev/null \
  && cd apps/web && npx vitest run --config vitest.fixture.config.ts
```

**Measured on this tree at revision 4**, because the whole fixture rests on it: under the shipped config a CSS-module import gives `_card_f27cc3` / `_cardKicker_f27cc3`; under the config above it gives `card` / `cardKicker`. The stylesheet the fixture links declares `.card` and `.cardKicker`, so without `classNameStrategy: "non-scoped"` the fixture would render **unstyled markup** and every scan would be vacuous.

1. **The fixture test is `apps/web/test/fixture-emit.test.tsx`, not a scratchpad file.** Vitest only collects under its root's include globs, and the root is `apps/web`; the emitted `pending.html`, `done.html` and `empty.html` **do** go to the scratchpad, since nothing collects those. The test file and the config are deleted immediately after the run and, in any case, **before any commit** — §12's cleanliness row is what enforces it, and it is worth naming the hazard the file creates while it exists: a plain `cd apps/web && npx vitest run` (§9 steps 4 and 12) would collect it through the default include and change the suite's file count. It exists only inside §9 step 8 and step 13.
2. it renders `<ArchiveDayView date games/>` with RTL — once with an empty store (**pending**) and once with four concluded records including a lost Termo (**done**) — writing each `container.innerHTML` into an HTML shell that carries, all of them, or the run does not answer the question it is being asked:
   - `<link>` to **`apps/web/app/globals.css`**, where `body { background: var(--paper-desk); background-image: var(--texture-dots); color: var(--ink) }` and `a { color: var(--ink) }` live. Without it the fixture paints cards on **white** with UA-default link blue, changing `cream-palette` (the plan's own expected baseline finding), every `low-contrast` composite and every adjacent-colour computation;
   - `<link>` to `packages/ui/tokens.css` and `apps/web/app/arquivo/arquivo.module.css`;
   - **real `@font-face` rules** for the three faces committed at #34 — `apps/web/assets/fonts/InstrumentSans-600.ttf` (the chip and the kicker), `InstrumentSans-400.ttf`, `Fraunces-36pt-500.ttf` — bound to `--font-fraunces` and `--font-instrument-sans`, which `next/font` supplies at runtime and `file://` does not. Without them every text metric is wrong. **Stated limit:** the committed Fraunces is weight 500 and `.cardTitle` ships 550, so title widths under the fixture are a lower bound. Immaterial to D6, whose row does not involve the title — and said out loud rather than left as a silent approximation;
   - the `style={accentVars(game)}` inline custom properties preserved on each `.card`, or the ring has no colour.
3. the two HTML files are written to the scratchpad; the two source files are deleted after the run; every output is pasted (the §2 discipline).

**The runs — four scans plus one control, all from the repo root:**

```
# done state, file mode, both viewports
npx impeccable detect --viewport 1440x900 file:///…/done.html
npx impeccable detect --viewport 390x844  file:///…/done.html
# pending state, file mode — the delta baseline for the done scans
npx impeccable detect --viewport 1440x900 file:///…/pending.html
npx impeccable detect --viewport 390x844  file:///…/pending.html
# proof of life — the empty control, which must produce NOTHING
printf '<title>empty</title><p>x</p>' > …/empty.html
npx impeccable detect --viewport 1440x900 file:///…/empty.html
```

One URL per invocation (handoff 021 §3). **Run them as five separate commands and never chain them with `&&`**: a scan that finds an anti-pattern **exits 2**, so a chain stops at the first finding and the remaining scans silently never run — which would look exactly like a shorter, cleaner output. Each scan's exit code is pasted with its output, and a `2` is read as "this scan found something", never as a failure of the procedure.

**The control is not optional, and revision 2's control was inert** *(blocker R2-B3, measured)*. `detect` exits **0** on an unreachable or empty page, so a green run proves nothing on its own — that much revision 2 had right. Its instrument was wrong: it paired each file-mode scan with a `--no-config` run and justified it as *"surfaces the suppressed Ateliê findings"*. Measured at round 2, the configured and `--no-config` runs on the same fixture are **byte-identical at both viewports** — one `cream-palette` finding in each of four runs:

```
########## done-worst @ 1440x900   (config applied)
  [cream-palette] cream/beige page background rgb(247, 242, 233)
1 anti-pattern found.
########## --no-config done-worst @ 1440x900
  [cream-palette] cream/beige page background rgb(247, 242, 233)
1 anti-pattern found.
```

Nothing is suppressed on a `file://` target in the first place, so `--no-config` un-suppresses nothing and **the pair cannot distinguish a scanned page from an empty one** — which is the only thing a proof-of-life control has to do. That sentence is deleted.

**The control that works, both halves measured.** The configured file-mode run on the real fixture emits `cream-palette` (above), and an empty `file://` target emits **nothing at all** — verified at revision 3:

```
$ npx impeccable detect --viewport 1440x900 file:///…/empty.html
EXIT=0        # and no output whatsoever
```

So the pass criterion is: **the fixture's scan must contain `cream-palette`.** If it does not, the fixture did not load, the run is vacuous, and no conclusion may be drawn from its silence.

**How to read the output, which is not "expect zero".** The `low-contrast` and `cream-palette` ignores are URL-scoped to `localhost` and `vercel.app`, so **a `file:///` target matches neither** — but only **`cream-palette` actually fires**; `low-contrast` did **not**, in any of round 2's six file-mode runs *(revision 2 wrote "both fire in file mode by design"; measured, that is one rule, not two)*. The two `overused-font` ignores carry no `files` key and do apply. **The evidence is the pending → done DELTA** within file mode: the pending scan is the baseline for the page as this ticket ships it, and any finding the done scan adds is a finding this ticket's done state introduced. Round 2 measured that delta on a correctly-built fixture and it is **empty** at both viewports — one `cream-palette` in all four runs and nothing else, no `nested-cards`, no `text-occlusion`, no `undersized-ui-text`, no `wide-tracking`, no `cramped-padding`, no `border-accent-on-rounded`. **The CI job is read the ordinary way instead** — against the config, on the preview host, expecting the repo's usual green at both viewports, and with the empty-archive skip checked for (above) before its green is cited for anything.

---

## 12. Exit criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `TURBO_CONCURRENCY=1 pnpm test` green, output pasted, the test run not a cache replay. `pnpm format:check` green too — with the limit §9 step 1 states, that `.prettierignore` excludes `docs/` and the root markdown, so it never sees the ADR, this plan or `DESIGN.md`.
- [ ] `pnpm typecheck` **also** run and pasted at §9 step 7, where the RSC boundary lands — it is the only guard on D5's plain-data props (F1).
- [ ] `T-WEB-S213`…`S222` green; `S223`/`S224` spent or recorded **burned**.
- [ ] `T-WEB-S181`, `S183`, `S184`, `S56`, `S73` green with no weakening — in particular `T-WEB-S183`'s `readDayState` text scan (D1a) and `T-WEB-S73`'s widened ring arm.
- [ ] The whole `apps/web` suite green against §2.2's baseline: **all 1102 pre-existing tests still pass** (75 files on `main` at `eea445e`), plus this ticket's new ones — the D1 repair's blast radius, measured rather than assumed. Never expressed as a target total.
- [ ] `grep -rn readDayState apps/web/src/archive apps/web/app/arquivo apps/web/src/play/use-record-snapshot.ts` returns nothing.
- [ ] `grep -n "src/i18n" apps/web/app/arquivo/day-card.tsx` returns nothing — D5's no-copy-on-the-client claim, the thing §6's revision-1 contradiction would have broken (F2).
- [ ] `pnpm bundle-check` from `apps/web` **plus D8's marker probe over the same build**, both pasted; `/arquivo/[data]`'s delta stated against the −38.7 KB baseline; `MAX_DELTA_BYTES` unchanged; `route-client-js.mjs:216-219` corrected **unconditionally**; `:53-56` corrected or its survival recorded as measured.
- [ ] `impeccable detect` — **four file-mode scans plus the empty-fixture proof-of-life control**, run as separate commands (a firing scan exits 2, so `&&` would swallow the rest); output **and exit code** pasted for each; each file-mode scan of the real fixture contains `cream-palette` (or the run is vacuous and proves nothing); the empty control produces no output; the file-mode pending → done delta named finding by finding.
- [ ] **The pending state's scan evidence is the `Impeccable` CI job on this PR's preview**, both viewport steps read (napkin item 9) — or, if the preview's archive was empty and the preflight skipped the date-bearing scans, the PR body says **that** instead of citing a green job that never looked at the day page (§11).
- [ ] The page looked at in a browser at **1440×900 first**, then 390×844, over §11's fixture pair: a **screenshot pair per viewport** in the PR body, the tape → chip vertical gap, and `.card`'s height in **both** states — which must be equal, the one figure here that can fail (§9 step 8).
- [ ] ADR-0056 committed with §8's **four** decisions and its `Depends on:` header; `docs/README.md` carries the rows for it **and** for this plan.
- [ ] The **five** source-comment repairs (§7 a, b, c1, s, t) landed, one sentence each; `DESIGN.md`'s variant clause landed naming all **five** differences, including the chip's size delta.
- [ ] **The `day-state.ts` carve-out stayed a comment**: `git diff apps/web/src/play/day-state.ts` shows a comment change and nothing else — no code line, no export, no import (§1, §7 s).
- [ ] `docs/agents/test-ids.md` frontier re-derived **by grep at the end**, titles only, `docs` excluded, **with the numeric re-sort** (`sort -t S -k2 -n`) or with no `tail` at all; range and burns recorded.
- [ ] **The two-way amendment check, both directions** (handoff 041 `:96`), re-run after the last fix and never as a bare count: (i) every row in §7 has ≥ 1 hit in the tree; (ii) **every hit maps back to a row** — §7.1's four greps re-run after the last fix, with their per-file line lists in the PR body, not a count.
- [ ] §8's claim that **no ADR is amended** re-checked after the last fix round, not carried forward from plan time.
- [ ] #96's closing comment records that plan 037's I60 is now stale, and that the issue's `usePriorConclusion`/`useRecordSnapshot` hint was **half right** — `useRecordSnapshot` was the correct mechanism and was repaired (§2.2), `usePriorConclusion` was not (§1).
- [ ] `git status --porcelain` clean of probe files **and of modified tracked files** before the first commit *(finding S13, widened by blocker R2-B2: revision 2's row was scoped to "probe files", i.e. to untracked `??` rows, and could not see the uncommitted `use-record-snapshot.ts` repair that would have made seam 1 green on arrival)*. **The row now names the §11 fixture explicitly** *(blocker R3-B1(b))*: `apps/web/vitest.fixture.config.ts` and `apps/web/test/fixture-emit.test.tsx` are created at §9 steps 8 and 13 and are deleted before **every** commit — the test file sits under the default include glob, so leaving it in place changes what `pnpm test` collects.
- [ ] #96's closing comment also records the **systemic pointer drift** in ADR-0041's contrast table — **all ten pointers at `:119-128` land on a line that is not the rule they name** (re-measured at revision 4, finding F-4) — and ADR-0043 `:242`'s `conclusion-view.tsx:586-594`, as a candidate docs-hygiene ticket, recorded rather than half-repaired (§7 p, r).
- [ ] **The branch and the commits**: the work sits on `feat/96-archive-done-chip` (§9 step 0), §9's commit points landed with `TURBO_CONCURRENCY=1` and without `--no-verify`, and the PR is open with §12's body (§9 step 15).
- [ ] PR body states what changed, pastes every gate's real output, and surfaces **§5's four decisions** explicitly — including decision 4, chip-only-no-duration, which revision 3 recorded in D4, the ADR and `T-WEB-S217` but never surfaced to Fernando *(blocker R3-B5)*.

---

## 13. Risks & landmines

| # | Risk | Mitigation |
|---|---|---|
| R1 | **The single-slot cache is reintroduced** by a later refactor "simplifying" the `Map` back to a slot. | `T-WEB-S213` is a permanent guard, `T-WEB-S214` pins the bound, ADR-0056 decision 1 is the record, and §7 (a)/(b) put the measurement next to both archive readers. |
| R2 | **The bound is lowered or the consumer count grows past it**, silently reintroducing the loop on a surface nobody re-measured. | Two instruments, and the second is what revision 2 was missing *(R2-M6: a static floor of 8 reds nothing when a future page mounts 20)*. `T-WEB-S214` (a) floors the constant at `GAMES.length * 2` and renders that many; (b) **pins the inventory of `useRecordSnapshot(` call-site *files***, so a new call-site file cannot arrive without this test going red and the bound being re-derived. **Its honest limit, stated rather than left to be discovered** *(finding F-1 — revision 3 wrote "a new consumer surface cannot arrive without this test going red", which is false)*: a surface that **reuses** an existing call-site file adds no file and stays green, and the archive month page is the live example — 31 days × 4 games through this ticket's own `day-card.tsx`, 124 live consumers against a bound of 16. That growth is held by ADR-0056 decision 1's rule, by the hook's docblock and by review. The plan says so instead of pretending a test holds it. |
| R3 | **The repair breaks a conclusion, the hub or the late-result panel** — a shared reader with a wide blast radius. | §9 step 4 runs the whole web suite immediately after the repair, against §2.2's pasted **75 files / 1102 tests** baseline. Measured green in this worktree, twice, before this revision was written. |
| R4 | **`T-WEB-S183`'s raw text scan** reds on a doc comment naming `readDayState` (D1a), now across three files including the repaired hook. | Cite the module by path, never by identifier. §9 step 9's grep covers all three. |
| R5 | **A function crosses the RSC boundary** into `ArchiveDayCard` — the easy version is passing `messages.archive.day.cardAriaDone` itself rather than its result. It is an HTTP 500 on the real route. | **`pnpm typecheck`**, with a closed `readonly` props interface of `string`/`number` members. `T-WEB-S56` **cannot** see this (F1, measured) and is not relied on. §9 step 7 runs typecheck where the boundary lands. |
| R6 | **The accessible name regresses** — a small-boundary refactor at review time would silently restore "Jogar" on a solved card. | `T-WEB-S219` asserts the server name and the hydrated name. D5 records why the boundary is the card. |
| R7 | **`archive-copy.test.ts`'s pt-BR literal scan** reds on a quoted accented run in `day-card.tsx` or `card-status.ts`. | Neither carries copy (D5). If a fix ever hard-codes a word, this is where it lands — by design. |
| R8 | **The `messages` chunk lands on `/arquivo/[data]`** despite D5, via a shared-chunk reshuffle. | D8's marker probe measures it rather than predicting it; the comment is corrected in the same commit. Not a blocker either way — the route has ~38 KB of slack. |
| R9 | **`impeccable detect` exits 0 on nothing** — an empty or unreachable fixture passes silently. **Measured: an empty `file://` target produces no output and exit 0.** | The proof-of-life criterion, mandatory: **every file-mode scan of the real fixture must contain `cream-palette`**, and the empty control must produce nothing. Revision 2's `--no-config` pair could not have caught this — measured byte-identical to the configured run (R2-B3). |
| R10 | **File-mode noise is misread as a regression**: `cream-palette` is live in file mode because the ignores are URL-scoped. *(Measured: `low-contrast` does **not** fire in file mode — revision 2 said both did.)* | §11's pending → done delta design, plus the **CI job**, which runs on the preview host the config's ignores are scoped to. State it in the PR body before pasting the output. |
| R11 | **The fixture is not the page** — no `globals.css`, no real faces — and answers layout questions wrongly. | §11's four-part fixture list, each item with the failure it prevents (D-11). |
| R12 | ~~**The kicker wraps** on a card narrower than measured.~~ **Retired at revision 3**: round 2 measured the row at 1440×900, 390×844, 360×800 **and 320×700** — nothing wraps at any of them, worst-case slack **81px** on a 246px measure. | What remains is not a risk but a property: a future kicker longer than `Palavras` is a copy change whose failure mode is a wrapped kicker, never occlusion (D6), and `.cardKicker` carries `min-width: 0`. §9 step 8 still looks, because a measurement is not a screenshot. |
| R13 | **`docs/README.md` rows forgotten** — a blocking review finding in four consecutive PRs. | §9 step 1 does it first, and it is an exit-criterion row. |
| R14 | **The `messages.ts` const hoist is read as scope creep** into the hub's block, or silently desyncs the two registers, **or is renamed in one edit that moves both surfaces together**. | It is two lines and it is the file's own idiom (`back`, `backAria`, `hintsUsed`). `T-WEB-S222` asserts both blocks against the const **and both against the literal `"Feito"` / `"Jogado"`** — the identity arms catch a re-pointing, the value arms catch a rename, and revision 2's "both directions" form caught neither because it compared one binding with itself (R2-M4). `messages.ts:132-138` shows the file has split such a pair on purpose before. |
| R15 | **A future accent ring ships unasserted**, the way `late-result.module.css:90`'s postmark did for the whole of #31. | `T-WEB-S73`'s ring arm is a **scan with a closed site list** (D4), not two literals: a fifth `border: <n>px solid var(--accent)` in a `SHARED` sheet reds it on arrival. ADR-0056 decision 4 states it as a rule rather than as an instance (m-13). |

---

## 14. Deviations register

*Empty of implementation deviations at plan time. Both step-3 review rounds' findings are answered in the body above and in §0's two revision logs rather than here — this table is for deviations the implement agent discovers at step 5. It appends every one — the section it deviates from, the cause, which lens or reviewer caught it, and its severity — as one global numbered sequence under dated batch headers. Napkin item 5 binds: a fix that changes a plan statement owes an entry here in the same round.*

| # | From | To | Cause, and severity |
|---|---|---|---|

### Batch 1 — 2026-08-16, step 5 (implement)

| # | From | To | Cause, and severity |
|---|---|---|---|
| 1 | §6 / §9 step 1 — `docs/README.md` gains *"the two 'Current' rows (plan 043, ADR-0056)"* | **Four rows**: plan 043, ADR-0056, and the two findings files `046-…` and `047-…` | The findings files are numbered sequenced artifacts and §6 commits them with the ticket, so the rule the plan invokes for the other two (*"every PR committing a plan/ADR adds its README row"*, napkin) covers them as well. Additive; no row contradicts the plan. **Trivial.** |
| 2 | §9 step 10 lists the `route-client-js.mjs` repair (§7 c1) among *"the five source-comment repairs"* | Landed at **step 11**, whose own instruction and commit message are about exactly that edit | The plan lists c1 in both steps. It cannot land at step 10: its replacement text carries a **measured** figure that step 11 produces. Resolved in favour of step 11's explicit instruction; all five repairs landed, and §12's exit criterion is met. **Trivial — a plan-internal inconsistency, not a change of substance.** |
| 3 | §4 seam 7's pass-B snippet — the mobile padding's vertical term *"is read with `token("--space-1")`"* | The test extracts the token NAME out of the `var(…)` wrapper before calling `token()`, and asserts it is `--space-1` | `decl(mobile, "padding")!.split(/\s+/)[0]` yields the string `var(--space-1)`, not `--space-1`, and `token()` looks its argument up as a declaration name — so the snippet as written throws `` `undefined` is not a px length ``. **Caught by the seam's own red.** The extra `expect(padToken).toBe("--space-1")` keeps the token identity asserted rather than inferred. **Low.** |
| 4 | D5's *"import list, stated exhaustively"* for `day-card.tsx` | Plus `import type { Game } from "@miolos/core"` | The `game` prop is a `Game` and `accentVars` takes one. A type-only import is erased at compile and adds nothing to the client graph; the alternative — typing the prop `string` and casting at `accentVars` — is worse and would need a justified `any`-class comment. The list's substance (no `src/i18n`, barrel or leaf) is unchanged and is asserted by §12's grep. **Trivial.** |
| 5 | §7.1 grep 1's hit table | Two hit **classes** appear that the table could not list | `docs/adr/0056-…` and `apps/web/test/record-snapshot.test.tsx` are this ticket's own new artifacts, so every line they contribute is the ticket describing itself. Recorded here rather than left as unmapped hits, because the rule is *every hit maps to a row* and a sweep whose new hits are unexplained is the one to distrust. **Trivial.** |
| 6 | §9 step 8's browser figures — tape → chip **12.91px**, chip → title **6.40px**, tape-right → chip-left **5.38px** | Measured on this branch's fixture: **11.14px**, **4.67px**, **5.15px** at 1440×900 | All three are within ~1.8px of the plan's, all positive, and the plan's stated pass condition is *"positive and within a pixel or two of that, not that it equals it"*. The small deltas come from the fixture card measuring 289.61px against the plan's 288px. **The one figure that could fail did not**: `.card` is byte-identical in the pending and done states at both viewports (289.61 × 121.01 and 351.6 × 121.88), which is the zero-CLS claim. **None.** |
| 7 | §6 — the ADR's filename `0056-the-record-snapshot-cache-is-per-key.md` | `0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md` | The slug carried only the first half of a two-part title, and the `Feito`/late-completion collapse (decision 2) is the half a future reader searches for. **Trivial.** |
| 8 | §2.2 — the repair is *"between 0 and 5 lines smaller"* | Measured **−1** on this branch (22 lines of code against 23) | Inside the plan's stated band, at its top end. The whole-file diffstat is `+47/−18` because the docblock grows by the three sentences D1 requires of it; the size claim was always about the code. **None.** |
| 9 | §4 seam 3 — *"red until the Termo `outcome === "lost"` arm exists"* | Run **twice**: once against no module (an import error), then against a deliberately naive `concluded === true` implementation | An import error is a red, but not the red the plan names, and the plan permits *"against nothing or against a deliberately wrong implementation"*. The naive pass produced the design-driving red exactly — two failures, both the lost-Termo arms, `expected 'completed' to be 'played'`. **None.** |
