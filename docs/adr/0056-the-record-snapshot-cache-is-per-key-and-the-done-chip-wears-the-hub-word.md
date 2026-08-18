# ADR-0056 — The record-snapshot cache is per key, and the archive's done chip wears the hub's on-time word

**Status:** Accepted — 2026-08-16 (issue #96, shipped in #113)
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)

Every record this ADR depends on is **obeyed, not amended**. No statement in
ADR-0031, ADR-0041, ADR-0043, ADR-0044 or ADR-0053 is falsified, so no
`**Amended by:**` header is owed anywhere in `docs/adr/`. What *is* falsified
by decision 1 is source prose, in **seven** places
(`src/archive/late-result.tsx`, `src/archive/use-prior-conclusion.ts`,
`src/play/day-state.ts`, `src/nonogram/nonogram-conclusion.tsx`,
`src/termo/termo-conclusion.tsx`, `test/use-record-snapshot.test.ts` and
`scripts/route-client-js.mjs`), and a comment edit is not an ADR amendment.
The last two of those were found at step 6 (finding M4): both conclusions
still described the single slot and warned that different keys *"would thrash
that slot"*, which is the defect this decision deletes — so their standing
prohibition on re-keying rested on a falsified premise. Rewritten to the
reason that survives: one key means one entry and one live consumer.

## Context

Issue #96 asks `/arquivo/<data>` to show, per game, whether **this device**
already finished that day's puzzle. ADR-0031 already settles what such a
signal is allowed to be — local, monotone-safe, an affordance and never an
entitlement — and ADR-0053 decision 10 already settles that no per-day
per-user endpoint ships. So the product question was answered before the
ticket opened, and what remained were three mechanical questions and one
wording question.

**The mechanical one that mattered was not in the issue.** The issue's own
"Files" hint points at `useRecordSnapshot`, the shared play-layer reader every
conclusion, the hub and the archive's late-result panel already use. That hook
keeps **one module-level cache slot**. Two consumers with different keys on
one page therefore evict each other on every `getSnapshot`, the store contract
is broken, and React throws `Maximum update depth exceeded`. A per-game chip
on a day card is four consumers on one page, so the mechanism the issue names
does not work for the shape the issue asks for. The same defect exists one
level up on the **date** axis, unrecorded until this ticket:
`/arquivo/<data>` is the first surface where the date is a URL variable.

**The wording question** is that `CONTEXT.md:12` gives the archive its own
term — `Late completion · Conclusão tardia`, *"never feeds streak, time stats
or Dia Perfeito"* — and the hub's chip says `Feito`, which `CONTEXT.md:11`
reserves for an on-time `Conclusão`. Every completion this chip can render is
a late one, so the hub's word is being applied to the state the hub's own
projection was built to exclude (`src/play/day-state.ts:26-30`).

## Decision

