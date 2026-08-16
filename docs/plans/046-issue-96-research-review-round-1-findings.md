# Step-3 plan review, round 1 — issue #96, plan 043 revision 1

Five reviewers, one lens each, all run against the real tree in `/home/ferna/projects/miolos-wt/96`.
**Verdict: 5 × REJECT.** Three reviewers said return to **step 2** (plan revision), one said step 4, one said step 2 for a subset.

This file is the input to the fix round. It is a point-in-time record, not a living document.

---

## Blockers

### F1 / B1(test) — `T-WEB-S56`'s `unserializableProps` cannot see the card's props. Two reviewers, independently, with probes.

D5, R3, D9 and §10 all name `T-WEB-S56` as the gate on the new RSC boundary. It is not one.
`unserializableProps` (`apps/web/test/route-ssr.test.tsx:168-199`) walks the **returned element**, recursing into `element.data.props` only. `ArchiveDayPage` returns `<ArchiveDayView …/>` unrendered, so `ArchiveDayCard` and its props never exist during that assertion.

Probe, verbatim copy of the walker, page → server component → client component carrying a live function prop:

```
 ✓ probe > E: does T-WEB-S56's walker see a NESTED server component's child props?
 Test Files  1 passed (1)
```

Green on `expect(found).toEqual([])` **with a function prop in place**. R3 names this hazard ("an HTTP 500 on the real route and no component test sees it") and then cites a test that cannot see it.

**Fix.** The real guard is `pnpm typecheck`: declare `ArchiveDayCard`'s props as a `readonly` interface of `string`/`number` members only, so passing a composer is a red typecheck. Name that as R3's mitigation. If a runtime guard is still wanted it must walk the **rendered** output — `unserializableProps(ArchiveDayView({date, games}))` — which is a test edit, so D9's "`T-WEB-S56` — no edit" row and §12 change with it. Do **not** add a row to `T-WEB-S56`'s `ROUTES` table: that table's claim is "every route the impeccable preflight fetches", and a nested-view probe is a second meaning (`docs/agents/test-ids.md:20` → new id or sibling letter).

### F2 — §6 contradicts D5 on `archiveGameRoute`, and §6's version falsifies D8 before the build runs.

§6's `day-view.tsx` row says `accentVars`, `archiveGameRoute` and `styles.card*` "move with the card". D5's prop list contains `href` and its stated consequence is "the client component imports **no `messages`** module". Both cannot be true.

If `archiveGameRoute` moves, the card imports it, and the repo's idiom is the barrel — `apps/web/src/i18n/index.ts:11-19` re-exports `messages` alongside `archiveGameRoute`, and already carries a **committed, measured** note that this exact hazard is real (`medalCopy` deliberately does not ride it, plan 035 §14 watch item 2).

**Fix.** Delete `archiveGameRoute` from §6's card row. State D5's import list exhaustively: `react`, `next/link`, `../../src/play/accent`, `./arquivo.module.css`, `../../src/archive/use-archive-day-state` — and nothing from `src/i18n`, barrel or leaf. Add a §12 exit-criterion grep on `day-card.tsx` for `src/i18n`.

### B1(ADR) — `route-client-js.mjs:216-218` is unconditionally falsified, and §7(c) clears it.

The real comment: *"The index, the month page and the day page ship near-zero client JS and ride the shared 40 KB with enormous slack — measured at -38.7 KB against `/` … They are BUDGETED anyway, because 'ships nothing today' is precisely the route that acquires a library silently."*

After this ticket `/arquivo/[data]` does not ship near-zero client JS — §8 consequence (b) says so itself ("the archive's client graph gains `play-record.ts` (zod + `@miolos/core`) **for the first time**"). §7(c) audits only `:54-55` (the `messages` chunk) and makes the only comment edit conditional on that. `:216-218` is falsified whatever the chunk does. The comment was written to be re-checked by the first ticket that put JS on these routes.

**Fix.** §7(c) becomes an **unconditional** amendment row, separate from the conditional `:54-55` branch.

### B2(ADR) — the plan's `CONTEXT.md` claims are false, and the archive's real domain term is never named. **Confirmed independently: `grep -c "Concluído" CONTEXT.md` → 0.**

- §5: *"CONTEXT.md's day verbs are Concluído / Jogado"* — the word is not in the file.
- §7(l): *"the chip renders Concluído/Jogado semantics that the glossary already carries … Checked, not skipped."* — false in the same way.

