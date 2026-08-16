# Step-3 plan review, round 2 — issue #96, plan 043 revision 2

Three reviewers — correctness, records, design/tests — against the real tree at `eea445e`.
**Verdict: 3 × REJECT.** All three say **step 4 (fix the plan)**, not step 2. Nothing reopens the placement or the repair.

---

## Confirmed sound — do not re-litigate

- **The `Map` repair works and could not be broken.** Applied to the real hook and measured: four per-card consumers on one date, two dates same game, and eight consumers (4 games × 2 dates) all stabilise, each probe asserting its own record per key rather than "no throw". No regression: `archive-result`, `archive-play`, `archive-day`, `archive-copy`, `use-record-snapshot`, `day-state`, `route-ssr` → **7 files / 129 tests green**. `pnpm typecheck` → `Tasks: 6 successful`.
- **Eviction survives interleaving.** Ten simulated client navigations leave 16 dead keys and a fresh page of 4 still stabilises; a long-lived consumer whose entry is evicted re-inserts and stabilises. The real property is **live-consumer count ≤ bound**, independent of dead keys.
- **`archiveCardStatus` is an exact re-derivation of `entryFor`** — full matrix, 4 games × 7 shapes, **29 tests green**, all 28 cells agree including `pendingSync: true` and `syncOutcome: "rejected"`.
- **The in-flow row holds everywhere.** 1440×900, 390×844, 360×800 and **320×700**: no kicker wraps, no title wraps, `Nonogram` is 130.34px against a 246px measure, worst-case slack **81px**. The chip stays wholly on `--paper-card`. Zero overlap with `.tape` or `.cardTitle` at any width, no CLS at DPR 1/2/3. Round 1's **D-01, D-02, D-04, D-05, D-13 all dissolve**, and R12 is retired.
- **`impeccable detect`'s pending → done delta is empty** at both viewports on a fixture with `globals.css`, the three committed faces and `accentVars` — one `cream-palette` finding in all four runs, nothing else. No `nested-cards`, `text-occlusion`, `undersized-ui-text`, `wide-tracking`, `cramped-padding`, `border-accent-on-rounded`.
- **All five of round 1's record blockers are genuinely fixed** — B1 (`route-client-js.mjs:216-219` unconditional, split from `:53-56`), B2 (`CONTEXT.md:11-13` quoted verbatim, the collapse recorded), B3/M1 (`T-WEB-S73` cited correctly), M2, M3, M5. Also fixed: D-14, S9, S10, S12/F8, N1, N2, m1, m4, m6.
- **Frontier re-derived independently twice:** highest in use **S212**, next free **S213**, `S213…S224` clean, no collisions.
- **The accessible name's verb is right.** `"Ver o resultado do …"` satisfies 2.4.4 and is grammatical for all four masculine game names; 2.5.3 holds because the name contains the game name contiguously; `aria-hidden` chip with the anchor carrying the name is the shipped hub pattern; the hydration-time change is stated, monotone and both ends asserted.
- **The wall is not crossed.** `use-record-snapshot.ts` is already in the archive graph via `late-result.tsx:16`; `grep -c readDayState` on it → 0.
- **Seam mechanics confirmed:** seed-then-spy ordering is now correct; seams 3, 5, 6 are genuine reds; `renderToStaticMarkup` really does take `serverSnapshot`; `ArchiveDayView` under RTL with only `next/navigation` mocked already works.
- **ADR-0041 consequence (h)** enumerates thirteen `color:` declarations, so a new accent **border** owes it no row. Do not re-derive.

---

## Blockers

### R2-B1 — the pasted diffstat does not match the change, and "net −2" is revision 2's headline argument. **Two reviewers measured it independently; both got net 0.**

The plan pastes `1 file changed, 15 insertions(+), 17 deletions(-)` → *"**Net −2 lines.** The repair is smaller than the code it replaces."* Measured on the actual repair, byte-for-byte what D1 specifies:

```
 apps/web/src/play/use-record-snapshot.ts | 30 +++++++++++++++---------------
 1 file changed, 15 insertions(+), 15 deletions(-)
```

