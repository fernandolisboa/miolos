# 054 — Triage the open tracker

**Date:** 2026-08-19
**Tree:** `main` at `370f1e1`
**Scope:** every open GitHub issue on `fernandolisboa/miolos` at the time of the sweep (25 issues), tiered against the new work tiers, checked for staleness and duplication, and classified product / infra / records.
**Not committed by this sweep.** Point-in-time snapshot, never a living spec.

> **Why this exists.** Nine of the last ten merged PRs contained no product code
> (#125, #124, #122, #121, #120, #119, #118, #117, #115 — docs, CI and test
> plumbing; only #113 shipped product, on 2026-08-16). The tracker had grown a
> layer of process-generated tickets about the test suite while the four
> remaining v1 product milestones sat untouched. This document makes the tracker
> honest again.

---

## The tiers

| Tier | Name | Flow |
|---|---|---|
| **0** | Just do it | typo, comment, dependency bump, one-line test fix, records-only. No ticket. Do it when touched, or close. |
| **1** | Small fix | a real bug, roughly ≤50 lines, no new decision. Reproduce → fix → one review → merge. No plan doc, no ADR, no handoff. |
| **2** | Feature slice | vertical slice, new surface, schema or contract change. The eight-step flow. |
| **3** | Foggy | architecture or unclear shape. `/wayfinder` or `/grill-with-docs` first, then Tier 2. |

---

## The table

`Class`: **P**roduct / **I**nfra / **R**ecords.
`Valid?`: does the issue's premise still hold at `370f1e1`.

| Issue | Tier | Class | Valid? | Recommendation | Why (one line) |
|---|---|---|---|---|---|
| **#13** Spec: Miolos v1 | — (epic) | R | Yes | **Keep open as the epic tracker**; flag the label | All of M0–M2 and three of five M3/M4 children are closed; four remain (#32, #33, #35, #36) plus #37 — it is a live container, but `ready-for-agent` on an epic invites an agent to implement all of v1 |
| **#32** M3: Streak-at-risk notifications | **3** → 2 | P | Yes | **Do next (fog first)** | ACs are written but "the player's habitual play window" has no schema, no scheduler and no data model anywhere in the tree — the shape needs settling before it is a slice; it also unblocks #33 and #36 |
| **#33** M3: PostHog telemetry | **2** | P | Yes | Do after #32; **the blocking edge is soft** | Five events, no schema change, no new surface; only `notification_opt_in` actually needs #32, so four fifths could ship first |
| **#35** M4: Onboarding | **2** | P | Yes | **Do next — it is unblocked today** | Its only blocker (#27) closed on 2026-08-13; new surface + first-visit persistence per identity = a clean vertical slice |
| **#36** M4: Settings and paper-dark | **2** | P | Yes | Do after #32; **the blocking edge is soft** | Paper-dark palette + theme persistence + reduced-motion audit are independent of #32; only the notification-preferences panel needs it |
| **#37** M4: Launch hardening | **3** → 2 | P | Yes | Last; **split it** | Blocked by seven issues and mixes agent work (sitemap, CLS, code-splitting, error monitoring) with work only Fernando can do (LGPD deletion exercised in production, Neon backup/restore, the launch checklist) |
| **#51** impeccable value-level ignores | **0** | I | Yes, but inert | **Leave open, non-blocking; candidate for `wontfix`** | Upstream-blocked with no known tracker; impeccable is now at **3.6.0** and the repo pins **3.4.0**, so the "has a release shipped value extraction?" question is one `npm view` away and re-checking it is a Tier 0 chore |
| **#58** Decide: completion synced after rollover | **—** | P | Yes | **Fernando decides. Relabelled `ready-for-human`.** | It is a product decision with two named options, not agent work; see the section below for the two-sentence version |
| **#59** Least-privilege Neon role for apps/web | **2** | I | Yes | **Relabelled `ready-for-human`** | `apps/web/src/db.ts:22` still reads the integration-managed `DATABASE_URL`; the work is creating a role in Neon and rotating a live credential across three Vercel environments — an agent cannot do it |
| **#61** Binairo composite widget retrofit | **2** | P | Yes | Bundle with #67 | `binairo/grid.tsx:16-17` still says "the grid ships 64 ordinary tab stops"; Sudoku and Nonogram are `role="group"` + roving focus — a real, user-visible a11y inconsistency, but a rewrite of a shipped board, not a small fix |
| **#62** Binairo `withEntry` allocates | **1** | I | Yes | Do it — ~6 lines | `binairo/state.ts:257-264` has no identity guard; `nonogram/state.ts:400-402` has it. `sudoku/state.ts:297-305` has the same gap and the issue already says to check it |
| **#63** Running clock shifts (Fraunces has no `tnum`) | **1** | P | Yes, **and larger than filed** | **Do it — highest value-per-line on the board** | `.timerBar` and `.timerCard` still pair `var(--font-display)` (Fraunces) with `tabular-nums`, a no-op; `conclusion-view.module.css` has at least two more such pairs (`:267-271`, `:651`). Visible jitter on six surfaces |
| **#64** Name the revealed Nonogram picture | **2** | P | Yes | **Needs Fernando's call first** | Premise holds: `motifs.ts:37` keeps `name` server-side and it is on `FORBIDDEN_DAILY_KEYS`. Shipping it costs the markup-substring tripwire (ADR-0033 consequence (d)) — a trade only Fernando should make |
| **#65** `elementFromPoint` per pointermove | — | I | **Duplicate** | **CLOSED as subsumed by #66** | Same file, same line, same fix; `use-pointer-stroke.ts:215-220` names **#66** as the owner of "the trace and the rect cache it would justify" |
| **#66** PERF-5 pointer-move hit test | **1** | I | Yes | **Only after a browser trace**; low priority | The defect is real and unfixed, but the ticket's own instruction is "do not act on this without evidence", and the evidence needs a Chrome trace on a throttled CPU, not a jsdom count |
| **#67** Hint button is tab stop 2 but last on screen | **1** | P | Yes, **and wider than filed** | **Do it — one CSS edit** | `screen.module.css:412-418` still paints `"bar" "title" "board" "hint"` on ≤1140px while all three `play-view.tsx` files put the hint `<button>` before `<section className={screen.board}>`. The shared sheet is now consumed by six screens, so the fix is worth more than when filed |
| **#74** Real alert when the Termo pool runs low | **2** | I | Yes | Keep; **carries a product question** | `service.ts:706-715` still emits the stopgap log line into Vercel logs that nothing polls, and `buffer-alert.yml` still thresholds only `.shallow`. The "what does the product do when the list runs out" half is Fernando's |
| **#76** Correct `FORBIDDEN_DAILY_KEYS`' TSDoc | **0** | R | **NO — premise false** | **CLOSED, with evidence** | The correction landed with #27 and survived review; `packages/core/src/testing.ts:8-14` already says exactly what this issue asked for |
| **#78** ADR line citations drift | **2** as filed → **0** rescoped | R | **Premise more true; prescription obsolete** | **Do not build the checker. Rescope.** Left open, commented | Drift is ~85–95 citations, not ~20 (38–44% of a 16-citation sample resolves) — but ADRs 0046–0057 carry **4 line citations between them**, because handoff 048 §4 already changed the convention to symbols |
| **#83** Cross-device day state | **2** | P | Yes | Post-v1 unless a second device becomes a launch blocker | No `/day` route exists under `apps/api/app/`, and `play/day-state.ts:15-19` still names #83 as the owner. A new endpoint, a new contract and a merge discipline — a real slice, not on the v1 critical path |
| **#103** Share button on the archive late-result | **2** | P | Yes | Keep; **owns one real decision** | `apps/web/src/archive/late-result.tsx` (194 lines) has no share affordance; #105 shipped it on the four daily conclusions only. The "what may a *late* share honestly say" question is the reason it is Tier 2 and not Tier 1 |
| **#104** OG cards for archive index / month / day | **2** | P | Yes | Keep at `needs-triage` — **two open product questions** | Confirmed: the eight play routes have `opengraph-image.tsx`, and `/arquivo`, `/arquivo/mes/[mes]`, `/arquivo/[data]` have none. Whether the index and month pages get cards at all is Fernando's call |
| **#106** Import walls miss the `node_modules/@miolos` symlink | **1** | I | Yes | **Do it — ~20 lines of config + 3 probes** | Verified: `grep -c "node_modules/@miolos" eslint.config.mjs` returns **0**, and `webWallImportPatterns` bans only the bare subpath and `**/packages/<pkg>/src/**`. Real gap, low exploitability |
| **#111** T-API-S41 fails 1 root run in 400 | **1** | I | Yes, **with two false pointers** | **Do it — ~4–8 lines, test-only** | Confirmed live and unaddressed; two citations in the body are wrong and a **third** unsatisfiable assertion site exists that the issue does not mention. Commented with the corrections |
| **#126** Move heavy property runs off the per-PR path | **2** | I | Yes | **Do it, then stop touching the test suite** | Filed today; `ci.yml` has `pull_request` with no `paths:` filter, and ADR-0023:33 does carry the "never below 100" floor it names. This is the ticket that ends the loop |

---

## Counts

**By class** — 25 open at the start of the sweep, 23 after two closures.

| Class | Count (start) | Issues |
|---|---|---|
| **Product** | **13** | #32, #33, #35, #36, #37, #58, #61, #63, #64, #67, #83, #103, #104 |
| **Infra** | **9** | #51, #59, #62, #65, #66, #74, #106, #111, #126 |
| **Records** | **3** | #13, #76, #78 |

The ratio is healthier than the *merge* history suggests. The problem was never the tracker's composition — it was that the infra tickets kept spawning each other (#107 → #109 → #110 → #114 → #120 → #123 → #126) while nothing pulled from the product half.

**By tier** (25 issues; two are neither — #13 is an epic, #58 is a decision)

| Tier | Count | Issues |
|---|---|---|
| **0** | 3 | #51, #76, #78 *(rescoped)* |
| **1** | 6 | #62, #63, #66, #67, #106, #111 |
| **2** | 13 | #33, #35, #36, #59, #61, #64, #74, #78 *(as filed)*, #83, #103, #104, #126, (#65 before closure) |
| **3** | 2 | #32, #37 |
| **—** | 2 | #13 (epic), #58 (decision) |

**For context on the records load:** the repo carries **57 ADRs** for a product with four unshipped v1 milestones. Every one is now `Accepted` (#116). That is not a finding to act on tonight, but it is the number behind Fernando's instinct.

---

## Per-issue detail, where a line was not enough

### #58 — the decision Fernando should answer in the morning

**Relabelled `ready-for-human`.** It is titled "Decide:" and it is not agent work.

> **The decision.** A player who solves offline at 23:58 and reconnects at 00:05 has their completion stamped with the *server's* write instant, so it derives as late and the streak breaks — because letting the client assert its own finish time would put the device clock into streak arithmetic, which `CLAUDE.md` forbids outright. Fernando must choose: **(1)** accept that window, amend #18's "a connection drop mid-puzzle never costs the day" wording, and record it as an ADR-0026 consequence — this is what ships today; or **(2)** close it server-side without trusting the client clock, by deriving `on_time` against a bounded grace period (a change to one SQL expression in `packages/db/src/completions.ts` plus its tests, no migration, no client change) — which also amends ADR-0008's definition of on-time.

Cheap to defer, and cheap to change later: the schema, the route and the client are identical under both options. It does not block any of #32/#33/#35/#36.

### #78 — ADR citation drift: the premise got worse, the fix got unnecessary

**Firm recommendation: do not build the checker. Rescope this to a three-line convention note, and leave the sweep optional.**

**The drift is ~4x worse than filed.** There are 193 `path.ext:NN` citations across `docs/adr/*.md`, **156 of them pointing at code**. A systematic sample of 16 — every 10th citation, spanning ADRs 0030/0038/0039/0040/0041/0042/0043/0044/0053, across Context, Decision *and* Consequence sections — resolves at **7/16 = 44%**, or **6/16 = 38%** strictly scored. Extrapolated over the 156, that is roughly **85–95 stale citations**, not "roughly twenty".

Every citation #78 named is now broken:

- **0041** — all thirteen checked drifted. The contrast table's two worst: `.stamp`, cited at `conclusion-view.module.css:176`, is at `:231` (`:176` is `transform: rotate(-4deg);`); `.chipDone .chipName`, cited at `:354`, is at `:638` (`:354` is `justify-content: center;`).
- **0044:27** is worse than drift — it cites `day-state.ts:25` for `DayEntry.concluded`, and **`concluded` no longer exists on `DayEntry`**. ADR-0044's own decision replaced it with `status: DayStatus`.
- **0029** — all three citations point at files deleted at that path (`apps/web/src/binairo/sync.ts`, `apps/web/src/binairo/play-record.ts`), moved to `src/play/` by the very decision this ADR records. `:37`'s claim that `readPlayRecord(date)` hardcodes `playRecordKey("binairo", date)` is false of the current signature, which takes `game`.
- **0043:10** is the pathological case for a checker: `conclusion-view.tsx:188` still *resolves*, but to the `empty` marker while the ADR assigns `:188` to `result`. An ordinal mismatch that reads as a hit.
- **`0043:255-257`'s deliberate annotation survives verbatim** — `` (`:89-95`, as the file stood when this was written) ``. That is exactly the counter-example proving a checker needs an opt-out grammar, not just a rule.

**And yet the repo already solved it, by convention rather than by machine.** Since **handoff 048 §4** — *"**Cite symbols, not line numbers.** This is the session's most repeated finding… fix records drift with a convention rather than a reviewer"* (`docs/handoffs/048-handoff-96-and-107-in-parallel.md:68`, restated at `:110` and `:114`) — the ADRs have followed it:

- **ADRs 0046–0057 contain 4 line citations between them.** Ten of the twelve have **zero**. The two exceptions quote older ADRs' text rather than citing fresh.
- **ADR-0055 amendment (d)** is a formal lettered amendment whose whole subject is *"Decision 1's third-residual citation is **repaired from a line to a symbol**"*.
- **ADR-0057:125** converted 26 sites to symbol pointers at once.
- Four ADRs carry the rule inline at the point of citation, e.g. `0056:99`: *"(cited by symbol, not by line — this citation had already rotted `:192-204` → `:198-210` **inside this PR's own diff**)"*.

**The corpus is frozen, not growing: 152 of the 156 code citations sit in ADRs 0028–0045**, all from the #27 era, with 0041 alone holding 39.

So a gate-level checker would police a citation *form the repo has stopped writing*, over a corpus that is not growing, while needing enough grammar to tolerate 0029's legitimately-historical Context and 0043's deliberate as-of-writing annotation. That is a large machine aimed at a shrinking target.

**Rescope to:**

1. **Tier 0 — write the rule down where agents read it.** "Cite symbols, not lines" exists **only** in handoff 048 §4 and is propagated by ad-hoc ADR annotations. It is in neither `CLAUDE.md`, `CONTEXT.md`, nor `docs/agents/*.md`. A handoff is a snapshot; a convention that lives only in one is folklore, and the next agent will not find it. Three lines in `docs/agents/domain.md` closes the class permanently. **This is the single highest-value records action on the board.**
2. **Optional, Tier 1 — one annotation-preserving sweep of ADRs 0038–0044**, converting line citations to symbols. Not a re-pointing sweep (which buys six months, as #78 correctly argues) — a *form* conversion, which buys forever. `0043:255-257`'s annotation and 0029's historical Context must survive untouched.

Worth knowing for item 2: there is **no `scripts/` directory** in the repo, markdown is not in `lint-staged`'s glob, and no workflow checks citations. So the sweep has no mechanical backstop and rests on review — which is one more argument for doing item 1 instead.

### #106 — real, or theoretical?

**Real as a gap, theoretical as an exploit — and worth ~20 lines anyway.**

Verified on `370f1e1`: `eslint.config.mjs` contains **zero** occurrences of `node_modules/@miolos`. `webWallImportPatterns` bans exactly two spellings per group — the bare subpath (`@miolos/db/publishing`) and the relative source path (`**/packages/db/src/**`). In a pnpm workspace `apps/web/node_modules/@miolos/db` is a symlink to `packages/db`, so `../../node_modules/@miolos/db/src/publishing` resolves, typechecks and bundles identically and matches neither glob. The same hole exists in the dynamic-import selectors, which key on `packages\/(db|core)\/src`.

Against it: nothing in the tree writes an import that way, nobody reaches for that spelling by accident, and the OG surface has `gameCard`'s signature as a second layer. So this is not a live vulnerability.

For it: the bans it evades are the load-bearing ones (`packages/db/src`'s server-internal tables, `packages/core/src`'s server-only daily-content schemas, `@miolos/games` off the card surface), the three wall suites already exist (`eslint-db-wall.test.ts`, `eslint-og-wall.test.ts`, `eslint-free-play-wall.test.ts`), and the `T-LINT` frontier is live at `S47`. It is a bounded, fully-specified, ~20-line config change with three red-then-green probes.

**Recommendation: do it, as a Tier 1, in the same sitting as another small fix.** Do not give it a plan doc or an ADR.

### #111 — live, and the filed fix is incomplete

The defect reproduces exactly as described: `content/termo/answers.csv:373` is `termo,termo`, `cronPublishResponseSchema` spells `termo` as a game key, and an independent scan of all 400 answers in both columns against a realistic response body found **exactly one** substring hit. 0.25 % per root run.

Three corrections were posted to the issue:

1. **`apps/api/src/publishing/service.ts:154` is binairo's seed, not termo's.** The termo draw is `drawUniformIndex(pool.length)` at `service.ts:732`.
2. **The governing ADR is 0024 decision 1, not ADR-0010** (`service.ts:408`). The constraint the issue states is right; the number is wrong.
3. **There is a third unsatisfiable assertion site.** `apps/api/test/cron-publish.test.ts:615` asserts `not.toContain(answer.normalized)` over every log line, and the route emits `JSON.stringify({event:"cron-publish", game, ...result})` per game (`apps/api/app/cron/publish/route.ts:172-174`) — so the termo log line contains `"game":"termo"` too. **A fix that only narrows `serialized` leaves `:615` red and the flake alive.**

Smallest correct fix: ~4–8 lines, test-only. Tier 1.

### #65 / #66 — one defect, two tickets

Closed **#65** as subsumed by **#66**, with the evidence in the comment: the shipped TSDoc at `apps/web/src/play/use-pointer-stroke.ts:215-220` names #66 as the owner of the trace and the rect cache. #66 is the strictly larger ticket (it carries the browser-trace precondition and the `onPointerUp`-per-tap half on Binairo).

Note that #66's remaining scope is gated on evidence that does not exist yet. **It should not be picked up as "a small perf fix" — it is a measurement task first**, and if the trace is clean the correct outcome is to close it and leave the hook alone.

### #67 and #61 — the two genuinely user-visible a11y tickets

**#67 is real and cheap.** Verified: all three `play-view.tsx` files render the hint `<button>` before `<section className={screen.board}>`, while `screen.module.css:412-418` paints `"bar" / "title" / "board" / "hint"` on ≤1140px. A keyboard user on a phone tabs back-link → hint (bottom of viewport) → board → brushes (above the hint). WCAG 2.4.3 on every play screen's primary path. The shared sheet is now imported by **six** screens (three dailies + three free-play), so the fix is worth more than when it was filed and is still one edit.

**#61 is real but is a rewrite.** `binairo/grid.tsx:16-17` still documents 64 ordinary tab stops. It is a genuine inconsistency — Binairo is the only grid game that is not a composite widget — and ADR-0030 consequence (b) owes it. But it replaces a shipped board's whole focus model, so it is Tier 2 with the eight-step flow, and its one non-negotiable (adopt `onStrokeEnd`, do not derive a second mechanism) is a real landmine.

### #62 / #63 / #66 — the perf-and-polish cluster, sorted by whether a player can tell

- **#63 (user-visible, certain).** The clock physically jitters on every tick, on six surfaces, measured at ≈6.1px per digit. This is the one to do.
- **#62 (not user-visible; correctness-shaped).** Binairo is 64 cells — nobody will feel the extra array. What it actually buys is the "the record's CONTENT changed" contract, which is why the issue calls it correctness. ~6 lines. Do it opportunistically; do not schedule it.
- **#66 (speculative until traced).** Measured in jsdom, which has no layout engine. The number of forced-layout *opportunities* is known; the cost of each is not.

**Verdict on the perf cluster: one of the three is worth a ticket, and it is #63 — which is a rendering bug, not a perf ticket at all.**

### #13 — epic, not stale

Keep it open. It is the only place the v1 shape is written down as one document, and its children are still resolving: M0 (#14, #15), M1 (#16–#21), M2 (#22–#28) and three of M3/M4 (#29, #30, #31, #34) are closed; #32, #33, #35, #36, #37 remain. **The `ready-for-agent` label on it is wrong and mildly dangerous** — it reads as an invitation to implement v1 in one go. The five-label vocabulary has no "epic" role, so this was flagged rather than mislabelled into a different wrong bucket.

### #104, #64, #51 — the three that need a decision more than an agent

- **#104** carries two explicit open questions ("whether `/arquivo` and `/arquivo/mes/<mês>` get cards at all"; "whether the day card names the four games"). `needs-triage` is the correct label and it was left alone.
- **#64** has enough to act on *technically* — the three requirements are fully enumerated — but the cost is ADR-0033 consequence (d): shipping a motif name kills the markup-substring tripwire that currently proves `@miolos/games/nonogram` tree-shakes out of `apps/web`. That is a trade, not a task. `needs-triage` left alone.
- **#51** does **not** have enough to act on: impeccable's public tracker is still unidentified, and the mechanism is in upstream's `extractFindingIgnoreValue`. It is genuinely inert. One thing did move: **impeccable is at 3.6.0 and the repo pins 3.4.0**, and 3.6.0 was released after the issue's 3.5.0 check — so re-checking it is a five-minute Tier 0 chore that could close this. If 3.6.0 does not ship value extraction, `wontfix` is the honest label.

### #126 — the ticket that has to hold

Its arithmetic checks out against the tree: `ci.yml` triggers on `pull_request` with **no `paths:` filter**, so a docs-only PR pays for the full property suite; and `docs/adr/0023-proved-not-sampled-property-testing.md:33` does say "Run counts are a floor, never below 100 for the main [invariants]", which is what forces the full run into every PR.

**The discipline that matters is not in the ticket.** #126 is the seventh ticket in this chain. It should be the last. If its implementation surfaces a further test-infra defect, that defect is Tier 0 or Tier 1 and gets fixed in the same PR — it does not get a ticket.

---

## Close or already done

| Issue | Action taken | Evidence |
|---|---|---|
| **#76** Correct `FORBIDDEN_DAILY_KEYS`' TSDoc | **Closed as completed**, comment posted | `packages/core/src/testing.ts:8-14` already carries the corrected sentence; both `"canonical"` and `"normalized"` are members. The issue's own instruction was "If the register entry landed, close this as done and say so." |
| **#65** `elementFromPoint` per pointermove | **Closed as not planned (duplicate)**, comment posted on #65 and note posted on #66 | `apps/web/src/play/use-pointer-stroke.ts:215-220` names #66 as the owner of the same fix |

**Nothing else was closed.** Every other issue's premise held on inspection, or the judgement involved is Fernando's.

**Candidates for closure, left open for Fernando:**

- **#51**, if impeccable 3.6.0 does not ship value extraction for `low-contrast` and `cream-palette`. The residual risk is already recorded in `.impeccable/config.json`'s two `reason` fields, so closing it loses no information.
- **#78 as filed.** Its premise is *more* true than when written, so it does not meet the "demonstrably false" bar for a unilateral close — but its prescription is superseded by a convention the repo already adopted. The evidence is posted on the issue; the rescope is Fernando's call.

---

## Needs Fernando

Five items, in the order they block work.

1. **#58 — the late-sync window.** Two sentences, above. Answer with "accept the window" or "bounded grace"; either way it is a one-paragraph ADR amendment. **Blocks nothing, so answer it whenever — but it has been open since 2026-08-01.**
2. **#32's shape.** "The player's habitual play window" has no schema, no scheduler and no derivation anywhere in the tree, and it is the phrase three ACs turn on. This needs `/wayfinder` or a grilling session before it can be sliced — and it gates #33 and #36, i.e. the whole rest of M3/M4 except #35. **This is the single highest-leverage decision on the board.**
3. **#64 — name the Nonogram picture, or not.** Costs the markup-substring tripwire. A better payoff for every player, especially screen-reader users, against a real loss of a mechanical guarantee.
4. **#104 — do `/arquivo` and `/arquivo/mes/<mês>` get OG cards at all?** The issue itself says an index card "is probably just the site card with extra steps". A yes/no unblocks a clean Tier 2.
5. **#51 — `wontfix`?** Upstream-blocked with no tracker. Check impeccable 3.6.0 first (Tier 0); if it does not help, close.
6. **#78 — close as filed, or rescope?** The drift it reports is four times worse than it says, but the checker it asks for would police a citation form the repo abandoned at handoff 048. Recommended: rescope to the three-line convention note and close the checker half. Left open because that is a judgement, not a fact.

Two labels were corrected on the way, both clear-cut: **#58** and **#59** moved from `ready-for-agent` to `ready-for-human`. #59 requires creating a Neon role and rotating a live production credential across three Vercel environments — no agent can do it, and leaving it `ready-for-agent` means an AFK run will pick it up and stall.

**Also flagged, not changed:** #13 is labelled `ready-for-agent` and is an epic. #37 is labelled `ready-for-agent` and contains at least three ACs only Fernando can satisfy ("deletion request exercised end-to-end in production", "backup/restore posture tested", "launch checklist run"). Both should probably be split or relabelled, but the five-label vocabulary has no better bucket and the call is judgemental.

---

## Recommended order of work for the next week, product first

The v1 critical path is short. **M0, M1 and M2 are done. M3 is three-fifths done (#29, #30, #31 closed; #32, #33 open). M4 has one of four (#34 closed; #35, #36, #37 open).** Five product tickets stand between here and a web launch.

**Day 1 — clear the fog and ship one small thing.**

1. **#32 fog-clearing session** (`/wayfinder` or `/grill-with-docs`). Not implementation — settle what "habitual play window" *is*: where it is derived from, where it is stored, what schedules the send, and whether the email hedge is the same job. This unblocks #33 and #36 and is the only Tier 3 on the board that matters.
2. **#63** in parallel — one Tier 1, a handful of CSS lines, visible on six screens. Chosen deliberately as the first merge after nine infra PRs: it is small, it is product, and a player can see it.

**Days 2–3 — the first real product slice since 2026-08-16.**

3. **#35 M4 Onboarding.** Unblocked since #27 closed. A clean vertical slice: one new surface, first-visit persistence per identity, pt-BR copy, `impeccable detect`. The full eight-step flow, and it is the right ticket to prove the tiered flow on.

**Day 3 — end the test-cost loop, once.**

4. **#126.** It has to happen and it is fully specified. Time-box it: it is the seventh ticket in that chain and must be the last. Any further test-infra defect it uncovers is fixed in the same PR without a ticket.

**Day 4 — the Tier 1 sweep, one sitting, one PR each.**

5. **#67** (hint tab order — one CSS edit, WCAG 2.4.3 on every play screen), **#111** (~4–8 lines, test-only, with the third assertion site from the comment), **#106** (~20 lines of ESLint config + three wall probes), and **#62** if there is time (~6 lines). Four small merges, no plan docs, no ADRs, no handoffs. This is the tier working as intended.

**Days 5–7 — back on the milestone.**

6. **#33 M3 telemetry** — and consider splitting the four events that do not depend on #32, so it stops waiting.
7. **#36 M4 settings and paper-dark** — same: the palette and the reduced-motion audit do not need #32.

**Any time, in five minutes, by whoever is next in the repo (Tier 0, no ticket):** write "cite symbols, not lines" into `docs/agents/domain.md`. It is the only rule on this board that removes a whole class of future work, it currently lives only inside a handoff, and it costs three lines. See #78 above.

**Explicitly not this week:** #37 (blocked by everything and needs splitting), #83 (a new endpoint and contract, not on the v1 path), #103 and #104 (both blocked on a Fernando decision), #61 (a shipped-board rewrite), #64 (needs the tripwire trade decided), #66 (needs a browser trace first), #59 (production credential rotation, Fernando's hands), #51 (upstream), #74 (real, but the buffer has months of runway and the product half is undecided).

**The one-line version:** clear #32's fog, ship #35, kill the test loop with #126, and sweep the six Tier 1s in a single day. Everything else waits.