`CONTEXT.md:11-13` carries `Completion (on time) · Conclusão`, **`Late completion · Conclusão tardia`** ("A past daily solved from the archive. Recorded; never feeds streak, time stats or Dia Perfeito … a *lost* archived Termo is **played**, not completed"), and `Played · Jogado`.

**Every completion this chip can render is a late completion.** On the hub "Feito" means an on-time completion that feeds the streak; on `/arquivo/<data>` the identical word will mean one that feeds nothing — and the archive's own shipped copy says so one route away (`messages.archive.play.note`).

This is the seventh instance of handoff 041 §4's pattern, written by the audit meant to catch it. It does **not** veto "Feito" (`messages.ts:133-137` documents a deliberate three-way register split, so per-surface wording is a live convention) — it vetoes deciding it on a false record.

**Fix.** (a) §5 quotes the real rows and states plainly that neither candidate is the glossary's archive term. (b) §7(l) becomes a row that is owed something. (c) ADR-0056 decision 3 records the on-time/late collapse and why it is acceptable. (d) Keep the "reversible in one line" claim — it is true and it is the plan's best asset here.

### B3(ADR) — the plan names the wrong test as the gate on its own ADR-0041 claim.

D4, D9, §9 step 7 and §12 all cite **`T-WEB-S72`**. Its only scan (`ink-on-accent.test.ts:57-81`) tests `background: var(--accent)` **+** `color: var(--paper-desk)` — a desk label on an accent fill. It says nothing about accents colouring words.

The real gate is **`T-WEB-S73`** (`ink-on-accent.test.ts:198`), whose `SHARED` list contains `app/arquivo/arquivo.module.css` at `:212` and whose scan at `:246-272` is `/(?:^|;)\s*color:\s*var\(--accent[a-z-]*\)/m`. The conclusion ("gated for free") holds — via S73, not S72. **`T-WEB-S73` appears nowhere in the plan.**

**Fix.** Correct D4, D9 and §12 to cite `T-WEB-S73` (`:198`, SHARED at `:212`).

### D-01(design) — the chip's geometry is unspecified, the collision is certain, and the visual gate is provably blind to it.

D6 states `position: absolute`, "top-right", and a `--done-chip-reserve`, and specifies **none of `top`, `right`, or the reserve's value** — deferring the whole question to "a real browser look" at step 7.

Measured in Puppeteer on the real card built from `arquivo.module.css` + `tokens.css`, placement `top: var(--space-2); right: var(--space-3)`:

```
1440x900  card 288x95
  chip ∩ kicker = 10.09px vertical × 72.95px horizontal   ← REAL COLLISION
  chip ∩ title  = -8.91  (no overlap)
  chip.left - tape.right = 13.65
```

The collision with `.cardKicker` is **certain, not hypothetical**, and `--done-chip-reserve` is the only thing preventing two text runs on the same pixels.

**`impeccable detect` cannot catch a wrong reserve.** `text-occlusion` (`checks.mjs:5195-5258`) samples `cols = clamp(6,30,round(w/12))` × `rows = clamp(1,4,round(h/14))`; for the kicker that is 21×1, of which 6 fall inside the chip → **occFrac 0.286** against the rule's text-occluder bar of **0.45** (`checks.mjs:5238`). Confirmed by running detect on a colliding fixture: one finding, `cream-palette`. No `text-occlusion`.

A plan may defer a *check*. It may not defer the *constants a gate-invisible failure mode depends on* to an eyeball on a 10px overlap at 11px type.

**Fix (one of):** pin `top`, `right` and the reserve as literals derived from the widest chip (`Jogado`, measured 81.52px desktop / 75.42px under the mobile override) plus stated clearance, **and** assert in `T-WEB-S219` that the declared reserve ≥ the chip's declared max width; or take D-03 and delete the failure mode.

---

## Majors

### D-03 — a false binary: the sheet's own flex idiom is never weighed. *(May dissolve D-01, D-02 and D-04 together.)*

D6 offers exactly two options — absolute corner stamp, or the hub's `--cta-box-min-height` reserved box (correctly rejected: on an archive card that box would be permanently empty). It never considers the third, which is **this stylesheet's existing idiom**: `.rowLink` at `arquivo.module.css:135-143` is `display:flex; justify-content:space-between; align-items:center`.