**Net 0**, before the docblock rewrite D1 also mandates. This sentence carries §2.3's decision away from revision 1's parallel projection and is the first line of §5 decision 2 to Fernando.

**Fix.** Re-run, paste the real diffstat, rewrite §0(1), §2.2, §2.3's table row and §5 decision 2 to say **net 0**. The argument survives intact on "the same size, and it fixes the defect for every future consumer."

### R2-B2 — seam 1 cannot be trusted to go red, and the plan has no guard.

Seam 1's claim is *"against the shipped single-slot implementation it throws `Maximum update depth exceeded`"*. The repair existed uncommitted in this worktree once already. If step 5 starts from such a tree, seam 1 is **green on arrival**, the agent pastes a green, and the only genuine design-driving red in the cache half is silently skipped. §12's cleanliness criterion is scoped to *"probe files"* — an untracked check that cannot see a modified tracked file.

**Fix.** §9 step 2 gains a precondition with pasted output: `git diff --stat apps/web/src/play/use-record-snapshot.ts` empty **before** seam 1 is written, and `git status --porcelain` shows no `M` row. §12's row becomes "clean of probes **and of modified tracked files**".

### R2-B3 — the `--no-config` positive controls are inert, measured, and §11's rationale contradicts itself.

§11 says *"detect exits 0 on an unreachable or empty page, so a green run proves nothing until `--no-config` surfaces the suppressed Ateliê findings"* — and four lines above, *"a `file:///` target matches neither [ignore], so both fire in file mode by design."* Both cannot be true. Measured:

```
########## done-worst @ 1440x900   (config applied)
  [cream-palette] cream/beige page background rgb(247, 242, 233)
1 anti-pattern found.
########## --no-config done-worst @ 1440x900
  [cream-palette] cream/beige page background rgb(247, 242, 233)
1 anti-pattern found.
```

Byte-identical at both viewports. Nothing is suppressed on a `file://` target, so `--no-config` un-suppresses nothing and **the control cannot distinguish a scanned page from an empty one**. Second measured correction: **`low-contrast` does not fire in file mode** — only `cream-palette` did, in all six runs.

**Fix.** Replace the `--no-config` pair with a real proof-of-life: assert the configured file-mode run emits `cream-palette` (an empty fixture emits nothing — verified). Delete the "surfaces the suppressed Ateliê findings" sentence. Correct "both fire" to "`cream-palette` fires; `low-contrast` did not, measured."

### R2-B4 — §7.1's reverse sweep cannot see two live hits, and one lives in a file §1 forbids touching.

After the repair, `git grep` finds two falsified sentences:

```
apps/web/src/play/day-state.ts:186: * The same cache `use-record-snapshot.ts` keeps, for the same reason:
apps/web/test/use-record-snapshot.test.ts:24: * Each case uses its own date, because the cache is one module-level slot
```

`day-state.ts:186-190` claims parity with a module that no longer keeps the same cache. **But §1's non-goals say "No touch on `src/play/day-state.ts`"** — the plan falsifies a sentence and forbids repairing it. The implement agent has no legal move.

§7.1's grep 1 misses both twice: its pattern (`single-slot|single slot|One slot|one slot|keeps one`) matches neither wording, and its scope (`apps/web/src apps/web/app apps/web/scripts docs/adr DESIGN.md CONTEXT.md`) **excludes `apps/web/test` entirely**. Two further unrowed hits in the same class: `apps/web/test/conclusion-view.test.tsx:623-630` (`T-WEB-S20`, docblock *"The snapshot cache is module-level…"*) and `docs/adr/0054-…:984-985` (*"a key whose sharing hazard is documented twice in the tree"* — the count is now in motion).

**Fix.** **Fernando's call, already made: carve out a one-comment-sentence edit to `day-state.ts` from §1's non-goal.** Leaving a knowingly-false cross-reference on `main` is worse than the carve-out. Then: add `apps/web/test` to §7.1's scope, add `same cache|module-level slot|useRecordSnapshot|readSnapshot|snapshot cache` to the patterns, add §7 rows for all four hits, add `use-record-snapshot.test.ts` to §6 and to D9's must-stay-green list, and run it at §9 step 4.

