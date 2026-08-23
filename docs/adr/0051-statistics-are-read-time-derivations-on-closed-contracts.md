# ADR-0051 — Statistics are read-time derivations on closed contracts

**Status:** Accepted — 2026-08-13
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md)
**Amended by:** [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — the calendar's bound loses its name and its layer. Decision 2's *"The bound is **route-supplied**: `ACCEPTED_DAYS_BACK` lives at `apps/api/src/publishing/dates.ts` (ADR-0026 decision 6's layer) and `computeCalendar(rows, since, today, acceptedDaysBack)` takes it as a parameter"* and decision 5's *"its `ACCEPTED_DAYS_BACK` must stay in the route layer"* both name a constant #31 deletes. It split into two: `ROLLOVER_SLACK_DAYS` (this clamp, value unchanged) and `isWritableDate` (the write window, lower bound removed). **"One constant, one owner" is NOT falsified** — its subject is the calendar's bound, which is still one constant with one owner, and more clearly so after the split; what falls is the identifier and the sentence's **coupling** of this clamp to ADR-0026 decision 6's layer, which is now a different owner entirely. The parameter is renamed `rolloverSlackDays` to match; `computeCalendar`'s body, its clamp arithmetic and the won-only rule are untouched. **Decision 2's named #31 revisit is DISCHARGED, not amended:** ADR-0053 decision 7 takes its second sanctioned exit verbatim — pre-birth late completions are off-calendar, with the aggregates carrying them — so this ADR's *"Rows dated before `effectiveSince` emit no day entry but still feed every aggregate"* is the shipped behaviour rather than a default. Decision 4's unqualified fail row stands untouched (ADR-0053 decision 8 declines to change it).

## Context

ADR-0008 defined the three verbs and promised a stats calendar with three
visual states per date; ADR-0009 made completion rows the single source of
truth with everything else derived; ADR-0049 decision 6 committed #29's
statistics, in advance, to being "pure derivations over the same rows with
zero merge changes". Issue #29 is where those promises meet data, and five
things were unrecorded: what range a calendar honestly covers when a
"missed" day is an *absence* with no data source; how the values travel,
given that `GET /streak`'s contract is closed to growth (ADR-0048
decision 3); whether Termo — whose screen ships no clock (ADR-0045) —
participates in solve times; where day arithmetic lives once a calendar
must enumerate consecutive days; and which population each visible number
is computed over.