Make the kicker line that row — `.cardKicker` left, chip right, `min-height` = the chip's box. The row is **always full** (the kicker fills it in both states), which is exactly the argument that legitimises the hub's reserved box and that the archive card denies only for the vertical CTA slot. Yields: zero CLS without leaving flow; no reserve constant (D-01 dissolves); no overlap with `.tape` or the title at any width (D-02 dissolves); no `text-occlusion` exposure; chip stays in the system's flow vocabulary.

Cost: ~15px of card height in both states, always occupied.

Note this makes §5's "reversible in the stylesheet alone" framing misleading — D-03's shape is a component change.

### D-02 — the plan reasons about the roomiest viewport and calls it the tight one.

D6 says "at the 390px viewport the single-column card is ~350px wide and the two bands do not meet". True and irrelevant: `.cards` collapses to one column below 768px (`arquivo.module.css:407-409`). The tight case is **desktop** — `.page` is `max-width:760px` with 80px padding → 600px content; two columns with a 24px gap → **288px cards**, 62px narrower than mobile.

```
1440x900 → 13.65px      390x844 → 50.70px      360x800 → 35.70px
```

**Fix.** State the desktop 288px card as binding; reorder §12's exit criterion to 1440×900 first.

### D-04 — the reserve is spent on an element that does not need it, at real cost.

D6 spends `--done-chip-reserve` as `padding-right` on **both** `.cardKicker` and `.cardTitle`; seam 6 pins the title arm. Measured: chip ends y=111.09, `.cardTitle` starts y=120 — **−8.91px, no overlap**. The title reserve buys nothing and costs a lot: content measure at desktop is 246px; an ~85px reserve leaves ~161px, and `Nonogram` measures 118.4px at 26px in a generic serif (Fraunces 550 is wider). A wrapped `Nonogram` on one card and not the other three breaks the grid rhythm — in **both** states, on the ~99% of visits with no record. That is the "permanent cost for a rare state" the plan's own rejection of the reserved box argues against.

### F3 — the date-keyed single slot has the identical defect one level up; "one page renders at a time" is inherited prose, not a measurement.

D1 and ADR-0056 decision 2 claim a single slot keyed on the date is "what makes N per-card consumers safe". True only for N consumers **of one date**. §2's own diagnosis applies verbatim to two *dates* against a date-keyed slot. `late-result.tsx:110-112` asserts "two archive dates cannot coexist (one page renders at a time)" — a comment, not a measurement — and the archive day page is the **first** surface where the date is a URL variable and back/forward between two dates is the primary interaction.

```
 × A: TWO useRecordSnapshot consumers, different games, one page
 × D: the SAME single-date-slot design with TWO DIFFERENT DATES on one page
 AssertionError: … 'Error: Maximum update depth exceeded.…' was thrown
 Tests  2 failed | 2 passed (4)
```

The two passes are the negative control (`usePriorConclusion` does not loop) and the **positive control** (four `useDayState` consumers, one date, four games — clean). §2's measurements are all correct; the plan stops one level short. The failure mode is an uncaught error in render — a white screen on client-side navigation between two archive days.

**Fix.** Either make the slot immune (`Map<string, state>` bounded to a few dates, ~5 lines) or verify the premise in a real browser at §9 step 7 and record the result in ADR-0056. Reword ADR-0056 decision 2: the safe property is "N consumers **of one key**", which is exactly what `T-WEB-S213` proves.

### F4 — the live subscription's justification does not transfer, and it opens a done → pending flip the plan says cannot happen.

(i) D1's stated reason ("a completion settled by `sync.ts` cannot reach one reader and not another") is `day-state.ts:122-126`'s, carried over unexamined. `sync.ts` moves `pendingSync`/`syncOutcome`; this projection branches on `concluded` and `outcome` only. The real reason (a second tab concluding the archive game) is never given.

(ii) `subscribeToPlayRecords` is a 1s poll **plus** a `storage` listener. `prunePlayRecords` runs on **every play mount** (`use-play-lifecycle.ts:141`) and deletes settled records dated before that mount's date beyond `RETAINED_PAST_RECORDS = 50` (`play-record.ts:574, 632-646`). Tab A sits on `/arquivo/2025-11-02` with a chip; tab B opens `/sudoku`; the prune drops the record, fires `storage`, and **tab A's chip vanishes while the player is looking at it.** Same-tab paths are safe (verified: day-page-D → archive-play-D prunes with `keepDate = D`, and `record.date < keepDate` is false against itself).

