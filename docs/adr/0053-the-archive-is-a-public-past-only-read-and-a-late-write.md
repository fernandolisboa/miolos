# ADR-0053 — The archive is a public, past-only read and a late write

**Status:** Proposed — 2026-08-14 (issue #31)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0005](./0005-all-content-is-free.md), [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0013](./0013-canonical-domain-and-pt-br-routes.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md), [ADR-0039](./0039-termo-cannot-be-played-offline.md), [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md)
**Amends:** eight standing records. Every sentence below is quoted from the file as it stands; every amended file carries the reciprocal `**Amended by:**` line **and an in-place annotation of the amended sentence**, because in this repo "amended" means the file was edited ([ADR-0036](./0036-aligning-numerals-use-instrument-sans-not-fraunces.md) consequence (b)).

- **[ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md) rule 2** — *"**Archive completions are recorded, and marked late.** The stats calendar shows the date as solved with a visually distinct 'solved later' state."* For a late won row dated before the account's clamped range start there is no calendar entry at all — a class #31 and nothing else creates (decision 7). Rule 2's exclusion list and the three-visual-states consequence are untouched.
- **[ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)** — *"**Scope:** public, unauthenticated, cacheable server-rendered reads — the archive, published puzzle pages, OG images."* The archive, that clause's own named example, ships uncached (decision 2).
- **[ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)** — *"the buffer is ~`bufferDepth` days deep — so any M2 content-shape change **must keep the read-side schema parsing rows generated up to `bufferDepth` days earlier**."* After #31 the backward-compatibility horizon is the whole archive, not seven days (decision 4).
- **[ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)** — decision 6's *"A write may only target SP-today or SP-yesterday"*, its *"Without a lower bound any client could write a `won` completion for every past daily"* and its *"One day of slack is what keeps decision 7 from losing legitimate rows"*; the abuse posture's *"decision 6 caps the date axis at two days"*; and the consequence written about #31 by name, *"Widening it accidentally — by removing the bound while 'fixing' a date test — reopens the whole past calendar to forged completions"*, whose accident #31 commits deliberately and with its cost restated (decisions 5, 6, 13). **And its Rejected entry — *"**Application-level rate limiting on the write, in v1.** Considered and declined with its reasoning recorded below, not skipped."* — is REVERSED for the late branch** by decision 13.
- **[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md)** — decision 2's *"without the route the screen has no URL, and a screen with no URL cannot be scanned by the visual gate"*, narrowed to the daily play routes; the Context sentence that makes it universal, *"the shape all four dailies — and later the archive — will inherit"*; the consequence *"**Every future game screen is a copy of this shape**, not a new decision"*; and decision 5's per-route enumeration of the direct-read extension, which grows to the archive family (decisions 1, 2, 9).
- **[ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)** — consequence (f)'s *"the guess route runs ~6× per player per day"* and *"three indexed reads and no write, **at a volume bounded by the ritual**, is not ADR-0026's 'first abuse signal'"*: after #31 the ritual no longer bounds the guess route's legitimate volume (decisions 5, 11). Decision 8's own title — *"`ACCEPTED_DAYS_BACK` is hoisted to one module in `apps/api/src` and shared by both routes"* — and its back-reference name an identifier this ticket deletes; the substance (one bound, one module, both routes) survives whole as `isWritableDate` (decision 6).
- **[ADR-0039](./0039-termo-cannot-be-played-offline.md)** — decision 3's *"**429 is never terminal.** This repo emits none today — the vocabulary borrowed here is `sync.ts:47`'s `TERMINAL_STATUSES` … — and the case exists because the platform firewall can emit one."* `POST /completions` now emits `429 archive-cap` (decision 13), so *"this repo emits none today"* is false and the causal clause is no longer why the case exists. **The rule is strengthened rather than falsified** — a first-party 429 whose whole design depends on 429 never settling a record — and the guess route, this decision's own subject, still emits none. This amendment was missed by the first three audit passes precisely because ADR-0039 had already been *cleared* on a different sentence (consequence (c)); an ADR ruled on for one reason is not thereby ruled on for all.
- **[ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md)** — decision 2's *"The bound is **route-supplied**: `ACCEPTED_DAYS_BACK` lives at `apps/api/src/publishing/dates.ts` (ADR-0026 decision 6's layer) and `computeCalendar(rows, since, today, acceptedDaysBack)` takes it as a parameter — one constant, one owner"*, and decision 5's *"its `ACCEPTED_DAYS_BACK` must stay in the route layer"*. What falls is the identifier and the coupling of the calendar's bound to ADR-0026 decision 6's layer; **"one constant, one owner" stays true** and is more true after the split (decision 6). Decision 2's named #31 revisit is **discharged**, not amended — it offered decision 7's exit by name.

## Context