**Amendment audit — this ADR amends nothing.** ADR-0048 is followed, not
changed: new endpoints for new payloads is its own decision 3's
instruction, and the conclusion's `syncOutcome === "recorded"` mount gate
is its decision 4 reused verbatim. ADR-0026 decision 6 is *consumed*, not
amended: `ACCEPTED_DAYS_BACK` stays in the route layer where that decision
put it, and core receives it as a parameter (decision 2 below). *(This
forward claim is superseded at #31 —
[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
decisions 5 and 6 **do** amend ADR-0026 decision 6, and delete
`ACCEPTED_DAYS_BACK` outright. The claim was true of #29 and is not a
prescription this ADR could bind #31 with. What survives is the shape: core
still receives the bound as a parameter and still owns no clock, and the
clamp still lives in the route layer — under a new name,
`ROLLOVER_SLACK_DAYS`, and no longer in ADR-0026 decision 6's layer.)*
ADR-0008
rule 3 is followed as written — the fail row counts every lost Termo row,
unqualified — so no sentence of it and no CONTEXT.md row becomes false.
Plan 027's refusal to hoist `epochDay` was a plan note, never an ADR
decision, so decision 5 below contradicts no record. No `Amends:` header
exists and no reciprocal `Amended by:` line is owed anywhere.

## Decision

1. **Stats, the calendar and Dia Perfeito are pure derivations over one
   unfiltered reader, recomputed on every read.** `computeStats`,
   `computeCalendar` and `perfectDays` in `packages/core/src/stats.ts`
   take rows in and give values out — no clock, no timezone, no I/O. The
   rows come from a single reader, `listCompletionsForStats` on
   `@miolos/db/user` (`packages/db/src/stats.ts`), which projects every
   completion row of the user with no `where outcome` and no
   `where on_time`: every exclusion rule lives in core, where seam 2
   tests it — the exact shape ADR-0048 recorded for the streak. No stored
   aggregate, counter or cache exists (ADR-0009), so a merge needs zero
   stats-specific code (ADR-0049 decision 6, kept true). **No schema
   change:** `onTimeSql()` (`packages/db/src/completions.ts`) remains the
   single producer of on-time and this ADR adds projections of that one
   expression, never a second spelling. The #58 boundary stands: the
   stored on-time column, the "seen" table and the ADR-0026/ADR-0009
   amendments are #58's own, and nothing here exposes `onTime` on a wire
   contract or pre-empts "#58 changes the producer and nothing
   downstream".
   *Annotation (#58,
   [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md)):*
   *`onTimeSql()` is deleted — the single producer is now `onTimeAtWrite`
   (packages/core), applied once at write time and stored on the row, and
   this ADR's readers project the stored column. The single-producer
   discipline this sentence was stating survives whole with the new
   producer; the boundary held exactly as drawn.*

2. **The calendar runs from the account's own birth day, and "missed" is
   an absence.** `since` is the SP calendar day of the user's
   `users.created_at` (`getUserSince`, `packages/db/src/stats.ts`),
   through the DB clock's SP today. Per date, the precedence is
   **on-time > late > missed**: `"onTime"` iff a won on-time row exists
   that day, else `"late"` iff a won late row exists, else `"missed"` —
   and **a lost row never colours a day** (played is not completed,
   ADR-0008's verbs; the loss is visible in the fail row instead). The
   range start is **clamped, and only a won row extends it** (the
   won-only rule, corrected at step 6):
   `effectiveSince = min(since, earliest WON-row date on or after since − acceptedDaysBack)`
   — no such row, no extension. A completion may legitimately be dated
   before account birth (a 00:30 account completing yesterday's puzzle)
   and must appear — but only a row that actually **colours** a day may
   extend the range. A lost row colours nothing, so an extension it
   earned could only paint `"missed"` on a day the account did not exist
   for — and that path is reachable today (a 00:20 account *losing*
   yesterday's Termo). With the won-only rule every extension is bounded
   by exactly the days a write can legitimately predate birth AND
   anchored on a day the extension colours, so the calendar can never
   paint `"missed"` over days before the user existed.
   The bound is **route-supplied**:
   `ACCEPTED_DAYS_BACK` lives at `apps/api/src/publishing/dates.ts`
   (ADR-0026 decision 6's layer) and
   `computeCalendar(rows, since, today, acceptedDaysBack)` takes it as a
   parameter — one constant, one owner. Rows dated before
   `effectiveSince` emit no day entry but still feed every aggregate.
   **Named revisit for #31:** when the archive widens
   `ACCEPTED_DAYS_BACK`, pre-birth late completions become possible at
   arbitrary distance, and #31 must decide how the calendar shows them —
   an honest fourth treatment for pre-birth days (not `"missed"`), or
   off-calendar with the aggregates carrying them. Until then the
   default is never-fabricate-missed.

   *(**Amended and DISCHARGED at #31** —
   [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decisions 6 and 7. The **revisit is discharged** by the second exit named
   above, taken verbatim: pre-birth late completions emit no day entry and
   are carried by the aggregates — `solved` and the ten volume medals, never
   Dia Perfeito, never a time statistic, never a Termo bucket. That needs
   **zero change** to `computeCalendar`'s behaviour, because the
   "rows dated before `effectiveSince`" sentence above already specifies it.
   What is **amended** is the bound's name and its layer: `ACCEPTED_DAYS_BACK`
   is deleted and this clamp is now `ROLLOVER_SLACK_DAYS`, value unchanged,
   whose one consumer is this calendar and which is explicitly **not** the
   write window — feeding #31's widened write window into this clamp would
   drag the range back arbitrarily and paint the fabricated `"missed"` days
   the Rejected list below names. The parameter is renamed
   `rolloverSlackDays` to match. "One constant, one owner" stays true; the
   coupling to ADR-0026 decision 6's layer does not.)*

3. **Two endpoints, both closed to growth.** `GET /stats`
   (`apps/api/app/stats/route.ts`) carries the bounded aggregates —
   per-game blocks, the Dias Perfeitos count, `todayTermoGuesses` — for
   its three consumers (stats screen, conclusion stat block, hub Termo
   tile) *(a fourth consumer since #142: the cross-device remote conclusion
   — `RemoteConclusionView`, one lifted call per mounted view; an
   enumeration of readers, not part of the closure rule — no field grows
   and no endpoint is added, ADR-0065 consequence (a) sizes the count)*; `GET /stats/calendar` (`apps/api/app/stats/calendar/route.ts`)
   carries the unbounded-growing day enumeration for its one consumer
   (the stats screen). Both are verbatim clones of the `GET /streak`
   authenticated-READ template (ADR-0048; since #206 the template is
   `authenticatedRead`, not `GET /streak`): `z.strictObject` contracts
   parsed on both ends, `Cache-Control: no-store` on every branch, no
   request parameters, 401/500 only. Growth is a **new**
   endpoint/contract — #30's medals arrive on their own, never as fields
   here. **The calendar payload's revisit trigger, stated now so #37
   inherits a number:** when the enumeration exceeds **1,100 days** of
   account life, the response body exceeds **64 KB**, or the rendered
   calendar exceeds **~2,000 DOM elements** — whichever comes first —
   the endpoint gets windowing on a new contract, and not before.
   Measured at step 6: **~54 bytes/day raw (~3.6 bytes/day gzipped)**,
   which makes the two wire bounds near-coincident — 64 KB ≈ 1,210 days
   — so the day bound arrives (just) first and is the one to watch.
   **And the read side's own trigger:** when `listCompletionsForStats`
   exceeds **~4,000 rows** or the hub's `/stats` p95 visibly degrades,
   the hub gets a narrow endpoint (or `todayTermoGuesses` splits out of
   `/stats`) — a NEW contract per ADR-0048 decision 3, never a field
   change.

4. **Solve times are a three-game statistic; Termo's statistic is the
   guess distribution.** Best/average/histogram exist for binairo,
   sudoku and nonogram only; Termo's `elapsedMs` is recorded and
   rendered nowhere (ADR-0045 decision 4, executed). The contract
   encodes this structurally: the three timed games share
   `timedGameStatsSchema`, and `termoStatsSchema` has **no time field to
   misuse** (`packages/core/src/contracts/stats.ts`). The distribution's
   buckets 1–6 count won on-time rows by guess count; **the fail row
   counts every lost row, unqualified** — ADR-0008 rule 3 exactly as
   written (rule 2's exclusion list scopes to late *completions*, a
   different verb, and never reaches a lost row).

5. **`epochDay` is hoisted into `packages/core/src/date.ts`, with a
   guarded inverse.** The calendar is the second consumer plan 027
   lacked: it must enumerate consecutive days and turn epoch days back
   into ISO dates. `epochDay` moves verbatim from `streak.ts` (both
   `RangeError` guards intact); `dateFromEpochDay` productionises the
   test-side inverse with exact guards — it throws `RangeError` outside
   `[MIN_EPOCH_DAY, MAX_EPOCH_DAY]` (= `epochDay("1000-01-01")` …
   `epochDay("9999-12-31")`, derived, never spelled as literals), the
   mirror of `epochDay`'s own year-1000 floor and the `toISOString`
   expanded-year ceiling. `apps/api/src/publishing/dates.ts` is
   deliberately **not** consolidated — blast radius without need, and
   its `ACCEPTED_DAYS_BACK` must stay in the route layer (decision 2).
   *(**Amended at #31** —
   [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decision 6. This is a **forward prescription** about an identifier that no
   longer exists: `ACCEPTED_DAYS_BACK` is deleted and split into
   `ROLLOVER_SLACK_DAYS` and `isWritableDate`. The prescription's substance
   holds for both halves — each stays in `apps/api/src/publishing/dates.ts`,
   in the route layer, and `apps/api/src/publishing/dates.ts` is still not
   consolidated into `packages/core`.)*

6. **The three stat rows answer three different questions over three
   different populations, and the labels carry the distinction.**
   `bestMs` is the minimum over *all-time on-time wins*; `averageMs` is
   the mean over *on-time wins dated within the last 30 SP days* (with
   `averageSampleCount` exposing that population's size); `solved`
   counts *all wins including late* — a late solve is honestly a solve,
   and the calendar already marks it distinct. The UI obligation:
   the average's label carries its own window (`Sua média (30 dias)`,
   F5's register) and the other two carry none, because all-time is the
   unmarked reading.

## Rejected

- **A stored aggregate, counter or column** (including a stored
  on-time): ADR-0009 makes any stored derived value a cache; a cache
  needs merge code, invalidation and a migration, and buys nothing a
  ≤4-rows-per-day indexed read doesn't already give. The schema is
  untouched.
- **SQL-filtering the readers to won/on-time rows:** second definitions
  of the exclusions, untestable at the seam — the rejection ADR-0048
  already recorded for the streak, extended unchanged.
- **One endpoint carrying stats and calendar together:** the consumers
  have different weights (hub and conclusion need a small bounded
  payload; the calendar grows forever), and a strict contract can never
  be split later — so the split happens at birth.
- **Calendar range from the first completion:** once #31 exists, a late
  completion of an old date drags the range start backward and paints
  "missed" over days before the user existed.
- **A launch/archive-start anchor:** exists as a concept (ADR-0010) but
  as no stored value anywhere; inventing one here would be #31's
  decision made badly.
- **A published-dates reader behind the ADR-0004 wall:** drags the wall
  suite into a ticket that doesn't need it, and buys honesty the
  calendar can't use — `computeStreak` already treats absence as
  streak-breaking without consulting publication, and a calendar
  stricter than the streak would be two honesty standards for one
  absence.
- **An unbounded `min()` at the range edge:** the moment #31 widens
  `ACCEPTED_DAYS_BACK`, one archive completion of an old date would drag
  the range back arbitrarily far — the exact fabricated-missed failure
  the clamp exists to prevent.
  *(**Upheld, not amended, at #31** —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decision 6. This rejection is exactly why the constant **split** instead of
  widening: the write window lost its lower bound while the calendar's clamp
  stayed at one day under its own name, `ROLLOVER_SLACK_DAYS`. The identifier
  named here is gone; the failure it names is still the reason the two
  concepts must never be re-joined, and this ADR is annotated only because it
  is being edited for the real amendments above.)*
- **Extending the range for any in-bound row, won or lost** (the plan's
  original clamp, corrected at step 6): a lost row colours no day, so
  its extension day renders `"missed"` — fabricated history on a path
  reachable today (a 00:20 account losing yesterday's Termo). Only a
  won row extends (decision 2).
- **Per-game calendar day rendering:** quadruples the visual vocabulary
  against a design system with no reference frame for it; ADR-0008
  committed to per-date states.
- **A "perfect streak":** `perfectDays` returns a set of dates; no run
  length, no consecutive-day arithmetic and no second streak exists in
  code or contract.
- **Aligning `solved` with the on-time populations:** would silently
  un-count solves the calendar visibly shows — trading a labelling
  subtlety for a lie.
- **Request parameters (`?date=`, `?month=`, windowing):** speculative
  surface with no consumer; windowing arrives on a new contract if
  decision 3's measured trigger ever fires.

## Consequences

- The merge stays statistics-free: `mergeAccounts` changed by zero lines
  for #29, and the winner's union of rows *is* the statistics —
  ADR-0049 decision 6's forward commitment, now discharged.
- #30's rule-derived medals recompute over the same reader — `StatsRow`
  carries `hintsUsed` for exactly that, with the ADR-0027/ADR-0031
  constraint (display only, never backing a medal or entitlement)
  written on the field — and arrive on their own endpoint and contract.
- #31 inherits two named obligations: the pre-birth-late-completion
  rendering decision (decision 2) and nothing else — the clamp keeps the
  default honest until then. #37 inherits the calendar payload trigger
  as a number, not a shrug.
- #58, when implemented, changes the producer of `onTime` and nothing in
  this ADR — the row field is consumed as data, never recomputed.
  *Annotation (#58,
  [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md)):*
  *implemented; the prediction held on both halves — the producer changed
  (decided at write, stored) and nothing in this ADR moved.*
- ADR-0008's calendar consequence ("three visual states per date") is
  discharged: on time, late, missed, with Dia Perfeito as a marker on an
  on-time day only.
- The free-play wall extends over the stats modules and `/estatisticas`
  (ADR-0046's consequence, kept true by growth).
- The hub's Termo tile and the conclusion's stat block are `GET /stats`
  consumers; the conclusion mounts its block only under
  `syncOutcome === "recorded"` (ADR-0048 decision 4's gate), so the
  just-finished game's **row** is on the server by construction. The
  gate does not prove the server still holds the record's day AS today —
  a cross-midnight retry lands a late win — so the block's
  today-decorations (bucket highlight, closing line) additionally
  require `stats.date` to equal the record's date.
- The `recorded`-gate transition on the conclusion is a known
  **~250–300 px post-paint insertion**: the stat block mounts only once
  the server holds the day, and no box is reserved for it — a skeleton
  that might never fill on a permanently-failed sync would be dishonest,
  and the StreakCard precedent reserves nothing. #37 must measure CLS on
  a **warm recorded profile**, not inherit CLS≈0 from the cold scan.
- The app's single legal DEVICE-clock read is the stats calendar's
  settled-null neutral month title (`todaySaoPauloDate(new Date())` in
  that one branch): presentation-only — it claims no state for any day,
  selects no record and backs no derived value. The next screen may not
  cite the code as precedent without clearing that same bar; the shared
  helper's doc (`apps/web/src/i18n/sao-paulo-day.ts`) states the
  boundary at the call site.
- "Stats calendar" enters CONTEXT.md as a durable term.