Not an ADR-0031 violation — done→pending is the understating direction — but an unrecorded UI event on a plan claiming completeness about exactly this.

**Fix.** Replace D1's copied justification with the applicable one; record the disappearance path in D7 and ADR-0056 consequence (c). Put the alternative on the table: a **no-op subscribe with teardown** (`usePriorConclusion`'s shape) — the chip still appears at hydration, the 1s poll leaves a page that writes nothing, and the flip becomes unreachable.

### S1(issue) — the cheaper repair of the issue's own mechanism is never weighed.

The issue points at `useRecordSnapshot`. The plan proves it broken and **routes around it**: a new module, ~50 lines of acknowledged duplication, a cross-check test that exists only to insure that duplication, and two ADR decisions holding it up. It never asks whether the hook should simply be **fixed** — a `Map` keyed `` `${game}|${date}` `` bounded by `GAMES.length` is ~5 lines, fixes a latent bug on `main` for every future consumer, and lets `day-card.tsx` call `useRecordSnapshot(game, date)` directly, as the issue prescribes. `use-record-snapshot.ts` is **already in the archive's graph** under this plan (D5 imports `subscribeToPlayRecords` from it), so no wall is crossed.

Counter-argument the plan should make: the Termo `outcome === "lost"` → `"played"` branch must still be re-derived (T-WEB-S183 keeps `day-state.ts` out), so ~8 lines survive either way. **8 lines vs 50** changes whether ADR-0056 decision 1 is needed at all.

**Fix.** Add a §2 subsection stating the multi-key-cache repair as the first alternative, measure it (extend the probe: does a `Map`-keyed `readSnapshot` stabilise four consumers?), and take it or reject it in writing. "We could not share it" and "we chose not to repair it" are different decisions; only one is currently recorded.

### S2(issue) — #96's leading constraint has no mechanical guard.

*"Never a server read"* is the issue's first constraint. Honoured in design, listed as a non-goal, **checked by nothing**. `T-WEB-S183` bans module names, not `fetch`. `T-WEB-S56`'s arms check SSR-without-throw and Flight-serializability. §10 waives the Zod gate correctly, which is why no parse-shaped check catches it either.

**Fix.** Stub `globalThis.fetch` with a throwing spy in `T-WEB-S216` (or a new arm), render both states, assert it never fired; optionally a source scan (the `ink-on-accent.test.ts` idiom). Add the exit-criterion row.

### M4 / S3 / D-07 — the new accessible name drops the verb. **Three reviewers, converging.**

D3 replaces `"Jogar {game} de {longDate}"` with `"{game} de {longDate} — concluído"`. The diagnosis is right (ADR-0053 decision 10 layer 2 restores the closed state, so "Jogar" names a destination the player will not reach). The fix overcorrects: the new name states a **state**, not a **purpose**, on an interactive `<a>`. WCAG **2.4.4 Link Purpose (In Context)** (Level A) asks the name to make the destination determinable. A screen-reader user tabbing four cards hears three *"Jogar Sudoku de …"* and one *"Termo de … — concluído"* — the odd one out is the only card whose name does not say what activating it does.

Sharpening it: ADR-0053 decision 10 **layer 3** is explicit that the board **is** playable cross-device and post-retention, and D7 accepts exactly that gap. The label is written as if layer 2 were the only case. The em-dash precedent D3 borrows (`archive.dayRowAria`) is a **row** that never carried a verb to lose.

Also unnamed: the accessible name of a link **changing at hydration**. `T-WEB-S218` asserts both end states and nothing about the transition.

**Fix.** Keep a verb naming the real destination — e.g. `"Ver o resultado do {game} de {longDate}"` — or compose verb + em-dash + state. Both keep 2.4.4 and keep the four names parallel. State the post-hydration name change explicitly.

### M1(ADR) — a third accent ring ships with no gate.