[ADR-0005](./0005-all-content-is-free.md) gave the product three play modes
and made the archive an indexable, organic-search asset that *"needs real
routing and pagination from early on"*.
[ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md) gave
archive play its semantics — recorded, late, never a streak — before any
archive existed.
[ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md)
made the archive's first day the first day the production cron published,
with no backfill and no stored anchor.
[ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)
named the archive as the case its direct-read scope was written for.
[ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
decision 6 bounded every write to two days and named #31 as the ticket that
would widen it. [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md)
decision 2 clamped the stats calendar's range against that same constant and
filed the pre-birth-late-completion question as #31's to answer.

Issue #31 is where all of that meets a URL. Six things were unrecorded, and
each is expensive to revisit once links exist in the wild:

1. **What the archive's URLs are**, and what a request for *today's* date
   under them means.
2. **Whether an archive page may be cached**, given that the operator's only
   takedown is a `killed_at` database write with no deploy and no
   invalidation hook.
3. **What removing the write window's lower bound actually buys an
   attacker** — the question ADR-0026 decision 6 posed and left for this
   ticket.
4. **That `ACCEPTED_DAYS_BACK` is two ideas wearing one name.** It is the
   write bound in ADR-0026 decision 6 *and* the stats calendar's range clamp
   in ADR-0051 decision 2. Widening the first for the archive would drag the
   second backward and paint fabricated `"missed"` days — the exact failure
   ADR-0051's Rejected list names.
5. **How the daily play machinery behaves at a date that is not today.** The
   archive is the first surface to run it there.
6. **How a visual gate whose input is a literal URL list reaches a page
   whose address is a date nobody can hardcode.**

**Amendment audit — this ADR amends eight standing records**, listed with
their quoted sentences in the `Amends:` header above and re-derived against
the ADR text three times at write and once more at step-6 review, which is
where the eighth (ADR-0039) was found. Three further rulings are recorded
here rather than left absent, because the failure this project has actually
hit is an ADR **nobody looked at**:

- **[ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md) was
  audited and is NOT amended.** Consequence (g) says *"**No index is owed on
  `daily_puzzles`, which has none beyond its primary key**. Revisit only if
  a second game needs a content read-back, or if `daily_puzzles` exceeds
  ~10⁵ rows."* #31 adds no index and no migration (decision 4), so the
  factual half stays literally true. Neither revisit trigger fires: the two
  list readers name no `content` column at all, `getArchivedDaily` reads
  content for exactly one `(game, date)` through the composite primary key —
  which is not the ~400-row scan (g) was written about — and at 4 rows/day
  the ~10⁵-row trigger is roughly 68 years away. ADR-0040's costing of its
  own rejected partial-unique index partly on *"it would be `daily_puzzles`'
  first index beyond the primary key"* survives for the same reason.
- **Two orphaned reciprocals exist repo-wide and are out of #31's scope**,
  named here only so a later audit does not attribute them to this ticket:
  [ADR-0006](./0006-monetization-convenience-not-access.md) carries no
  `Amended by:` line for
  [ADR-0027](./0027-the-hint-is-computed-on-the-client.md)'s amendment of
  it, and [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md)
  carries none for
  [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)'s.
  Both predate this ticket and neither touches the archive.
- **The rule for a sentence that merely names a now-dead identifier, stated
  once because #31 applies it several times.** `ACCEPTED_DAYS_BACK` no
  longer exists in `apps` or `packages` after this ticket. A sentence that
  names it without making a false forward claim is annotated **only when
  its file is already being edited for a real amendment** — the annotation
  is bookkeeping, not a finding, and opening an untouched ADR to record
  bookkeeping is a drive-by. Both
  [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md)'s
  Rejected entry and [ADR-0039](./0039-termo-cannot-be-played-offline.md)
  consequence (c) are annotated under that rule, each still **valid** and
  each in a file this ticket edits for a real amendment. Both are
  **past-tense statements about what their own ADR did**, so they assert
  nothing about the future and stay true — which is precisely why ADR-0051
  decision 5's **forward prescription** (*"must stay in the route layer"*)
  does not. ADR-0039 carried this exemption alone until step-6 review
  found the real amendment in its decision 3; the lesson recorded here is
  that clearing an ADR on one sentence is not clearing the file.

Everything else this ADR **executes** rather than changes: ADR-0004's wall
(no archive reader can address a future date — the bound is in SQL, and the
sitemap's URLs are produced by the reader rather than filtered afterwards);
ADR-0005 `:35`'s pagination sentence, discharged by decision 1; ADR-0010
`:20`'s *"one shared query helper, not a predicate re-typed per route"*, the
sentence decision 4 obeys literally; ADR-0010 `:25`'s no-backfill, which is
decision 3; ADR-0013's pt-BR segments; ADR-0028 decision 6's standing
prohibition on `generateStaticParams` over dates, honoured rather than
argued with; ADR-0031 decision 4, consumed by decision 10; ADR-0043's closed
`ConclusionView` prop budget, which is *why* decision 9 goes the way it
does; and ADR-0052 decision 3's volume class, which decision 5 cites as
working exactly as designed. **[ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md)
is not falsified but its revisit trigger fires** — see decision 13.

## Decision

**This ADR landed in PR 1, which shipped only the write window; PR 2 has
since shipped the archive itself.** Decisions 5, 6, 7, 8, 13 and 15 were
implemented by PR 1. Decisions 1, 2, 3, 4, 9, 10, 11, 12 and 14 described
surfaces PR 2 built, and every one of them is now shipped — the routes, the
readers and the classifier, the late-result panel, the retention cap, the
discovery mechanism and the `sync.ts` `break` decision 13 made binding on
that pull request. Where a sentence below still reads as a prescription, it
is a prescription that the shipped code satisfies rather than one waiting on
work.

**Three points where the shipped code refines what is written below**, each
recorded in plan 037 §14 batch 6 rather than by silently rewriting the text:

- Decision 10's third layer used to say the panel renders the **stored row's**
  outcome. **It does not, and the sentence has been rewritten to say what
  ships** (I42, correcting I29's own account of the same point). `sync.ts`'s
  `acceptResponse` parses and discards `completionResponseSchema.outcome`
  exactly as it discards `onTime`, so the panel renders **this session's
  locally judged board** and the note beside it never asserts when the
  server's row was written. Carrying either field to the panel would mean a
  versioned change to the local record schema, which this ticket does not
  make. The panel's states are therefore exactly the ones the device can
  check — queued, refused, already held here, settled, or not stored at
  all — which is what the criterion needs: the screen never claims a
  completion it did not make.
- Decision 4's read-cost posture was measured rather than assumed at PR 2:
  the three grid play routes came in **below** their daily twins (binairo
  18.2 KB against 33.4, nonogram 19.7 against 35.5, sudoku 14.4 against
  29.6), because the archive shells compose the per-game hooks and views and
  never the screen roots, so the whole conclusion tree is outside their
  module graphs. Plan 037's predicted squeeze on the archived Nonogram did
  not happen (I33).
- Decision 14's localStorage ceiling is now a number: the largest serialized
  record is 1,329 bytes, so fifty of them is ~65 KiB — about 2.5 % of a
  5 MiB per-origin quota counted in UTF-16. Fifty stands (I34).

1. **Four route families, seven pages, date before game, the game segment
   literal — and today's date resolves rather than 404ing.** `/arquivo` is
   the index; `/arquivo/mes/<YYYY-MM>` is a month; `/arquivo/<YYYY-MM-DD>`
   is a day; `/arquivo/<YYYY-MM-DD>/{binairo,sudoku,nonogram,termo}` are the
   four playable archived dailies. The game segment is **literal**, not
   dynamic — [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md)
   decision 1's precedent in its own words (*"the route boundary is what
   carries ADR-0011's per-game code-splitting … the 404 is by absence"*),
   which is also what keeps Termo's validation dictionary off the archived
   Sudoku's route. Date-first is the shape a human reads and the shape a
   month page groups under; `/arquivo/<jogo>/<data>` would make the game the
   collection and the date the leaf, inverting what the archive is.

   **A day page exists**, and it is what makes a month page legible on a
   phone: one date link per row instead of four game links, so a 31-day
   month is ~31 touch targets rather than 124 anchors. It also removes a 404
   any human would trip — `/arquivo/2026-08-03` is the prefix of four valid
   URLs.

   **`/arquivo/<hoje>` and `/arquivo/<hoje>/<jogo>` resolve**, with a
   **temporary** redirect to the hub and to that game's daily route
   respectively — the day URL to `/`, the play URL to `/<jogo>`, each landing
   one level of specificity where it came from. *(This line named the two
   targets the other way round until #31's step-7 round; the shipped code is
   the sensible pairing and the record was wrong — plan 037 §14 I43.)*
   Sharing happens immediately after playing, and `/termo` is not a per-day
   URL — a link shared at 21:00 serves a different puzzle after the
   rollover — so 404ing today would leave the one window where sharing
   actually happens without a permalink, which is the URL #34 inherits from
   this ticket. **307, not 308**: the rule's truth value changes at
   midnight, and a permanent redirect is cacheable against the URL forever,
   so it would silently break the shared link days later, only for the
   people who followed it once.

   **The two reads run in a fixed order, and the order is load-bearing.**
   Every archive page reads its **content first** and classifies the date
   only when the content read comes back empty: a row in hand *is* the proof
   that the date is past, so no clock comparison can contradict it. The
   archived path therefore costs exactly one round trip and never consults
   the classifier. Classify-then-read, and `Promise.all`, both admit a
   midnight straddle that can 404 a date whose row was already returnable;
   this ordering's only straddle is a `"past"` classification after an empty
   read, which answers 404 and resolves on reload, and which can never reach
   a sitemap-advertised URL because the sitemap is built from the same
   reader under the same clock.

   **No write ever originates from an archive path.** The today-redirect
   leaves the archive before anything is playable — the play URL lands
   directly on the daily route, the day URL on the hub and thence on a daily
   route — so every completion it can lead to is an ordinary daily write that
   derives `on_time = true` correctly.

2. **Every archive route is `force-dynamic`, and the reason is the kill
   switch, not the rollover.** `export const dynamic = "force-dynamic"` on
   all seven pages, on `sitemap.ts` and on `robots.ts`; no `revalidate`, no
   `generateStaticParams` (ADR-0028 decision 6, obeyed), no `fetch` on any
   server path.

   The daily is uncached because a cached page serves yesterday's puzzle
   after the rollover. An archived day's content is immutable, so that
   argument does not transfer and pretending it does would be dishonest. The
   real reason is that ADR-0010 `:23` and ADR-0024's operational semantics
   make `killed_at` the operator's takedown, it is **a database write with
   no deploy and no invalidation hook**, and a cached archive page outlives
   it for the whole TTL.

   **The trade is stated rather than strawmanned.** `export const revalidate
   = 60` would bound takedown latency to sixty seconds while cutting
   crawler-driven database reads on this surface by roughly two orders of
   magnitude. This ADR takes the zero-latency side because the archive has
   no traffic yet, so the cost side of the trade is currently zero, and
   because an operator takedown is the one archive operation with a legal or
   reputational clock on it.

   **The standing precondition on any future caching of this family, on the
   record:** the `killed_at` write must **first** gain a writer that calls
   `revalidatePath` for the affected paths (day, month, index, play,
   sitemap). Cache-then-invalidate is the wrong order. No `revalidate` may
   be added to an archive route before that writer exists.

   **This is where ADR-0014's scope edge is amended.** The archive is that
   clause's own named example of a *cacheable* read and it ships uncached.
   The honest record: `public, unauthenticated, non-user-specific,
   helper-gated` is ADR-0014's substance, and **cacheability was never the
   load-bearing property** — it was a description of the case its author had
   in mind. ADR-0028 extended the same clause once for the play routes; this
   extends it for the archive.

   The issue's own words are *"These are public, unauthenticated,
   **cacheable** pages."* The contradiction is surfaced to Fernando in the
   PR rather than resolved by silence.

   **Revisit trigger, with something that can observe it:** Neon
   compute-hours attributable to archive and bot traffic, read off the Neon
   console — observable today, with no instrumentation, which is the point.
   p95 on `/arquivo` is the better metric and #37 owns instrumenting it.

3. **The archive's floor is the data's own; nothing records a start date.**
   The archive starts wherever the months reader says it starts. ADR-0010
   `:25`'s *"no archive backfill; day one of the product is day one of the
   archive"* is a statement about what exists in `daily_puzzles`, and a
   second copy of that fact is a second thing to keep true. A constant would
   be wrong in preview — which shares the production database — the moment
   production's first publish moved, and a constant that disagrees with the
   data produces an index full of links to 404s. `remote_config` is
   unreachable from `apps/web` by ADR-0024's surface rule, so its one
   consumer could not consume it. ADR-0051's Rejected list already ruled on
   this shape from the other side: *"A launch/archive-start anchor: exists
   as a concept (ADR-0010) but as no stored value anywhere; inventing one
   here would be #31's decision made badly."* This is #31, and the decision
   is not to invent it.

   **The floor is ragged, and that is the shipped shape rather than an edge
   case.** The cron gained its four games on four different days with no
   backfill, so the archive's oldest days hold one, two or three games. The
   day readers return `(date, game)` pairs, so a short day comes back short
   and renders short — the same shape any `killed_at` takedown produces,
   which matters because the kill switch is this decision's whole
   justification for `force-dynamic`.

4. **Three archive readers and one clock classifier, over ONE spelling of
   the publication conjuncts and ONE spelling of the São Paulo clock — and
   no index.** `packages/db/src/published.ts` gains a private
   `publishedConjuncts()` returning `[published_at <= now(), killed_at IS
   NULL]` and a private `saoPauloToday()` returning the single `(now() at
   time zone 'America/Sao_Paulo')::date` fragment. Both the shipped
   `wallPredicate` and a new private `archivedWallPredicate` **spread** them;
   neither re-types them. Over that predicate sit a per-day reader
   (`getPublishedDaily`'s twin plus *strictly before the São Paulo day*), a
   `(date, game)` list reader, a months reader, and — reading no table and
   carrying no wall — a date classifier answering `past | today | future`.
   `wallPredicate`'s signature, semantics and callers are unchanged.

   **Why the extraction rather than a second copy.** The new readers
   genuinely cannot call `wallPredicate` (it takes `game` as required and
   treats an absent date as *equals today*, the opposite of the archive's
   need). Concluding from that that the archive should re-type
   `published_at <= now()` and `killed_at IS NULL` would ship **a second
   spelling of ADR-0004's wall** — against ADR-0010 `:20`'s *"one shared
   query helper, not a predicate re-typed per route"*, with the archive
   named in that very sentence, and against ADR-0014's *"otherwise
   ADR-0004's guarantee would have two enforcement points to keep honest"*.
   ADR-0026 `:92-95` protects the wall from acquiring the **write** bound; it
   says nothing about factoring out a conjunct two predicates share, and
   reading it as a no-touch rule is an error this ADR names so it is not
   made again.

   **The date bound on the archive predicate is a READ bound on new
   readers.** ADR-0026 decision 6's rule that the *write* bound lives in the
   route and not in SQL is untouched.

   **The classifier is the only clock `apps/web` may consult for the
   archive.** `todaySaoPaulo` stays on `@miolos/db/publishing`, which ESLint
   bans in `apps/web`; the in-repo `todaySaoPauloDate(new Date())` is the
   **web server's** clock, on a different machine from Postgres, and using
   it here would mean the archive predicate decides "past" from the database
   clock while the page decides "today" from the web server's — so in the
   rollover window where they disagree a URL the sitemap advertises neither
   redirects nor renders. One clock, read through the wall's own module.

   **A bad historical row 404s; it does not 500.** If a stored row's content
   fails to parse, the per-day archive reader logs the game and the date and
   returns nothing, so the page answers `notFound()`. This URL is one the
   sitemap advertises to crawlers, and a 500 there is worse than a 404 in
   every dimension — it pages nobody, it is not cacheable-negative for a
   crawler, and it hides which row is bad. The log line *is* the alarm. The
   two shipped readers keep throwing, because on those a bad row is a live
   incident.

   **This is where ADR-0024's backward-compatibility horizon is amended.**
   Its duty was scoped to *"rows generated up to `bufferDepth` days
   earlier"*. After #31 a content-shape change owes compatibility with
   **every row ever published**. The failure mode is decided rather than
   deferred: the reader returns nothing and logs, per the paragraph above.

   **And no index ships.** `packages/db/src/schema.ts` and
   `packages/db/migrations/**` come out of this ticket byte-identical. A
   `(date)`-only btree serves neither list reader's predicate — both carry
   `published_at <= now()` **and** `killed_at IS NULL`, so every candidate
   row is still a heap fetch, which is the exact cost such an index would be
   justified by; the months reader is a `SELECT DISTINCT` over every
   published row and gains nothing at all. An index that would actually pay
   is a larger design decision than a routing ticket should make, and it
   would be this repo's first index-only migration. Nothing needs it yet:
   `daily_puzzles` grows at 4 rows/day — 1,460 a year — behind uncached
   pages that today have no traffic. **The standing ordering rule, which is
   the part worth keeping:** if archive read cost ever becomes real, the
   response is `revalidate` **first** (decision 2's precondition
   discharged), and an index shaped against the **real** predicates second,
   decided with `EXPLAIN` output — never a reflex `(date)` btree pattern-matched
   from "table scan".

   What replaces the index as this ticket's read-cost answer: every reader
   is bounded by construction on every page that is not the sitemap, the
   months reader is one grouped scan rather than an unbounded row read, and
   archive links carry `prefetch={false}` so the framework's viewport
   prefetch cannot turn one month page into dozens of RSC requests against
   uncached, database-reading routes.

5. **The write window loses its lower bound, and what that costs is stated
   in full rather than dismissed.** A completion or a guess may target any
   day up to and including the database clock's São Paulo today. There is no
   lower bound: the archive is every published past day, and **the wall is
   the only authority on which those are**. The bound stays in the route and
   out of SQL, exactly where ADR-0026 decision 6 put it.

   **The argument is about what forgery BUYS, because the tempting argument
   — that forging the past *is* solving the past — is false, and this
   codebase says so in its own words.**

   - **For Termo it is false outright.** ADR-0038 decision 9 records that
     the guess route *"IS an answer oracle"* and that *"its real cost is ONE
     authenticated request"*: six dictionary words that are not the answer
     make a terminal board, and decision 2's refine then **requires**
     `answer` in the response. So a forged archived Termo costs two requests
     and zero solving. Both write routes share one window, so removing the
     lower bound widens the oracle's date axis exactly as far as the write
     window.
   - **For the three grid games it is only marginally better.** ADR-0038
     `:216-219` records the comparison this project already accepted:
     *"`solveBinairo(givens)` is a 0.04–0.16 ms **local** solve over data the
     published payload hands the client (ADR-0027 decision 1), needing no
     session, no network and no server."* Forging a grid day costs one public
     read and a fraction of a millisecond of CPU.

   **What a forged past win cannot reach**, verified against the shipped
   code: the streak, every time statistic, Termo buckets 1–6, the
   guess-count medals, Dia Perfeito, and the calendar's `onTime` state. **What
   it can reach, and this is not nothing:**

   - **`solved` totals**, which carry no on-time conjunct by ADR-0051
     decision 6's explicit choice — *"a late solve is honestly a solve"*.
   - **Ten of the twenty-three medals.** The derivation's `countsAnyWon`
     backs the total-wins and each-game-won rules, reaching `first-win`,
     `wins-10`, `wins-50`, `wins-100`, `wins-500`, `binairo-30`,
     `sudoku-30`, `nonogram-30`, `termo-30` and `all-games`. A three-year
     archive is **over 4,000 late wins** — three years × four games × 365 —
     which is eight times what the largest volume medal asks, and it is the
     same 4,380 decision 13 sizes the ceiling against.

   **It is accepted, on the record's own terms.** ADR-0006 `:51`: *"It is not
   an anti-cheat system, and no detection infrastructure is being built for
   a rank that v1 does not have."* ADR-0004 `:13`: *"There is nothing to
   cheat for — v1 has no global ranking (a product veto), so a cheated
   streak only cheats its owner."* And the decisive point: **legitimately
   solving hundreds of archived puzzles is exactly what #31 ships**, and
   ADR-0052 decision 3's volume class was designed to count late wins. Those
   medals cannot distinguish a scripted mint from a determined player **by
   design**, not by oversight. The residual is bounded — not closed — by
   decision 13.

   **It also tightens the future edge**, which the shipped code did not do:
   a future date was previously refused at the wall, and is now refused in
   the route ahead of the wall read.

   **This is where ADR-0026 decision 6 and its two consequence paragraphs
   are amended**, and where ADR-0038 consequence (f)'s *"at a volume bounded
   by the ritual"* stops being true — the guess route's legitimate volume is
   now six times however many archived Termos a player opens. The rest of
   (f) survives whole: the per-request cost figure, the "neither ADR's
   justification transfers" claim, and its third revisit trigger.

6. **One name held two ideas; they split, with one owner each, and they may
   never be re-joined.** `ACCEPTED_DAYS_BACK` is deleted. In its place, in
   the same module and the same layer:

   - **`ROLLOVER_SLACK_DAYS = 1`** — the only days a write *intended as on
     time* may legitimately predate the account's birth day (a 00:30 account
     flushing yesterday's completion). Its **one** consumer is the stats
     calendar's range clamp. Value unchanged, behaviour unchanged.
   - **`isWritableDate(date, today)`** — the write window, upper bound only.

   **The split is the ticket's hardest decision and its reason is
   mechanical.** Feeding the widened write window into the calendar's clamp
   would drag the calendar's range back arbitrarily and paint `"missed"`
   over days the account did not exist for — the exact fabricated-missed
   failure ADR-0051's Rejected list names and its clamp exists to prevent.
   Holding the clamp at one day while the write window opens is the single
   line that makes decision 7 true.

   **This is where ADR-0051 decisions 2 and 5 are amended, and the reason
   matters.** What becomes false is the **identifier** and decision 2's
   **coupling** of the calendar's bound to ADR-0026 decision 6's layer —
   which after the split is a different owner entirely. *"One constant, one
   owner"* is **not** falsified: its subject is the calendar's bound, and
   that is now `ROLLOVER_SLACK_DAYS`, still one constant with still one
   owner. ADR-0038 decision 8's substance — one bound, one module, both
   routes, no drift — likewise survives whole; only the name it is written
   under changes.

7. **A late completion dated before the account's clamped range start is
   OFF-CALENDAR, with the aggregates carrying it.** This discharges ADR-0051
   decision 2's named #31 obligation through its **second** sanctioned exit,
   verbatim: *"off-calendar with the aggregates carrying them"*. It needs
   **zero change to the calendar's behaviour** — ADR-0051 decision 2 already
   specifies *"Rows dated before `effectiveSince` emit no day entry but still
   feed every aggregate."* What makes that true after the widening is
   decision 6's constant split and nothing else.

   **Which aggregates, precisely.** An off-calendar late won row is an input
   to the statistics derivation, where the on-time conjuncts exclude it from
   every time statistic and from Termo buckets 1–6. Dia Perfeito never sees
   it — the derivation skips a row that is not an on-time win at the first
   line of its loop. The only aggregates it moves are **`solved`** and the
   **ten volume medals** decision 5 enumerates.

   **Why not a fourth calendar state.** The wire enum is strict-parsed on
   both ends, so adding a member is a **value-set** growth: during a deploy
   skew an already-loaded client parsing a payload containing the new state
   fails, the hook settles null, and the user's entire calendar disappears —
   indistinguishable from "no history". ADR-0052 decision 5 **names and
   designs against** exactly this shape for medal ids. It would also cost a
   legend row, an aria string, a CSS treatment and an amendment to ADR-0008's
   three-visual-states consequence, all to render days the account did not
   exist for.

   **Why it is honest rather than a dodge.** The stats calendar is the
   account's own days; a day before the account existed is not one of them.
   The *common* case — an account solving an archived day from inside its own
   lifetime — renders `"late"` through machinery that already ships end to
   end.

   **This is where ADR-0008 rule 2's calendar sentence is amended**, for
   this one class and no other. Before #31, a won row can be at most one day
   back and is therefore always inside the extension floor; the class is
   created by this ticket and by nothing else.

8. **The Termo fail row stays unqualified.** A lost archive Termo counts in
   the fail row exactly as a lost daily Termo does. ADR-0008's verbs are
   disjoint and the reading is already written down: rule 2 excludes late
   **completions** from the distribution; rule 3 says a lost Termo is
   **played**, not completed, and *"the loss records in the Termo guess
   distribution as the fail row"*. ADR-0051 decision 4 recorded that reading
   and it stands unamended. A late *win* still never enters buckets 1–6.

   **The cost is recorded loudly rather than fixed.** Issue #31's third
   acceptance criterion says archive play *"demonstrably never changes
   streak, times or distributions"*. The fail row **is** part of the guess
   distribution and it **will** move. **AC 3 as literally worded is therefore
   not met on this branch, and ADR-0008 rule 3 says it should not be.** The
   test suite asserts that the fail row moves rather than omitting it, and
   the carve-out goes to Fernando in the PR in those words. After this
   ticket, nothing in the data distinguishes a late loss from an on-time one
   on that branch; qualifying it would need a second spelling of the on-time
   predicate at the exact place ADR-0026 decision 2 forbids second
   spellings, and would silently un-count losses ADR-0008 rule 3 promises to
   count.

9. **There is no archive conclusion route.** A closed archived board swaps
   its body to a late-result panel **in place, on the same URL**.
   `/arquivo/<data>/<jogo>/concluido` does not exist, and the archive never
   renders `ConclusionView`.

   `ConclusionView` is a today-machine: its streak card is a bare streak
   read whose copy reads *"— mantida por hoje"*; its next-puzzle affordance
   chains to **today's** routes, which ADR-0044 decision 5 defines as *"the
   first daily this device can still play today"*; its day chips would read
   as four unplayed dailies for an archived date. Fixing that needs either a
   new prop — and ADR-0043 consequence (a) closes that budget at *"exactly
   TWO optional members … There is no third member"* — or date gates inside
   a component this ticket puts on the do-not-touch list.

   **This is where ADR-0028 decision 2's route half is narrowed to the daily
   play routes.** Its stated reason — *"without the route the screen has no
   URL, and a screen with no URL cannot be scanned by the visual gate"* — is
   load-bearing for the daily and does not transfer: the archive play URL is
   **itself** permanent and re-renders the stored result on reload (true
   *because* decision 14 keeps the record), so the bookmark and back-button
   cases the daily route exists for are already served; and the visual gate
   would only ever reach the empty branch, which for the archive is a screen
   no real user sees. Beyond decision 14's retention, or on a second device,
   the URL renders a playable board again — and that tail case fails
   **identically with or without** the route, because a device with no local
   record has nothing for a conclusion route to render either.

   The archive's play screen carries **one** optional prop on the shared
   per-game view — a back affordance and a note — and nothing else. Three
   things then say "you are in the archive": the back link names the day and
   leaves for the day page, the top bar renders the archived date, and the
   note states in a full sentence that this does not count toward the
   streak, which is the thing AC 3 actually needs a player to be told.

10. **"You already solved this" is discharged at the write path, and no read
    endpoint ships.** Three layers, in this order:

    1. **Mechanical, and this is the acceptance criterion's actual teeth.**
       The composite primary key plus the idempotent short-circuit, which
       runs **before** the date check, **before** the wall read, **before**
       judging and **before the volume cap** — the cap comes last because
       decision 13 folded it into the write itself — and returns the **stored** row
       with `recorded: false`. A day completed on time and then replayed
       from its archive page returns the on-time row byte-for-byte and
       writes nothing.
    2. **Local, and this is the common case.** A concluded play record for
       `(game, date)` restores the closed state through the shared
       lifecycle's own short-circuit, with no new code — and decision 14 is
       what keeps that record around long enough for this to be the common
       case rather than a theoretical one.
    3. **Cross-device or post-retention, the honest gap.** The board is
       playable; on submit the server answers with the stored row and **writes
       nothing**, and the panel renders **this session's own** outcome beside
       a note that claims no more than the device can check. Replaying a
       puzzle you already solved is a legitimate act on a public archive;
       what the criterion forbids is *reopening the daily*, and nothing can.

       **This layer used to promise that the panel rendered the stored row's
       outcome, and that is not what shipped** (plan 037 §14 I42). The client
       discards both `completionResponseSchema.outcome` and `.onTime`, so no
       server-side verdict reaches any view; carrying one would be a
       versioned change to the local record schema, which #31 does not make.
       The reachable consequence is Termo-specific and is stated rather than
       hidden: win an archived Termo on device A and lose it on device B, and
       the guess route judges the new session while the completion POST
       short-circuits to the stored **won** row — the panel prints the loss
       the player just played. The mechanical teeth in layer 1 are unaffected;
       what the panel loses is the ability to contradict a board the player
       is looking at, which is not a property this layer needed.

    **Why no endpoint.** A per-day per-user read would be a user-specific
    fragment on a public page, which ADR-0014 routes to `apps/api` — **as
    narrowed by [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
    decision 4 to fragments whose source is server state**, which this one's
    would be. Defensible in principle, but it is speculative surface with one
    consumer and a per-request cost on a crawler-facing route, and ADR-0031
    decision 2's monotone rule makes its absence harmless: absence proves
    nothing and renders as playable, never as a false claim.

11. **Termo is in the archive.** All four games are archivable and
    `/arquivo/<data>/termo` ships. This reverses the pattern free play set,
    and the reversal is argued rather than inherited: Termo is out of free
    play because its word list is finite curated content
    ([ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md))
    and free play would burn unspent words. **An archived Termo's answer was
    already spent** — it was the shared daily for that date and is already in
    the used set — so playing it burns nothing. The invariant is about
    *unspent* content, and the archive touches none.

    ADR-0038 decision 9 bounds its oracle with *"it returns only days the
    caller could already have played"*. Under #31 that sentence becomes true
    for a wider set of days, and it is true **because** #31 makes those days
    playable; no confidentiality claim is weakened, because decision 9 makes
    none. What the widening costs is decision 5's cost statement and
    ADR-0038 consequence (f)'s amended volume claim, not a new exposure.
    ADR-0039's posture — no offline finish, one round trip per guess and the
    held-turn table — is inherited in substance, and its 429 bullet is
    amended by decision 13 (see the `Amends:` header). #31 narrows the guess
    route's 404 arm to **four** reachable causes: a killed row, an
    unpublished date, a never-published date (no row at all), and a **future**
    date — which decision 5's own tightening now refuses in the route, ahead
    of the wall. T-API-S102 pins the set.

12. **A date-bearing gate URL is DISCOVERED from the app, never hardcoded —
    and this is the standing rule, not a one-off.** The visual gate's input
    is a literal URL list, and archive URLs are dates. The preflight step,
    which already fetches every path and greps its body, extracts the first
    month path from the index, the first day path from that month, and the
    first play path from that day, and hands the three to the scan.

    Every alternative is worse in a way that matters: a hardcoded date
    **drifts** the moment the archive's edges move and 404s forever after; a
    date computed in the shell is **a client clock deciding what the São
    Paulo publication wall published**, which the project's own invariant
    forbids; and a stable alias route is a second URL for one resource.
    Discovery matches the **URL grammar** rather than the markup, so a
    restyle cannot break it, and it cannot 404 because the URLs came out of
    a 200 body.

    Three properties make it safe and they are part of the rule: only
    **paths** are exported, never a URL carrying the deployment's bypass
    secret; each extracted value is **re-validated against its anchored
    grammar** before use, because its source is a fetched HTML body; and the
    values reach the scan through the environment, never by textual
    interpolation into a shell command. **An empty archive is a skip, not a
    failure** — the job fires on every preview for every PR, so redding on
    an empty archive would block the gate repo-wide on unrelated work.

13. **A player may write at most 50 LATE completions per São Paulo day, and
    the ceiling is enforced inside the write statement.** The completion
    route refuses a write whose date is strictly before the database clock's
    São Paulo today — `isLateDate`, the route layer's spelling — with `429
    archive-cap` once the caller already holds 50 such rows written on the
    current São Paulo day. The guard runs **after** the idempotent
    short-circuit, **after** the date predicate, **after** the wall read and
    the judge, and **only on the late branch**, so the daily path pays
    nothing and a request destined for a terminal 404 or 422 never reaches
    it.

    **It is a LATE-write ceiling, not an archive-write ceiling, and the
    difference is not cosmetic.** `isLateDate` also admits ADR-0026
    decision 7's legitimate post-rollover flush — a player syncing
    yesterday's offline daily at 00:05 is on this branch, and *is* the daily
    ritual. That case is inside the ceiling by construction (at most four
    rows), so nothing is lost by it; what would be lost is the record's
    accuracy if this were called an archive-only rule. `CONTEXT.md` carries
    the term under that name.

    **The bound the code actually holds, stated rather than asserted.** A
    `count(*)` read followed by an INSERT is check-then-act: `Promise.all`
    over N requests reads one snapshot of the count in all N, passes the
    same comparison in all N and writes N rows — so a "50 per day" ceiling
    written that way holds only against a strictly sequential client, which
    an attacker is not. The ceiling is therefore folded INTO the insert:
    `INSERT ... SELECT ... WHERE (count subquery) < 50`, one SQL statement,
    rendered byte-identically through the `neon-http` and PGlite dialects —
    **pinned by T-DB-S58**, which compares what the shipped writer renders
    through each dialect's own logger, because production runs `neon-http`
    and every other assertion about this guard runs on PGlite.
    Measured on the test stack, twenty concurrent writes against a ceiling
    of ten wrote **twenty** rows in the two-statement form and **ten** in
    this one (T-DB-S56a). **The honest residual is READ COMMITTED's:** each
    statement takes its own snapshot at its own start, so writes whose
    statements genuinely overlap in time can still overshoot by the number
    in flight. Closing that would need `BEGIN; pg_advisory_xact_lock(user);
    …; COMMIT` — an interactive transaction the union database handle has
    no way to express, because `neon-http` is non-interactive-only and
    PGlite has no batch (the constraint `merge.ts` already records, and the
    same reason it says `pg_advisory_lock` is unavailable there). So the
    bound is: **50 per user per São Paulo day against any sequence of
    writes, plus at most the number of write statements one attacker holds
    in flight simultaneously.** That is a different order of magnitude from
    the unbounded overshoot check-then-act permits, and it is what the code
    enforces — this ADR states no stricter one.

    **A ceiling has to ship because decision 5 deletes the clause that was
    doing this job.** ADR-0026's abuse posture accepted an unthrottled mint
    on three legs — *"the composite PK caps rows at one per (user, game,
    date), **decision 6 caps the date axis at two days**, and each request
    costs one jsonb wall read plus one insert"*. Decision 5 removes the
    middle leg. Verified absent as a substitute: no middleware in either app,
    no firewall rules in either `vercel.json`, no rate-limit dependency
    anywhere, and session minting is unthrottled. Without a ceiling the
    maximum rows per minted identity goes from 8 to four per archived day and
    grows by four a day forever.

    **What the ceiling costs an attacker, on the axis that actually binds.**
    Rows per *identity* is the wrong measure, because identities are free:
    `POST /session` reads no body, needs no proof of work and is one
    unauthenticated request. The binding axis is rows per **request**, and
    there the ceiling moves ≈1.00 to ≈0.98 — one extra `POST /session` per
    50 rows, a **2% tax**. The worst case decision 5 accepts is unchanged in
    kind: an attacker mints more identities. **The ceiling's product is
    observability, not closure**, and the Consequences below say so in the
    same words. It is recorded here because a reader who took the
    identity-axis figure for the whole story would believe this bought two
    orders of magnitude when it bought two percent.

    **Where 50 comes from, named honestly: it is CHOSEN, not measured.**
    There is no traffic to measure, and calling this number measured would
    be the borrowed-figure move [ADR-0023](./0023-proved-not-sampled-property-testing.md)
    `:37-40` reserves that vocabulary against. It is chosen as comfortably
    above the largest plausible human archive session — a player clearing a
    full week of all four games is 28 — and two orders of magnitude below
    what an uncapped multi-year archive would allow one identity. The same
    sentence sizes decision 14, so retention and the write ceiling can never
    disagree about what a plausible session is.

    **429 is deliberate and it composes.** The client's terminal-status set
    does not contain 429, so a capped write stays pending and flushes after
    the next rollover — the correct semantics for a per-day rate cap, and
    the reason a terminal status was rejected. The archive's own screen
    carries a pending state with its own string, because the shipped pending
    copy names connectivity and a rate cap is not connectivity.

    **The cap is its own instrument, and the instrument is a line of code.**
    The first `429 archive-cap` in the logs is the observation decision 5's
    abuse posture previously lacked, and it distinguishes the two cases it
    needs to: a marathon player trips it once, a script trips it on every
    minted identity. That requires a **structured log line the route emits
    itself** — `console.log(JSON.stringify({ event: "archive-cap", userId,
    day }))`, the `cron/publish` idiom — because the
    platform log carries the status and the path and neither the token nor
    the user, so it cannot make that distinction. The line is not
    decoration: it is the compensating control that makes the accepted
    residual above defensible, and removing it un-accepts the risk. The second trigger is
    the first month in which archive completion writes exceed daily
    completion writes by an order of magnitude. **The guess route gets no
    ceiling** — it writes nothing, allocates nothing unbounded, and was
    already unthrottled per request before #31; the date axis was never what
    bounded its request count.

    **ADR-0022's revisit trigger fires here, and it is not the hint grants.**
    That ADR says *"Revisit before public launch, at the first abuse signal,
    or alongside the first real rate-limiting need (ADR-0006 hint grants) —
    whichever comes first."* `ARCHIVE_WRITES_PER_DAY` is this repo's first
    rate limit **on the completion write path**, and the trigger fires on a
    cause its own text did not anticipate. It is **not** the repo's first
    application-level rate limit at all: `POST /attach/request` already
    answers `429 too-many-requests` off `MAX_REQUESTS_PER_HOUR`
    ([ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md)
    decision 11), in the same count-then-act shape — so ADR-0026's Rejected
    entry was already reversed once, by ADR-0050, and this decision reverses
    it a second time on the surface that entry was actually written about.
    Nothing in ADR-0022 becomes false — an accepted posture is a posture,
    and a fired trigger is not a falsification — so it is not amended; the
    response it owes is session-mint throttling, and that is a ticket, not a
    patch. The reversal of ADR-0026's entry is for the **late branch only**:
    the daily branch still ships no rate limit at all.

    **A BINDING OBLIGATION ON THE SECOND PULL REQUEST — the flush loop must
    break on the first 429.** `sync.ts` posts the pending queue serially and
    429 is correctly non-terminal, so a refused record stays queued forever
    until the rollover. Before #31 an out-of-window date got 404, settled
    and left the queue. After it, a player who closes 200 archive boards in
    one day syncs 50 and holds **150 permanently pending**, and every mount,
    `online` and `visibilitychange` re-posts all 150 serially, each paying
    four round trips **and** the ceiling's count before its guaranteed 429 —
    roughly **600 round trips and ~5 GB of buffer traffic per page load**,
    all certain to fail. The cap is per user, so record N+1 fails
    identically to record N: the fix is one `break` on the first 429,
    optionally stamping the refusing São Paulo day and skipping until the
    rollover. It is **not** shipped in the first pull request, because that
    request ships no archive UI and nothing can reach the state; it is
    recorded here and in plan 037 §12/§14 as work the second pull request
    may not skip.

    **Two honest non-invariants, so nobody reads the ceiling as a property
    of the data.** (a) `mergeAccounts` copies completions verbatim,
    `completed_at` included, so merged late rows land already stamped on the
    winner's current São Paulo day and past its ceiling. It concentrates
    rather than creates — totals across the two accounts are unmoved, and
    the confirm route is throttled at 3/hour per email — but *"at most 50
    per São Paulo day"* is a rule the **write path** enforces, not a
    constraint the table satisfies. It also has a legitimate face: a player
    merging two devices after archive sessions on both silently spends the
    winner's budget. (b) The ceiling's branch and its count are two
    spellings of "late" — `isLateDate` in JS, `on_time` negated in SQL — and
    they disagree at exactly one instant per rollover, in the direction of
    one **unchecked** row — unchecked, not uncounted: it escapes the day it
    was written for and is then counted against the *next* day's budget by
    every guarded write on it, which is the conservative direction
    (`isLateDate`'s own doc block states the bound and its consequence).

14. **`prunePlayRecords` gains bounded retention, and that is the price of a
    permanent archive result URL.** The prune keeps the **50 most recent
    settled records dated before the mount's keep-date, ordered by the
    record's date descending with the record key as tiebreak** so the order
    is total and the function stays deterministic, and deletes the rest.
    Everything else is unchanged: a pending record is still never deleted at
    any date, a record that does not address its own key is still dropped
    whatever its date, and an unparseable key is still left alone.

    **Without this, decision 9's load-bearing sentence is false.** The prune
    deletes settled records dated before the mount's date, and it runs on
    **every** play mount. Every archive record is dated before today **by
    construction**, so the moment an archive completion settles and the
    player reaches any daily route, the result is deleted — not "on a later
    day", but on the **next navigation, in the same session**. Browsing the
    archive forward self-destructs the same way.

    **The ordering key is the record's date because it is the only orderable
    field the record has** — the local record schema carries no written-at
    timestamp, and adding one is a versioned-schema decision this ticket has
    no business making. So retention is "the 50 most recently **dated**
    archive results", not "the 50 most recently earned", and the consequence
    is stated rather than hidden: a player already holding 50 settled archive
    records who then solves a date older than all of them loses that result
    on the next prune. Decision 10 layer 3 is what covers that case.

    Fifty comes from decision 13's sentence, not from a second model. The
    function keeps its original purpose — 50 settled past records is still a
    bounded footprint — and it is behaviour-neutral for every daily surface,
    because today's record is never a prune candidate. **Two honest bounds:**
    a pending record is never pruned, so a player past the daily write
    ceiling holds 50 settled records *plus* their pending tail until the next
    rollover flush; and the prune applies per mount date, so browsing
    newest-to-oldest lets records accumulate until the next daily mount
    re-applies the cap over everything. "Bounded" means bounded at the next
    daily mount, and it is self-healing rather than instantaneous.

15. **The write window ships and DEPLOYS before the routes that produce
    archive writes exist. This is a rule, not a preference.** #31 ships as
    two pull requests: the write window and this record first, the archive's
    readers, routes and screens second, branched only after the first is
    merged **and its `apps/api` deployment is Ready**. The gate between them
    is a timestamp in the second PR's body, earlier than its first commit —
    checkable without trusting anyone's account of the ordering.

    **The window this closes is not hypothetical.** The client's terminal
    status set contains **404**, and a terminal sync settles the record
    `rejected` permanently. In any window where the web app has archive
    routes and the API still refuses dates older than yesterday, **every
    archive completion is silently and irreversibly discarded** — and then,
    because the record is settled, the prune is entitled to delete it. The
    two apps deploy from the same push and the web deploy cannot be gated on
    the API's, so the ordering has to be structural rather than promised.

    **And the rule runs backwards too:** a rollback of the write-window PR
    while the archive routes are live reopens exactly that window, so **a
    rollback of the first must be paired with a rollback of the second**.

## Rejected

- **`export const revalidate = 60` on the archive routes, now.** The honest
  alternative to decision 2 and the one this ADR argues against on a trade
  rather than by dismissal: sixty seconds of takedown latency against
  per-request database reads on a crawler-facing surface. Declined while the
  archive has no traffic, and reopenable the moment its precondition — a
  `killed_at` writer that calls `revalidatePath` — exists.
- **A widened-but-finite write window (365 days).** Contradicts *"every
  published past day"* the moment the archive outlives the window, and picks
  a number nothing measures.
- **The archive's floor as the write bound.** It is the months reader's last
  element, so every write would run an extra query to compute a bound the
  wall already enforces.
- **Splitting the write window between the completion and guess routes.**
  ADR-0038 decision 8 hoisted the bound precisely so the two cannot drift,
  and an archived Termo needs both windows to agree or it is unfinishable.
- **No ceiling on the archive write, with Vercel's platform firewall as the
  backstop.** A firewall rule is invisible to the codebase, untestable in the
  suite, and cannot distinguish an archive write from a daily one — so it
  would throttle the ritual to bound the archive.
- **A fourth calendar day state for pre-birth late completions.** A
  strict-parsed wire value-set growth with the deploy-skew failure ADR-0052
  decision 5 names and designs against, plus a legend row, an aria string
  and a CSS treatment, to render days the account did not exist for.
- **Qualifying the Termo fail row to on-time losses.** One conjunct and one
  test would flip it, and would silently un-count losses ADR-0008 rule 3
  promises to count — a behaviour change to a shipped statistic, made in a
  routing ticket, at the exact place ADR-0026 decision 2 forbids a second
  spelling of on-time.
- **A launch or archive-start anchor**, as a constant, a seed or a
  `remote_config` key. ADR-0051 already called this *"#31's decision made
  badly"*; `apps/web` cannot read `remote_config` at all.
- **`/arquivo/<jogo>/<data>`.** Makes the game the collection and the date
  the leaf, forces the index and month pages to fan out four times, and gives
  #34 a share URL whose sibling days are unreachable by walking the path.
- **404 on today's date.** Leaves the one window where sharing actually
  happens without a permalink; a 308 instead of a 307 would cache a rule
  whose truth value changes at midnight.
- **An archive conclusion route for symmetry with the daily.** It buys zero
  visual-gate coverage — the gate only ever reaches the empty branch — and
  adds one more date-bearing URL to the problem decision 12 solves.
- **A per-day per-user read endpoint for "you solved this one".**
  Speculative surface with one consumer and a per-request cost on a
  crawler-facing route; ADR-0031 decision 2 makes its absence harmless.
- **Excluding Termo from the archive**, inheriting free play's rule without
  its reason. It would make three of four games archivable and leave a hole
  in every day row, to protect content that was already spent.
- **A `(date)` btree on `daily_puzzles`.** Serves neither list reader's
  predicate, gains the months reader nothing, and would be the repo's first
  index-only migration — hand-applied to a database preview shares with
  production, on the critical path of a two-PR ticket.
- **A hardcoded date, or a shell-computed one, in the visual gate's URL
  list.** The first drifts into a permanent 404; the second puts a client
  clock in charge of what the São Paulo publication wall published.
- **Reusing `ConclusionView` on the archive.** Four internal date gates
  inside a component this ticket does not touch, or a third optional prop
  ADR-0043 consequence (a) closes the budget against.
- **Pagination as query parameters or infinite scroll.** Month pages and day
  pages *are* the pagination, and each is bounded by construction — a month
  is a month.

## Consequences

- **The archive's semantics are now enforced in three different layers, and
  each is named.** Lateness is derived in SQL from `completed_at` against the
  puzzle's own day, so an archive write needs no writer, no column and no
  flag — the only reason no late row exists today is that the route refuses
  the date. Which days are readable is the wall's SQL. Which days are
  writable is one route predicate. Nothing in the client decides any of the
  three.
- **`packages/db`'s surface grows by five and its export tripwires move with
  it**, in the same commit as each export, because pre-commit runs the full
  suite at every commit. The relational-query pin on the root client does not
  move: adding a function cannot change it.
- **No schema change, no column, no constraint, no index and no migration.**
  The schema file and the migrations directory come out of this ticket
  byte-identical, which is a `git diff` criterion rather than a claim.
- **A future content-shape change owes compatibility with every row ever
  published** (the ADR-0024 amendment). What stays open is *discovering* a
  stale row: the reader's log line is the only alarm and nothing pages on it.
- **Ten volume medals become self-mintable**, and #34 is where a self-minted
  volume medal first becomes socially visible. That is a change to #34's
  threat model caused by #31, recorded here rather than discovered there.
- **The FIRST pull request alone changes what already-installed clients
  write, and it does so before any archive page exists.** `sync.ts` posts
  the whole pending queue with no date filter and `play-record.ts` never
  prunes a pending record. On `main` today, a record two or more days old
  gets 404, is terminal, and is discarded. The moment the write window's
  lower bound goes, that same record is **accepted and written as a late
  completion** — so the first production flush from any device that has
  been offline more than a day retroactively writes real late rows, moving
  `solved`, the ten volume medals and the calendar's `late` cells. It is
  arguably a fix (the player did solve those boards, and none of it reaches
  the streak or any time statistic), and it is recorded here because the
  two-PR split is justified by *"no player can reach a page that would
  produce an archive write"* — which is true of the archive and not of the
  queue. There is no dormant seam to hide behind: this is a live-path
  behaviour change shipped by PR 1.
- **`/privacidade` describes the archive one pull request early.** The page's
  own contract is that it states exactly what the release ships, and the
  clause added here names archive completions while PR 1 ships no archive
  URL. The disclosure is LGPD-accurate and over-broad rather than wrong — no
  new data category, the ceiling's guard reads only the caller's own rows,
  deletion still cascades — and it lands in PR 1 because splitting one
  sentence across two PRs is worse than being early. If PR 2 slips, the page
  is early for that long, and that is the accepted cost. Its *"ficam de fora
  da sequência"* is true but partial: late rows do count in `solved` and in
  the volume medals, which `CONTEXT.md`'s **Late completion** row states.
- **Write amplification is this ticket's largest open number.** Decision 13
  caps a user at 50 late writes per São Paulo day, but minting is still
  unthrottled, so the axis is minted-identities × 50. The cap makes the axis
  **observable**, not closed; ADR-0022's fired trigger (decision 13) is where
  the response is owed.
- **`prunePlayRecords`' retention changes a shared behaviour for one caller's
  benefit** (decision 14). The localStorage ceiling it implies is published as
  a measured figure in the PR — 50 × the largest serialized record — and if
  that number lands near a browser's per-origin quota, the retention number
  moves and the deviation is recorded.
- **#34 inherits three things from this ticket**: a stable per-day-per-game
  URL, a per-day URL that resolves for today too, and the same wall readers
  as the single public read path for its OG images. It inherits no dormant
  surface — no image route, no share text, no card ships here.
- **#37 inherits** p95 instrumentation for decision 2's caching trigger (the
  Neon console figure is the stand-in until then) and the sitemap-index
  trigger's ongoing observation.
- **#58 is unaffected in kind and larger in volume**: a stale pending record
  that would have 404'd now lands as a late row, which is more honest and a
  bigger set of cases its decision argues about.
- **The archive is the repo's first site-wide crawl posture.** A `robots.ts`
  ships allowing everything except the attach route, and the sitemap lists
  the archive and free play but not the daily play routes, which ADR-0028
  already states outright are not an SEO surface. Absence from a sitemap is
  not `noindex`, and that is stated rather than implied.
- **`ACCEPTED_DAYS_BACK` survives in `docs/` only as history — original ADR
  sentences that now carry an amendment annotation, plus point-in-time plans
  and handoffs — never as a live prescription**, and nowhere at all in
  `apps/` or `packages/`. The distinction matters because the identifier
  still appears in the ADRs' own body text (ADR-0026, ADR-0038, ADR-0039,
  ADR-0051), quoted by the annotations rather than deleted: this repo never
  rewrites an amended sentence, it annotates it.
- **"Write window" and "rollover slack" enter CONTEXT.md as durable terms**,
  because splitting one name into two ideas is a ubiquitous-language act:
  without both rows the next ticket is free to call one of them "the accepted
  window" and re-join what decision 6 separated. The **Archive**, **Stats
  calendar** and **Late completion** rows are corrected in the same commit.