**Also owed, one line in ADR-0056 decision 1:** `day-state.ts:192-204`'s `cachedDayState` is a single date-keyed slot with the identical F3 defect one level up. Decision 1 states a general rule about this cache family; leaving the only sibling unmentioned repeats round 1's F3 omission one module over.

### R2-B5 — §7.1 grep 4's headline conclusion is falsified by a file grep 4 itself searches.

Plan `:652`: *"`late-result.module.css:90` produces **no** hit … it is a shipped accent ring that **no prose and no test names**."* Both halves false:
- `apps/web/test/ink-on-accent.test.ts:213-216` — *"the late-result panel paints the game's accent on the completion stamp's **RING** and nowhere else"* — a test naming it, in one of grep 4's own two target files, 130 lines above the arm being widened.
- `apps/web/src/archive/late-result.module.css:34-38` — *"the accent colours the **RING** — a shape — and every word on this sheet is `--ink` or `--ink-2`"*.

The grep searches `accent ring|rings`; the tree spells it `RING`. The substantive point (the *border declaration* is unasserted) survives; the stated one does not.

**Fix.** Rewrite to the true claim — *the ring is named in prose in two places and asserted by no test* — and make grep 4 case-insensitive.

---

## Majors

### R2-M1 — `--done-chip-box: 24px` describes a box the browser never renders. **Two reviewers, independently.**

D6 pins *"2×1.5px border + 2×5px padding + 11px = 24px"* and `T-WEB-S221` asserts that arithmetic. Blink rounds `border-width: 1.5px` to a used **1px** at every DPR:

```
1440x900 dpr=1 {"borderW":"1px","chipH":23,"rowH":24,"cardH":117}
1440x900 dpr=3 {"borderW":"1px","chipH":23,...}
390x844  dpr=3 {"borderW":"1px","pad":"4px","chipH":21,"rowH":24,...}
```

Real box **23px** desktop, **21px** mobile. No visual defect (row 24 ≥ chip 23, centred, no CLS) — but the plan, the ADR and a permanent test would enshrine an equality that describes nothing, and the mobile sentence (*"a 22px box with 2px of slack"*) is wrong the same way (real: 21px, 3px).

**Fix.** Either set `--done-chip-box: 23px` (row = chip exactly, growth 12px), or keep 24 and state in D6, the CSS comment and `T-WEB-S221`'s comment that 24 is the **declared ceiling**, the used box is 23/21 because Blink floors a 1.5px border, and the invariant is `declared ≥ used`, not equality.

### R2-M2 — `line-height: 1` is justified with a false statement and makes the archive chip a different object from the hub's.

D6: *"the hub's chip inherits its line-height from a flex context this card does not have."* No such mechanism — the hub's `.doneChip` inherits unitless **1.5** from `body { font: var(--text-body) }` (`globals.css:16`, `tokens.css:23`), exactly as the archive's would. Measured on the shipped hub chip:

```
1440x900 {"h":29.34,"w":80.97,"lh":"16.5px"}      # hub
390x844  {"h":27.02,"w":74.86,"lh":"16.5px"}
```

**Hub chip 29.34px tall; archive chip with `line-height: 1` is 23px** — 21% shorter, 2px of leading instead of 5.5px. Widths identical (80.97 vs 81.0), so they differ in exactly one visible dimension — while `arquivo.module.css:288-292` declares the card to be "the hub's Game-card register" and D6 presents the chip as carried over verbatim.

**Fix.** Pick and state one: (a) drop `line-height: 1`, set the box to 30px, accept 19px growth — chips then match; (b) keep it and record in D6, §7(j) and ADR-0056 that the archive chip is deliberately a tighter 23px box, with the reason; (c) put `line-height: 1` on both (out of scope). Delete the "flex context" sentence either way.

### R2-M3 — the accessible name collapses *Feito* and *Jogado* — the exact collapse D2 spends a decision proving is forbidden.

`cardAriaDone` and `cardAriaPlayed` are byte-identical: `"Ver o resultado do {jogo} de {data}"`. The chip is `aria-hidden` and the anchor's label replaces its content, so **the accessible name is the only channel carrying state to AT**. A screen-reader user hears the same sentence for a won Sudoku and a lost Termo, while a sighted user sees `FEITO` and `JOGADO`.