ADR-0041 decision 5 enumerates two sites; `T-WEB-S73:343-359` asserts exactly those two by name (`3px` conclusion stamp, `1.5px` hub chip). This ticket ships a **third** `border: 1.5px solid var(--accent)` outlining an already-legible label, and D4's whole response is "the figures are in the plan and will be in the stylesheet". ADR-0041 consequence (f) rules directly: *"`impeccable detect` cannot see any of this and never will, so **every decision here is gated by one test file or by nothing**"* — and D4 has just established (correctly) that the detector never checks a ring. A comment is not a gate.

**Fix.** Widen `T-WEB-S73:343-359` in place to assert `.doneChip`'s border in `arquivo.module.css` (no new id, the `T-WEB-S100` burn precedent D9 already invokes). Add a §7 row for ADR-0041 decision 5 stating whether its enumeration is closed (owes an annotation) or exemplary (owes a sentence). Note `late-result.module.css:90`'s 3px postmark is already a third unenumerated ring on `main`.

### M2(ADR) — the transplanted union is documented as the one that cannot see a late completion.

`day-state.ts:26-30`: *"**CONTEXT.md's verbs, minus the one a local reader cannot see: a LATE completion is an archive fact the server owns (#31)**, so this reader has three states, not four."* D1's case for re-deriving rests on three differences and misses the fourth and most consequential: **on the archive, the excluded state is the only state.** This is the mechanical root of B2, and it destabilises `T-WEB-S214`, whose title claims semantic agreement where `day-state.ts:26-30` says the two surfaces are precisely where semantics diverge.

**Fix.** D1 gains this as a fourth named difference. Narrow `T-WEB-S214`'s claim in words to what it proves — *the two projections read the same record the same way* — not that the states mean the same thing.

### M3(ADR) — ADR-0056 decides three things, describes two, restates one, and omits the novel one.

**Needed** — decisions 1 and 2 are real and contestable, which clears CLAUDE.md's bar. But: decision 5 is a CSS positioning choice the plan itself calls stylesheet-reversible; decision 6 says outright it is "restating ADR-0031 decision 6" plus "no read endpoint ships (ADR-0053 decision 10, **unamended**)" — that is what a `Depends on:` header is for; decision 4 is a measurement and an application of ADR-0041 decision 5, and per M1 the part needing record is the missing gate. **Missing:** the B2/M2 decision — *the archive publishes a late completion under the hub's on-time word, using a union built to exclude late completions.* That is the one thing a future reader will need the reasoning for.

**Fix.** Four decisions that bind beats six that mostly narrate.

### M5(ADR) — §7(j)'s DESIGN.md clause is scoped to the wrong difference.

`DESIGN.md:48`: *"**Game card** (Hoje): … done state is an outlined 'Feito' stamp chip (rotated −3deg) + tabular result, pending state is a solid accent button."* §7(j) proposes a clause naming only the dropped result. D6 changes more: the hub's chip is `inline-flex` inside `.done`'s reserved box in the same slot as the pending button; the archive's is out of flow with **no pending counterpart at all**. `arquivo.module.css:288-292` already declares the day card to be "the hub's Game-card register", so `/impeccable` reading `DESIGN.md:48` finds a chip where the entry does not describe one and no pending state where it promises a solid accent button.

### M1(test) — D8's measurement cannot be produced by the command the plan names.

`pnpm bundle-check` prints a First Load JS table with deltas, chunk-attribution counts, and marker presence checks — and those markers are the Termo answer/dictionary sets. **Nothing in its output says which chunk carries `messages`.** The claim lives at `route-client-js.mjs:53-58` as prose with no assertion behind it. So D8's "two outcomes, both pre-decided" cannot be decided by pasting `bundle-check` output — exactly the shape the evidence rule forbids.

