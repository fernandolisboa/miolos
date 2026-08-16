# ADR-0056 — The record-snapshot cache is per key, and the archive's done chip wears the hub's on-time word

**Status:** Proposed — 2026-08-16 (issue #96)
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)

Every record this ADR depends on is **obeyed, not amended**. No statement in
ADR-0031, ADR-0041, ADR-0043, ADR-0044 or ADR-0053 is falsified, so no
`**Amended by:**` header is owed anywhere in `docs/adr/`. What *is* falsified
by decision 1 is source prose, in five places
(`src/archive/late-result.tsx`, `src/archive/use-prior-conclusion.ts`,
`src/play/day-state.ts`, `test/use-record-snapshot.test.ts` and
`scripts/route-client-js.mjs`), and a comment edit is not an ADR amendment.

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
   bounded `Map`, and the bound must be at least the number of
   simultaneously-mounted consumers.** The shipped single slot loops
   (`Maximum update depth exceeded`) with two consumers of different keys, and
   does so across **games** and across **dates** alike — the second was never
   recorded, and `/arquivo/<data>` is the first surface where the date is a
   URL variable. The repair is **never larger than the code it replaces**:
   rebuilt to spec independently several times, it measured between 0 and 5
   lines smaller, the spread being the eviction guard's shape and nothing
   else. **The bound is load-bearing and measured**: 16 live consumers against
   a 16-entry cache are stable, **17 loop**, so the safe property is not "a
   `Map` fixes it" but **`bound ≥ live maximum`** — today 2, after this ticket
   4, bound `GAMES.length * 4 = 16`. The property is about **live** consumers,
   not entries: eviction survives interleaving, and the dead keys ten
   simulated client navigations leave behind change nothing. **Eviction is
   `set`-then-trim**, so the key just written can never be the key evicted.
   `T-WEB-S213` holds the repair; `T-WEB-S214` holds a floor under the
   constant and an inventory of the consumer **call-site files**. **That
   inventory pins files, not mounts** — a surface that reuses an existing
   call-site file (the archive month page would mount 31 × 4 through this
   ticket's own `day-card.tsx`) raises the live maximum past the bound without
   redding anything — so **this decision, not that test, is what a new surface
   has to be read against**. Two siblings, named so the rule is not
   rediscovered: **`usePriorConclusion` is deliberately not repaired** — its
   slot is mount-scoped by design (#31 step-6 finding F4), its hazard is a key
   *hit* rather than a miss, and its measured bound is one consumer; and
   **`day-state.ts:192-204`'s `cachedDayState` is the one sibling with the
   identical defect**, a single date-keyed slot one level up that two archive
   dates in a session would evict the same way. It is unreachable today (the
   hub renders one date and this ticket adds no consumer) and is **not**
   repaired here.
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
   away. **It is reversible in one line** — split the const in `messages.ts`
   and update `T-WEB-S222`. **Two verbs (`Feito` / `Jogado`) are not
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
and **a deliberately tighter chip — a 23px used box against the hub's measured
29.34px** — because this one declares `line-height: 1` so its geometry can be
asserted from stylesheet text. The size delta is the one a design review
comparing the two cards would see, so it is recorded here and in `DESIGN.md`
rather than only in the plan.

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

(g) Every day card on `/arquivo/<data>` grows **13px** (+12.5%), in both
states, permanently — measured `288 × 104 → 288 × 117` at 1440×900 and
`350/320 × 104 → × 117` at 390×844 and 360×800. The kicker also gains 6.5px of
leading on each side, so the pending card's internal rhythm changes and not
only its bounding box. That is the price of getting zero CLS by reserving the
row rather than by overhanging it, and it is paid on the ~99% of visits with
no record.