D2 argues at length that one verb is unavailable: *"a lost Termo carrying **Feito** would be a false done… 'A false pending is invisible; a false done would be a lie the player can catch.'"* An AT user cannot catch it. The stated reason for the identity — *"the destination is identical"* — is a 2.4.4 answer to a question 2.4.4 did not ask. The hub ships `doneAria` / `completedAria` / `playedAria` as three distinct sentences (`messages.ts:124,144,163`) precisely so the played state is announced.

**Fix — this follows directly from a decision already made, so make them distinct.** `cardAriaPlayed` carries the played state in the hub's register, e.g. `"Ver o resultado do {jogo} de {data} — jogado"`. `T-WEB-S219` then asserts the two names **differ**, which also makes "two keys, deliberately" falsifiable instead of a tautology.

### R2-M4 — `T-WEB-S222` is a tautology in the direction it advertises.

D3 claims it *"asserts equality in both directions… so editing either literal reds the test"*, by *"asserting both blocks against the exported const itself"*. With one hoisted const there is only **one literal**: both assertions are reference identities on the same binding and cannot fail. Change the const `"Feito"` → `"Concluído"` and both surfaces move together, test still green — precisely the silent drift R14 says it prevents.

**Fix.** Add value assertions (`expect(messages.hoje.done).toBe("Feito")` and the archive equivalent, same for `played`). Reword D3 and R14 to stop claiming bidirectionality.

### R2-M5 — the headline card figures handed to Fernando come from the fixture the plan itself declares invalid.

D6 and §5 decision 3 both say *"a 288 × 95 card becomes ≈ 288 × 108"*. Measured, axis-aligned, all three viewports:

```
1440x900 baseline card 288x104   → done 288x117
390x844  baseline card 350x104   → done 350x117
360x800  baseline card 320x104   → done 320x117
```

**The +13px delta is exactly right.** Both absolutes are 9px wrong: `95` is round 1's D-01 number, taken on a shell with no `globals.css`, where `.cardTitle` falls back to `line-height: normal`. That is finding **D-11 exactly** — revision 2 writes D-11's fix into §11's fixture spec while carrying D-11's number into the decision it hands to the principal. Real cost is **+12.5%** per card, not +13.7%.

### R2-M6 — `T-WEB-S214` does not hold the property named three times.

The plan says the safe property is *"the bound must exceed the number of simultaneously-mounted consumers"* and that S214 holds it. S214 as specified is `expect(SNAPSHOT_CACHE_LIMIT).toBeGreaterThanOrEqual(GAMES.length * 2)` plus 8 live consumers — a **static floor of 8** with no reference to any consumer count in the tree. R2's own stated risk (*"the consumer count grows past it on a surface nobody re-measured"*) reds nothing: a future page mounting 20 consumers leaves S214 green and ships a white screen.

**Fix.** Either couple the constant to the tree (a source scan counting `useRecordSnapshot(` call sites reachable from one route entry, asserted `< SNAPSHOT_CACHE_LIMIT` — the `ink-on-accent.test.ts` idiom), or delete the claim and say plainly the bound is 4× headroom held by review and the docblock. Also: S214 renders 8 against a bound of 16, never *at* the bound, so "pins the bound against the maximum" oversells it — it pins a floor.

### R2-M7 — `T-WEB-S215` cannot check the F5 decision D7 says it checks.

D7/F5: *"S215's matrix … asserts the archive and the hub answer identically, so this decision is checked rather than merely written."* **Agreement is invariant under both sides being wrong.** If a later edit made `entryFor` branch on `syncOutcome === "rejected"` → `pending` and the drift test forced `archiveCardStatus` to follow, S215 stays green and F5 silently reverses. Demonstrated: 28 agreement cells pass, and pinning the decision required a *separate* absolute arm.

**Fix.** Add absolute expectations (`toBe("completed")`) on the `pendingSync: true` and `syncOutcome: "rejected"` rows. Two notes: the `won-termo`/`lost-termo` shapes are meaningless for the three grid games, so 12 of 28 cells duplicate `concluded` — say so; and both shapes must be built `concluded: true` or the arm is vacuous.