**Fix.** Either name the real procedure (read `.next/diagnostics/route-bundle-stats.json`, take `/arquivo/[data]`'s `firstLoadChunkPaths`, grep those files for a stable `messages` marker) and paste that; or drop the branch pre-decision, report only the measured delta against −38.7 KB, and say in the PR body that the sentence was not re-measured.

### M2(test) — the detect plan drops the only run in which the project config applies.

§11 replaces the run entirely with four `file:///` scans plus two `--no-config` controls. Correct **for the done state**. But the **pending** state is not unreachable and this ticket changes it: `--done-chip-reserve`, the `padding-right`s and `.doneChip` all ship unconditionally. The config's `low-contrast`/`cream-palette` ignores are `files`-scoped to `localhost`/`vercel.app`, so the localhost run is the **only** run producing the signal the repo gates on.

**Fix.** Keep the file-mode pair for the done state; **add** the ordinary localhost scan of `/arquivo/<data>` at 1440×900 and 390×844 for the pending state.

### M3(test) — seam 6's assertions cannot fail on the defects they claim to cover.

1. The reserve's value is unpinned — `--done-chip-reserve: 0px` passes, and the overlap claim is the whole point.
2. `.card { position: relative }` is not asserted; remove that line (`arquivo.module.css:305`) and the chip positions against the page while seam 6 stays green. The hub's own `T-WEB-S17` pins **both** sides of its mechanism.
3. `.cardKicker` is named in D6 as spending the reserve but seam 6 asserts only `.cardTitle`.

### M4(test) — seam 3's spy ordering is inverted and would go red for the wrong reason.

Plan order: spy → seed → render → assert neither spy fired. Shipped `T-WEB-S17` (`hoje.smoke.test.tsx:430-433`) is seed → spy. Not stylistic: `writePlayRecord` goes through `store.getItem` (`play-record.ts:450`) and `setItem` (`:520`), so a spy installed before the seed records the seed's own reads and fails against a **correct** implementation. As written, seam 3 is red before and after — not a seam.

### D-11(design) — the file-mode fixture is not the shipped page and cannot settle D-01.

§11's shell links `tokens.css` + `arquivo.module.css` only. Missing: (1) **`apps/web/app/globals.css`**, where `body { background: var(--paper-desk); background-image: var(--texture-dots); color: var(--ink) }` and `a { color: var(--ink) }` live — without it the fixture paints cards on **white** with UA-default link blue, changing `cream-palette` (the plan's own expected baseline finding), every `low-contrast` composite and every adjacent-colour computation. (2) The real faces: `next/font` binds `--font-fraunces`/`--font-instrument-sans`; under `file://` those are undefined and every text metric is wrong — so the run cannot answer the layout questions it is being asked to cover. (3) `.card` carries `style={accentVars(game)}`; the fixture must preserve those inline custom properties or the ring has no colour.

---

## Minors and nits (fold in on the same pass)