1. **`useRecordSnapshot`'s snapshot cache is keyed per `(game, date)` in a
   `Map` that NOTHING EVICTS ON THE READ PATH, at any N.** The shipped single
   slot loops (`Maximum update depth exceeded`) with two consumers of
   different keys, and does so across **games** and across **dates** alike —
   the second was never recorded, and `/arquivo/<data>` is the first surface
   where the date is a URL variable.

   **The first repair kept a count bound, and the bound was the same defect
   deferred.** It trimmed inside `readSnapshot` at `GAMES.length * 4 = 16`
   entries, on the argument `bound ≥ live maximum`. Measured at step 6: 16
   live consumers stable, **17 `Maximum update depth exceeded`**, plain and in
   StrictMode. Bound + 1 is not degradation, it is a white screen — and the
   guard was weaker than it read, because `T-WEB-S214` pinned call-site
   **files**, so the likeliest next surface (an archive month page, 31 × 4 =
   124 consumers through this ticket's own `day-card.tsx`) would have added no
   file, stayed green and crashed. **A cache whose overflow is a render loop
   is worse than one that grows**, so the count bound is deleted rather than
   raised. `readSnapshot` can only ever ADD, which makes "no N loops" a
   property of the shape and not of a constant. Measured at **4, 16, 17, 32
   and 128** live consumers, plain and StrictMode: one render each on mount
   (two under StrictMode's double-invoke), zero wrong records.

   **What bounds the `Map` instead is STALENESS, swept off the poll and never
   off a read.** `subscribeToPlayRecords`'s interval calls
   `pruneStaleSnapshots` before it notifies, dropping every entry no read has
   touched for `SNAPSHOT_STALE_MS = 5_000` — five times the poll interval. A
   live consumer is re-read once per second by its own interval, so its entry
   can never age into the sweep; what the sweep collects is the keys
   navigation leaves behind. **Its worst case is bounded degradation, not a
   loop**: if a background tab's timers are throttled hard enough that a live
   entry does age out, that consumer pays exactly ONE extra render, because
   the next read re-caches the key and no timer can fire between two
   `getSnapshot` calls inside one synchronous render pass. Both directions are
   asserted.

   `T-WEB-S213` holds the repair; **`T-WEB-S214` now asserts the property
   itself** — N consumers stable for N ∈ {4, 16, 17, 32, 128}, each reading
   its own record, plus the sweep's two directions. Its call-site inventory
   survives under a **different** justification, since there is no bound left
   to re-derive: a new consumer file has to be read against the **widened
   staleness window**, because an entry now lives as long as it is read and a
   reader rendering a payload field `sameToTheReader` does not compare would
   be handed a stale snapshot.

   Two siblings, named so the rule is not rediscovered:
   **`usePriorConclusion` is deliberately not repaired** — its slot is
   mount-scoped by design (#31 step-6 finding F4), its hazard is a key *hit*
   rather than a miss, and its measured bound is one consumer; and
   **`day-state.ts`'s `cachedDayState` is the one sibling with the identical
   defect** (cited by symbol, not by line — this citation had already rotted
   `:192-204` → `:198-210` inside this PR's own diff), a single date-keyed
   slot one level up that two archive dates in a session would evict the same
   way. It is unreachable today (the hub renders one date and this ticket adds
   no consumer) and is **not** repaired here.
2. **The archive day chip publishes a *late* completion under the hub's
   *on-time* word, and that collapse is deliberate.** `CONTEXT.md:12` names
   the archive's term — `Late completion · Conclusão tardia`, *"never feeds
   streak, time stats or Dia Perfeito"* — and it is the term for **every**
   completion this chip can render; `CONTEXT.md:11`'s `Conclusão` is the
   on-time one. The chip nonetheless says **`Feito`**, the hub's Game-card
   word, for cross-surface consistency: `arquivo.module.css` declares this
   card to be that register. It is acceptable because the chip is device state
   claiming nothing about the streak, and because `messages.archive.play.note`
   says *"Não conta para a sequência nem para os seus tempos"* one screen
   away. **It is reversible in two lines and four
   assertions** — `messages.archive.day.done` / `.played` stop pointing at
   `messages.hoje`'s consts and carry their own literals, and `T-WEB-S222`'s
   identity and value arms move with them, across two `it`s. Small, but
   *"one line"* was wrong and this record should not understate what the
   reversal touches. **Two verbs (`Feito` / `Jogado`) are not
   reversible**: a lost Termo showing *Feito* is the false done ADR-0031
   decision 2 forbids by name. Sharpening the record: the union this
   projection re-derives (`day-state.ts:26-30`) was built to exclude *"the one
   a local reader cannot see: a LATE completion"* — on the archive, the
   excluded state is the only state.

   **The counter-precedent, engaged rather than left for a future reader to
   find.** `CONTEXT.md:12` does not only say a late completion never feeds the
   streak; it says it is *"shown distinctly in the calendar when its date
   falls inside the account's own range"* — the product already distinguishing
   late from on-time on another user-facing surface, which is the first thing
   anyone will raise against this collapse. The distinction is real and the
   two surfaces are different kinds of object: **the stats calendar is a
   history *record*, where the whole point is which day was which; the day
   card's chip is a device *affordance*, whose whole job is "you finished this
   here, open it".** A record must disambiguate; an affordance must be
   legible. That is the line, and it is why one distinguishes and the other
   does not.
3. **The done card's accessible name keeps a verb and names the
   destination.** *"Ver o resultado do {jogo} de {data}"*, not a bare state,
   because WCAG 2.4.4 (Level A) asks an `<a>`'s name to make the destination
   determinable, and a card whose name states a state while its three siblings
   state a purpose is the one a screen-reader user cannot act on. It is
   accurate exactly when it renders: the chip's predicate and ADR-0053
   decision 10 layer 2's local-restore predicate are the same predicate
   (`concluded === true`) on the same record. **The done and played names are
   different sentences** — *"… — jogado"* on a played card — because the chip
   is `aria-hidden` and the anchor's `aria-label` replaces its content, so the
   name is the **only** channel carrying state to assistive tech, and one
   sentence for both states is the false done decision 2's own argument
   forbids, in the one place the player cannot catch it. **The name changes at
   hydration** — pending `cardAria` → done `cardAriaDone` — which is the same
   monotone direction as the chip and is announced by nothing (no `aria-live`,
   no `role="status"`; `T-WEB-S219` asserts both ends and that the two
   done-state names differ). **The monotone claim is scoped to hydration**:
   consequence (b)'s cross-tab prune flips the name back to `cardAria`, and
   that is accepted for the same four reasons the chip's flip is.
4. **Every accent ring in a shared sheet is enumerated by a scan, not by a
   comment and not by a list of instances.** The rule: **`T-WEB-S73`'s ring
   arm scans the `SHARED` sheets for `border: <n>px solid var(--accent)` and
   asserts the site set equals a closed list** — so a new accent ring reds the
   test on arrival rather than joining the tree unasserted, which is what the
   archive postmark did for the whole of #31. The pattern matches
   `var(--accent)` **exactly** and not `var(--accent[a-z-]*)`, because
   `--accent-app` is one fixed hex on every screen and is ADR-0041 decision
   1's own carve-out. The list is four rings plus `screen.module.css`'s accent
   **filled** `.hint`, which the same pattern matches and which `T-WEB-S72`
   gates. This ticket's chip qualifies for ADR-0041 decision 5's WCAG 1.4.11
   decorative exemption on its own terms: `1.5px solid var(--accent)` is
   2.8501:1 on `--paper-card` and the word it encloses is 15.6663:1, and termo
   is the only one of the four accents that needs the exemption (sudoku
   7.8385, binairo 5.5377, nonogram 4.5063 all clear 3:1 unaided). The archive
   postmark qualifies on **desk** paper: ring 2.7311:1, enclosed words
   15.0124:1 (`--ink`) and 5.0791:1 (`--ink-2`), and `aria-hidden` besides.
   ADR-0041 consequence (f) — *"`impeccable detect` cannot see any of this and
   never will, so every decision here is gated by one test file or by
   nothing"* — is why this is a scan and not a paragraph; `impeccable@3.4.0`'s
   `low-contrast` provably never evaluates a border (both `contrastRatio(`
   call sites take a **text** foreground). Decision 5's own enumeration is
   exemplary, not closed, so no amendment is owed there.

## Rejected

- **A parallel projection in `src/archive` that routes around the broken
  hook.** ~50 lines of duplicated projection plus a cross-check test whose
  only job is to insure the duplication, plus a second ADR decision for why
  the duplication exists — and it leaves the defect on `main` for the next
  consumer to rediscover. Its one real merit is a blast radius of zero
  outside `src/archive`, which is why the whole `apps/web` suite and
  `pnpm typecheck` are the gate on the repair rather than an argument about
  it. Rejected: the repair is never larger than the code it replaces.
- **A per-day per-user endpoint.** ADR-0053 decision 10 already refuses it,
  and nothing here reopens that. The chip is device state.
- **Latching the chip against a cross-tab prune** (consequence (b)). A latch
  makes the chip outlive the record it claims to read — a stronger claim than
  the device can support — and the flip's direction is the understating one
  ADR-0031 decision 2 permits by name.
- **Branching the chip on `syncOutcome` or `pendingSync`.** `concluded: true`
  means this device finished it, which is true whether or not the server
  stored a row. Branching would make the chip an authority on **server**
  state, which ADR-0031 decision 6 forbids. The hub's `entryFor` ignores both
  fields for the same reason, so the two surfaces agree — and `T-WEB-S215`
  pins that by value, not only by agreement.
- **A duration or a result figure beside the chip**, as the hub's chip
  carries. The archive's own copy says *"Não conta para a sequência nem para
  os seus tempos"* one route away; ADR-0031 decision 6 permits an affordance
  and forbids an entitlement, and a published figure reads as a statistic;
  and Termo publishes no duration on any projection at all (ADR-0045 decision
  4, ADR-0044 decision 4).
- **An absolutely-positioned corner stamp with a reserve constant.** Measured
  in a browser it overlapped the kicker by 10.09 × 72.95px at 1440×900, and
  `impeccable`'s `text-occlusion` rule was measured **blind** to it (occFrac
  0.286 against a 0.45 bar). The in-flow flex row deletes the failure mode
  rather than deferring the constants it depends on.
- **Repairing `usePriorConclusion` in the same stroke**, and repairing
  `day-state.ts`'s `cachedDayState`. See decision 1; neither has the defect
  in a reachable form.

## Consequences

(a) `impeccable detect`'s URL scan renders this surface **empty** — a clean
browser profile has no `localStorage` — a third confirmation of ADR-0031
consequence (e) and ADR-0043 consequence (d). So the **done** state is proved
the way ADR-0034 decision 4 names: a file-mode run, jsdom tests and
stylesheet-text assertions. The **pending** state, which this ticket also
changes, is proved by the **`impeccable.yml` CI job**, which discovers a real
`/arquivo/<data>` path out of the deployment's own HTML and scans it at both
viewports against the preview host the project config's ignores are scoped to.
No local `localhost:3000` scan is owed or run: it would need a running server,
a `DATABASE_URL` and a hand-picked archive date, and it duplicates a signal CI
already produces on the host the gate reads.

(b) **A cross-tab prune can make the chip disappear while the player is
looking at it, and the card's accessible name flips with it.**
`prunePlayRecords` runs on every play mount, drops settled records dated
before that mount's date beyond `RETAINED_PAST_RECORDS = 50`, and fires
`storage` into the tab holding the archive page. The chip goes done → pending
and the name goes `cardAriaDone` → `cardAria` (*"Jogar …"*) on an `<a>` that
may be focused — **strictly less specific, which is the one direction decision
3's monotone claim does not cover**, hence its scoping to hydration. Accepted
without a latch, both halves together: the direction is the understating one
ADR-0031 decision 2 permits, and after the prune the device genuinely holds no
record, so `pending` and *"Jogar"* are the honest answers.

(c) The archive's client graph gains `play-record.ts` (zod + `@miolos/core`)
on `/arquivo/[data]` for the first time, so
`scripts/route-client-js.mjs`'s *"the index, the month page and the day page
ship near-zero client JS"* is corrected in the same commit, and the route's
delta is re-measured against the shared 40 KB budget. `MAX_DELTA_BYTES` is not
raised.

(d) Past-retention and cross-device absence render as **pending with no caveat
copy** — ADR-0053 decision 10 layer 3's gap, accepted in the UI's silence. A
hedge sentence would be ADR-0031 decision 2's rejected *"treating the absence
of a record as 'not done' authoritatively"* wearing an apology.

(e) `DESIGN.md`'s Game card gains a documented archive variant with **five**
differences: no tabular result, no description, no pending accent button, the
chip in a flex row **above** the title rather than in a reserved box below it,
and **a deliberately tighter chip**. The size delta is the one a design review
comparing the two cards would see, so it is recorded here and in `DESIGN.md`
rather than only in the plan — **with its basis named, because a single figure
for a rotated box is ambiguous and the one this ADR first carried (29.34px)
was reproducible on no basis at all**. The hub's chip, measured three ways:
used box **28.5px** (2 × 1px floored border + 2 × 5px padding + a 16.5px
line), `offsetHeight` **29px**, painted rect through its own rotation
**31.8px**. The archive chip's used box is **23px**, ~19% tighter on the only
basis the two are comparable on, because it declares `line-height: 1` so its
geometry can be asserted from stylesheet text.

**And what `DESIGN.md` records is the DIAL, not a constant.** The card's
permanent growth and the tape → chip clearance trade continuously along
`--done-chip-box`, so the entry carries the trade: 24px row / +13px growth /
11.14px clearance at one end, 11px row / 0px growth / 4.14px clearance at the
other, shipped at **19px row / +8px growth / 8.64px clearance**. 19px is the
only intermediate point that keeps both terms of the pending card's rhythm on
DESIGN.md's 4pt scale, because the kicker gains growth/2 of leading on each
side and the terms are `24 + g/2` and `8 + g/2`.

(f) `T-WEB-S215` is the standing anti-drift instrument between
`archiveCardStatus` and the hub's `readDayState`; a change to either's status
semantics goes red there rather than diverging quietly. **Its claim is narrow
by design** — *the two read the same record the same way* — and explicitly
**not** that the two surfaces' states mean the same thing, which
`day-state.ts:26-30` says they do not. **Agreement alone cannot hold the
`pendingSync` / `syncOutcome` case**, because agreement is invariant under
both sides moving together; the absolute arm on `pendingSync: true` and
`syncOutcome: "rejected"` is what pins it, and it is a separate assertion for
that reason.

(g) Every day card on `/arquivo/<data>` grows **8px** (+7.7%), in both states,
permanently — measured `288 × 104 → 288 × 112` at 1440×900 and `350/320 ×
104 → × 112` at 390×844, 360×800 and 320×700, `.card` identical in the pending
and the done state at all four. **The kicker also gains 4px of leading on each
side**, so the pending card's internal rhythm changes and not only its
bounding box: top inset **24 → 28** and kicker → title **8 → 12**, on the
~99% of visits that carry no record. Both new values are still on
`DESIGN.md`'s 4pt scale, and that is the reason the dial sits at 19px rather
than at 18 or 20 — it is the only intermediate point at which they are.

That is the price of getting zero CLS by reserving the row, and the row is
reserved at the chip's **outer** box rather than its declared one: a
`margin-block: -2.5px` lets the chip overhang the row by 2.5px above and below
into the card's own 24px top padding, which is what buys back 5 of the 13px
the first shape cost. The chip stays a flex item — a margin is not a
`position` — so every overlap property the in-flow design rests on is
unchanged.

(h) **The day page acquires a 4 Hz `localStorage` poll for state that cannot
change in this tab, and that is accepted rather than opted out of.** Four
cards mount four `useRecordSnapshot` consumers, each of which installs its own
1 s interval and its own `storage` listener: four reads and four parses per
second for as long as the page is open, teardown clean. The chip renders
`concluded` and, for Termo, `outcome`; neither can move in this tab while the
day page is open, and the one path that does move them — the cross-tab prune
of consequence (b) — is carried by the `storage` listener, not by the poll. So
the poll genuinely buys this surface nothing.

**Dismissed on the measured cost, not on the code's shape** (the plan's
earlier refusal — *"a second reader class in the same module"* — argued a
shape and never engaged the cost, which is why this consequence exists).
Measured over the shipped `readPlayRecord`, jsdom, 20 000 iterations after a
warm-up: **13.1 µs** for a full 81-cell Sudoku record (read + `JSON.parse` +
zod parse) and **0.5 µs** for a miss. The archive's ~99% case is four misses —
**2 µs/s**. The worst case, four complete records, is **52 µs/s ≈ 0.005 % of
one core**, no network, no layout, and zero re-renders while the records stand
still because the cache hands back the same object. Against that: an opt-out
means a second subscription mechanism in the module whose whole point is that
`day-state.ts` and every conclusion share one, so a future in-tab writer on
this route would reach one reader class and not the other — a correctness
hazard bought for 0.005 % of a core. The poll also became the cache's only
collector under decision 1, so an opted-out consumer would accumulate entries
nothing sweeps. If the cost ever stops being negligible the fix is a single
shared interval for the whole module, which is a strictly better trade than a
per-consumer opt-out and needs no new reader class.