### R2-M8 — D3's monotone claim is falsified by D7's own prune path.

D3: *"the name may only ever become **more** specific, never less."* D7 accepts in writing that a cross-tab prune flips the card done → pending mid-view. That takes the accessible name from `cardAriaDone` back to `cardAria` (*"Jogar …"*) — strictly **less** specific, on an interactive `<a>` that may be focused. D7 reasons about the chip only.

**Fix.** Narrow D3's invariant to "at hydration" in writing, and extend D7 and ADR-0056 consequence (b) to name the accessible-name flip. The decision to accept may stand; it must be one decision, stated once.

### R2-M9 — the baseline counts the plan's own probe. **Two reviewers.**

§2.2/D9/R3/§12 gate on *"76 files / 1106 tests"*. Measured on `main` at `eea445e`, and again with the repair and the probe removed:

```
 Test Files  75 passed (75)
      Tests  1102 passed (1102)
```

`ls apps/web/test/*.test.* | wc -l` → **75**. The 76th file and 4 extra tests are `test/zz-s1-probe.test.tsx`, which the plan says was reverted. Three places depend on the number and the exit criterion can never go green.

**Fix.** State **75 files / 1102 tests**, and express the gate as "all 1102 pre-existing tests still pass, plus the ticket's new ones."

### R2-M10 — widening `T-WEB-S73` to the fourth ring makes the arm's own comment false.

`ink-on-accent.test.ts:343-349`: *"**Both rings are 2.8501:1 against card paper** and both enclose text at **15.6663:1**."* The `late-result.module.css` `.stamp` is on the archive play route's **desk** paper (the sheet declares no `--paper-card`; its own prose says mustard is 2.8501:1 *"on card, the ceiling over the whole paper family"*, so desk is lower — 2.7311:1 per `DESIGN.md:50`), and its enclosed label is `.stampLabel { color: var(--ink-2) }`, not `--ink` at 15.6663:1.

**Fix.** Either compute and state the postmark's two figures and rewrite the arm's comment, or widen to three rings and file the fourth separately.

### R2-M11 — `docs/README.md:21` is mis-cited, twice, to dismiss two ADR pointer repairs.