- **S4** — ADR-0056 decision 2 reads as a general prescription without stating that the prescribed shape carries the identical hazard across dates. State the bound: **one date per rendered page**.
- **S5** — D1 argument 3 (`day-state.ts` is committed to the server's date) is contradicted by the plan's own `T-WEB-S214`, which calls `readDayState(archiveDate)`. Arguments 1–2 and the wall are decisive on their own; strike 3 or restate it as binding on production callers only.
- **S7** — `use-prior-conclusion.ts` and `late-result.tsx` are edited only to add a measurement sentence, the third and fourth copy of it. Cap each at one sentence citing ADR-0056 by number. If S1 lands, the first disappears entirely.
- **S8 / N6** — the const hoist couples hub copy to archive copy **bidirectionally**; `T-WEB-S220` guards one direction only, and `messages.ts:133-137` documents a deliberate register split for two other done/played pairs. Either two literals plus an equality assertion, or name the coupling in §5.
- **S9** — §6's header says "Modified (8, one conditional)"; the table lists nine non-conditional rows plus the conditional.
- **S10** — "the ticket's pre-assigned range" is false: `gh issue view 96` assigns no range. Cite `docs/agents/test-ids.md:41` / handoff 041 as the source.
- **S11** — the issue names `archive-day.test.tsx`; the plan puts all seven new tests in two new files and touches the named one only as "must stay green". The reason (no `localStorage.clear()` in its `beforeEach`) is stated as an implementation detail, never as the reason the named file was passed over. Owes one sentence.
- **S12 / F8** — D6's "carried over verbatim" list omits `padding: 5px var(--space-3)` (`page.module.css:239`) while carrying the mobile override. Implemented literally, the desktop chip ships with no padding.
- **F5** — `T-WEB-S214`'s "every record shape" omits `pendingSync: true` and `syncOutcome: "rejected"`, both reachable on an archive date (`messages.archive.result.rejected` is shipped copy). The card would stamp **Feito** on a date whose own panel says the completion was not registered. May be right; must be decided.
- **F6** — `pnpm typecheck` first runs at step 11, though per F1 it is the ticket's only real guard on the boundary that lands at step 6. Add it to step 6.
- **F7 / m2 / m3** — seams 1 and 6 are guards, not design-driving reds; seam 4's "no duration" arm is vacuous within this ticket (the route renders no time today) and there is no render-level arm for an in-progress record.
- **m1** — `apps/web/test/archive-day-state.test.ts` cannot hold seam 1 (it renders JSX). Verified: `.ts` fails at transform. Rename to `.tsx` in §6 and §9.
- **m4** — `T-WEB-S184` is listed under "widened in place, no new id" while D9 also says "no new assertion". It is a must-stay-green, not a widening.
- **m5** — §10's #107 clause ("a single red root run is not a finding") is an escape hatch as written. The plan does **not** depend on #107 landing (it mandates `TURBO_CONCURRENCY=1` unconditionally), so this is wording: a red is diagnosed, never dismissed.
- **m6** — with eight ids landing in two new files, state `apps/web`'s convention (ids on `describe(...)` only; shipping them on `it(...)` too was step-6 finding F18 on the last archive PR).
- **m7** — the chip's `aria-hidden` is argued but never asserted; `getByLabelText` passes either way.
- **m8** — `T-WEB-S220` has no red-first row in §4 though §4 claims to enumerate every seam.
- **m9** — seams 3–5 render `ArchiveDayPage`, which needs the hoisted `vi.mock` preamble (`archive-day.test.tsx:14-37`). Replicate it or render `ArchiveDayView` directly and say so.
- **N1** — "only Termo can be `played`" is attributed to ADR-0044 decision 4, which defines the union and the `elapsedMs` rule and does not restrict `played`. The restriction is `CONTEXT.md:13` + ADR-0008 rule 3, mechanised at `day-state.ts:165-181`. Claim true, citation wrong.
- **N2** — §7(c)'s `day-state` sentence at `:222-225` is scoped to the three grid **play** routes, not `/arquivo/[data]`. Conclusion stands; scope should be stated correctly, since it sits four lines below the falsified sentence.
- **N3 / n3** — `S213` also appears in `plans/040:1430`. Frontier conclusion correct. The `messages`-chunk sentence begins at `route-client-js.mjs:53`, not `:54-55`.
- **N5** — handoff 041 §4's two-way amendment check is half-applied: §7 has the row-shaped direction and never states the reverse (every hit in the tree maps back to a row). B1 is precisely a hit with no row. No bare counts are used — that half is clean.
- **D-05** — D4's "the paper is identical" holds only while the chip sits wholly inside the card's padding box; an overhanging stamp puts part of the ring on `--paper-desk` at 2.7311:1. And the chip declares no `background`, so a wrong reserve interleaves glyphs rather than occluding them — the failure mode is unreadable, not merely crowded.
- **D-08** — the visible chip would read **FEITO** while the accessible name reads **concluído**. Not a 2.5.3 violation (the label is the game name, and the hub ships the same mismatch), but a real input to a decision §5 frames as pure register.
- **D-09** — the rule survey is incomplete though its conclusions hold. Add `border-accent-on-rounded` (needs a dominant edge; uniform 1.5px cannot), `undersized-ui-text` (gate is `< 11`; chip is exactly 11), `wide-tracking` (exempts uppercase), `cramped-padding` (both arms miss), and **`text-occlusion`** — the detector's name for R4, never mentioned, whose 0.45 threshold sits above the measured 0.286.
- **D-10** — vocabulary: DESIGN.md reserves **"Completion stamp"** for the 150×150 postmark (`DESIGN.md:39`); this is the **Game-card chip** (`DESIGN.md:48`). Call it a chip. Also: `docs/design/006-*` has no archive frame, and the done state appears only on the hub card **in flow** — there is no reference for a corner placement, and this would be the sheet's first out-of-flow *text* element. Defensible, but record it as a new placement decision.
- **D-13** — stacking order unspecified; `.tape` and `.doneChip` would be siblings with `z-index: auto`, so paint order is DOM order. Pin the chip after `.tape`.
- **D-14** — `day-view.tsx:26-27` is cited three times; the lines are `:25-26`.
- **S13** — a reviewer's probe file `apps/web/test/zz-review-probe.test.tsx` was left in the tree at one point. Confirm the tree is clean before step 5 commits.

---

## Verified sound — do not re-litigate

- **§2's three measurements**, reproduced independently by two reviewers: `useRecordSnapshot` × 2 games loops; `usePriorConclusion`'s per-mount freeze breaks under two consumers; `useDayState` × 4 games × 1 date is clean. The issue's prescribed swap is measurably wrong.
- **[C1]** `archive-copy.test.ts:57-74` closes exact key lists over `copy.result` and `copy.meta` only; `copy.day` has none.
- **[C2]** Both `contrastRatio(` call sites in `impeccable@3.4.0` (`checks.mjs:137`, `:217`) take a text foreground. `low-contrast` never evaluates a border. And **ADR-0041 decision 5's exemption rests on the enclosed word** — `:162-168`, *"because the words they enclose are at 15.6663:1 and carry the whole message"* — which beats the hub CSS comment's dangling relative. The plan's reading is correct and better than the shipped comment's.
- **[C3]** The id is `nested-cards` (`registry/antipatterns.mjs:79`); no `card-inside-card` exists. `hero-eyebrow-chip` needs `h1` **and** ≥48px (`checks.mjs:416,419`); `kicker-above-heading` collects `h1`–`h4`/`[role=heading]` (`:2492`). `isCardLikeFromProps`'s `hasBorder` is a **class-string** test (`:3886`, `:4160`), so a background-less, shadow-less chip is not card-like at its first line.
- **Contrast, recomputed from `packages/ui/tokens.css` with the WCAG 2.x formula, not copied:** ring termo on `--paper-card` = **2.8501:1**; word `--ink` on `--paper-card` = **15.6663:1**. Both of the plan's headline figures are exact, and termo is correctly the worst case. **Addition owed:** termo is the *only* one of the four needing the exemption — sudoku 7.8385, binairo 5.5377, nonogram 4.5063 all clear 3:1 unaided. And applying 1.4.11 directly: the state is carried by the visible word at 15.6663:1, so the ring is not *required* to identify the state and the exemption is genuinely available.
- **`T-WEB-S183` and D1a.** The walker (`archive-day.test.tsx:267-350`) seeds from the seven `app/arquivo/**` page entries and BFS-es relative imports; a test file is never an entry and never imported by one, so D1's cross-check test is legal. `eslint.config.mjs:529` records that `apps/web/test/**` sits inside the app-wide wall and trips none of it. The final loop is a raw `readFileSync(...).not.toContain("readDayState")` with **no comment stripping** — D1a's landmine is real.
- **Test-id frontier, re-derived twice by grep:** highest in use **S212** (`og-image.node.test.ts:712`); next free **S213**; `S210`/`S211` absent from source, consistent with burned. The range `S213…S222` is clean and the burned-tail treatment of S221/S222 is correct.
- **Every mechanical claim in §11 about how `detect` behaves**, confirmed by reading the installed package and by running it: bare path → static engine and `--viewport` ignored (`main.mjs:288-296`); `--no-config` real (`:218`); the two `overused-font` ignores carry no `files` key and do apply; a `file:///` target matches neither URL-scoped ignore (verified empirically — `cream-palette` fired); detect exits **0** on both an empty page and an unreachable one, so the positive controls are justified, not ceremonial.
- **DESIGN.md's section-5 anti-references**, each checked against the proposed chip: no gradient, no glassmorphism, not card-in-card under any reading, no grey-on-colour, no icon tile, no mascot or emoji, no diffuse shadow, not Inter. **None breached.** (The plan argues this only through impeccable's predicate; the anti-references are law independent of the detector and should be cited as such.)
- **D2/S217** — an archive-route Termo record does carry the distinction: `use-termo-play.ts:273` writes `outcome: closed ? (solved ? "won" : "lost") : undefined`, and `ArchiveTermoScreen` composes the same hook. The *Feito*/*Jogado* split is forced.
- **D7's retention numbers** — `RETAINED_PAST_RECORDS = 50` (`play-record.ts:574`), prune at `:617-647`, triggered at `use-play-lifecycle.ts:141`. Accurate; the gap is F4, not the numbers.
- **The accessibility premise in D5** — `aria-label` on the `<a>` replaces its content as the accessible name, so an `aria-hidden` chip inside announces nothing and a non-hidden one is swallowed. Label and chip must move together; the boundary at the card, not the chip, follows. `hub-day-state.tsx:115-135` is the shipped precedent.
- **Baseline green before any change:** `route-ssr.test.tsx`, `archive-day.test.tsx`, `archive-copy.test.ts` → 3 files, **87 tests passed**.