§7.1 (p) and (r) dismiss repairing drifted ADR pointers *"— an ADR body is not rewritten for line movement, `docs/README.md:21`"*. Line 21 covers *"**Handoffs, briefs, plans and specs**"*; `docs/README.md:5-7` and `:15` put `adr/` under **"Living documents … edited in place"**. The *substance* is defensible (ADR-0041's header shows the project uses `**Amended by:**` rather than body edits) but the cited rule says the opposite. Both drifts are real: `ADR-0041:127`'s `page.module.css:222` → the rule is at `:238`; `ADR-0043:242`'s `conclusion-view.tsx:586-594` → `DayChip` is at `:864-899`.

**Fix.** Cite the real basis (ADR practice: amendment headers, not body edits) or repair the pointers.

### R2-M12 — D8's marker probe has no anti-vacuity control and its path mapping is not the script's.

D8 claims it reuses the script's mechanism, but `route-client-js.mjs:519` is `const normalize = (path) => join(path);` while the probe substitutes `p.replace(/^\/_next\//, ".next/")`. If the stats file does not spell paths `/_next/…`, every `existsSync` is false, `messagesChunks` is `[]`, and the plan reads that as *"keeps `:53-56` as written"* — a silent false negative confirming its own prediction. This repo treats vacuity as first-class everywhere else (`route-client-js.mjs:537-543` exits 2 on an empty chunk set; `ink-on-accent.test.ts:274` is an anti-vacuity arm; §11 mandates controls).

**Fix.** Use `join()` as the script does; assert `chunks > 0` and that files were read; add a positive control against a route where `messages` is known present.

### R2-M13 — §9 step 14's frontier command returns the wrong frontier.

`grep -rhoE "T-WEB-S[0-9]+[a-z]?" apps packages | sort -u | tail` → `T-WEB-S95 … T-WEB-S99`. `sort -u` is lexical, so `| tail` reports S99, not S212. `docs/agents/test-ids.md:33` gives the command **without** `| tail`; the plan added it, and `test-ids.md:26`/`:50` are explicit that a wrong frontier at step 8 is the recurring failure. (D9's own derivation omits `| tail` and is correct.)

**Fix.** `… | sort -t S -k2 -n | tail`, or drop `| tail`.

### R2-M14 — ADR-0056 decision 2 does not engage the glossary's own counter-precedent.

`CONTEXT.md:12` says a late completion is *"**Shown distinctly in the calendar** when its date falls inside the account's own range"* — the product already distinguishing late from on-time on another user-facing surface, and the first thing a future reader will raise against the collapse. Decision 2 quotes `:12`'s "never feeds streak, time stats or Dia Perfeito" and stops.

**Fix.** One sentence: why the stats calendar distinguishes and the archive day card does not (the calendar is a history *record*, the chip a device *affordance*).

---

## Minors and nits

- **m-1** — the boundary is at **16, not "must exceed 16"**, and 17 was never measured. Measured: 16 live consumers stable (and stable under churn); **17 loops**; 20 loops. Safe property is `bound ≥ live maximum`, not `>`. ADR-0056 decision 1 states it off by one.
- **m-2** — eviction discipline under-specified: *"the first-inserted key is deleted"* admits `set`-then-trim and evict-before-`set`. Both measured, identical at the boundary. Not load-bearing, but pin one line so seam 1's red is against a determinate target.
- **m-3** — the comparator's staleness window widens: under the slot a cached snapshot died when another key was read; under the `Map` it survives the session, so `sameToTheReader`'s uncompared fields (nonogram `grid`/`size`/`entries`, termo `answer`/`outcome`) are stale for longer. Safe only because of the lockstep invariants the docblock already names (`T-WEB-S64`, the termo `superRefine`) — D1 rewrites that docblock anyway and owes this sentence. Also `cached.hydrated` inside `readSnapshot` becomes dead code; narrow the type or keep it knowingly.
- **m-4** — D6's clearance/slack figures are arithmetic and three are wrong. Measured worst case: chip→tape **12.91px** (plan ≈14.8 — D6 took the tape's declared `+7` and ignored its own `rotate(-4deg)`, which paints to +10.49, and put the chip's top at 24 not 25); title→chip **6.40px** (plan ≈5.8); widest kicker `Palavras` **72px** (plan ≈67); slack **81px** (plan 85.5). All in the safe direction.
- **m-5** — `T-WEB-S221` has two holes the claim does not admit: (i) the **mobile override is invisible to it** — `bodyOf` matches the first line-anchored block, so bumping the mobile padding to `var(--space-2) 9px` gives a 30px box in a 24px row with every assertion still green; (ii) the formula uses `font-size`, not `font-size × line-height`, so changing `line-height: 1` → `1.5` passes while the row is 5.5px short. Fix: the term is `pixels(font-size) × Number(line-height)` with line-height required unitless, and the arm runs twice — top-level against the constant, `@media` block asserting mobile box **≤** the constant.
- **m-6** — seam 4 is a **third guard, not a red**: before `day-card.tsx` exists `ArchiveDayView` renders no chip, so all three assertions pass. §4's header says "two of these are guards" and names seams 2 and 7.
- **m-7** — round-1 **m7 is still unanswered**: the chip's `aria-hidden` is argued twice and asserted nowhere, and D5's rejection of the smaller boundary turns entirely on it. One line in `T-WEB-S217`.
- **m-8** — misattributed verbatim quote: D7 attributes *"one subscription mechanism, so a settled sync can never reach one reader and not the other"* to `day-state.ts:122-125`; that string is `use-record-snapshot.ts:74-75`. `day-state.ts:123-125` is a different sentence.
- **m-9** — D8's marker is mislabelled `// messages.hoje.ctaHome`; `ctaHome` is at `messages.ts:264` inside `conclusion:` (opens `:183`), while `hoje:` spans `:107-174`. The literal is unique so the probe works; the annotation is wrong.
- **m-10** — `messages.ts:131-137` is overstated as *"a deliberate three-way register split for two other done/played pairs"*. It documents **one** word (`played`) across two registers.
- **m-11** — two range citations straddle bullets: `ADR-0041:272-285` (the bullet starts `:274`) and `ADR-0043:233-243` (ends `:239`).
- **m-12** — D1's docblock quote *"one slot … module-level because the store it caches is"* — "one slot" is not in `use-record-snapshot.ts:32-42`.
- **m-13** — ADR-0056 decision 4 states an instance, not a rule (*"The **third** accent ring is gated"* binds nothing about the fifth). Restate as: every accent-coloured border in a `SHARED` sheet is enumerated in `T-WEB-S73`'s ring arm.
- **m-14** — `T-WEB-S217` carries two claims (chip on the concluded card and no other + publishes no duration); per `test-ids.md:20` that is the shape that later needs a sibling letter.
- **m-15** — `src/i18n/index.ts`: `messages` at `:15`, `archiveGameRoute` at `:18` — three lines apart, not "two lines above".
- **m-16** — §7(j)'s DESIGN.md clause still misses deltas: the chip is a **different size** (23 vs 29px, R2-M2) — the delta a `/impeccable` run comparing the two cards would see — and `DESIGN.md:48` also promises a **description** the card does not have. Also worth saying the chip sits **above the title**, inverting `:48`'s anatomy where the done state is terminal.
- **m-17** — the sheet's own card-inside-card comment is never engaged. `arquivo.module.css:105-108` argues the rule in its own voice (*"A day row inside a card inside a section is exactly how card-inside-card happens"*) and `day-view.tsx:19-24` repeats it. No anti-reference is breached — `DESIGN.md:48` prescribes this object — but adding a second bordered box in the one sheet that wrote that comment twice owes one sentence distinguishing a stamp chip from a nested card.
- **n-1** — the chip's painted left edge sits **5.38px** from the tape's painted right edge at 1440×900 — the tightest relationship on the binding card, unstated, aesthetic only (12.91px vertical clearance). §9 step 8's eyeball checklist should name it. 42.4/27.4px at 390/360.
- **n-2** — `.cardTop` overflows its content box by 1px in the done state (`scrollWidth 247 / clientWidth 246`) because the rotated chip's bounding box exceeds its layout box; absorbed by `.card`'s 20px padding, `documentElement.scrollWidth === innerWidth` at all three viewports. One sentence so a later reviewer does not read the 1px as a defect.
- **n-3** — the chip inherits `font-weight: 400` from `body` while `.cardKicker` is 600, pairing two 11px uppercase runs 12px apart. Screenshotted; the ring plus `--ink` vs `--ink-2` carries it and it reads as a stamp. One sentence in D6 that it was looked at — it is the first time this sheet puts two uppercase micro-type runs on one line.

---

## On the 13px, since a position was asked for

**It is genuinely different from the reserve round 1 rejected, and it should ship.** Round 1's D-04 rejected the title reserve because it produced a *visible defect in the pending state* — ~85px of a 246px measure gone, `Nonogram` wrapping on one card and not the others, breaking the grid rhythm on 99% of visits. The flex row produces no defect: measured, the pending state is uniform across all four cards, nothing wraps, nothing is empty. *"Permanent cost for a rare state"* was never the objection on its own — *"permanent damage for a rare state"* was.

Two corrections to how the plan states the cost:

1. **It is not only height.** With the row at 24px and the kicker's line box at 11px, the kicker gains 6.5px of leading each side: optical top padding 24 → 30.5px, kicker-to-title gap 8 → 14.5px. The card's internal vertical rhythm changes in the pending state, and that is unstated.
2. **"The price of not having a corner stamp with a reserve constant" is not accurate.** Zero CLS here does not require `min-height` — negative block margins (`margin-block: -6.5px`) keep the row at 11px in both states while the chip overhangs into the 24px card padding above and the 8px title margin below (measured headroom 12.9px and 6.4px). **Not a request to change the shape** — Fernando chose this one and it is the safer of the two. The plan should stop calling 13px the price of deleting the reserve when it is the price of *this particular* way of getting zero CLS, and say so in §5 decision 3 so the record shows the real alternative set.
