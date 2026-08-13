# Implementation plan — Issue #29: M3: Stats, calendar, and Dia Perfeito

**Issue:** [#29](https://github.com/fernandolisboa/miolos/issues/29) — M3's opening ticket. Unblocked (#27 closed); blocks #30 (medals) and #37 (launch hardening). Read the issue **including Fernando's comment** — its two handed-over obligations (the hub's `em 4/6` tile; the fail row's column) are binding, as is its sentence *"Do not add `guesses` to `DayEntry`"* and *"The proof that a played row is excluded from Dia Perfeito belongs to this issue's AC 1."*
**Governing ADRs:** [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md) (the three verbs; every exclusion rule), [ADR-0009](../adr/0009-account-merge-recomputes-from-the-union-of-completions.md) (completions are the source of truth; everything else derived), [ADR-0026](../adr/0026-completions-are-write-once-rows-on-time-is-derived.md) (on-time is derived in one place; a stored column is rejected; decision 6's `ACCEPTED_DAYS_BACK` bounds this plan's calendar clamp), [ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md) (the template: pure core function + authenticated read + client island; strict contracts closed to growth; the conclusion's `syncOutcome === "recorded"` gate), [ADR-0049](../adr/0049-account-merge-one-pure-function-one-idempotent-operation.md) decision 6 (stats are pure derivations with zero merge-specific code), [ADR-0031](../adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) (device state derives nothing; server facts stay in `apps/api`), [ADR-0014](../adr/0014-apps-web-reads-the-database-directly-for-public-pages.md) (stats go through `apps/api`), [ADR-0044](../adr/0044-a-lost-termo-is-played-not-pending.md)/[ADR-0045](../adr/0045-the-termo-screen-ships-no-hint-and-no-clock.md) (Termo's statistic is the distribution, never a duration), [ADR-0013](../adr/0013-canonical-domain-and-pt-br-routes.md), [ADR-0018](../adr/0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0036](../adr/0036-aligning-numerals-use-instrument-sans-not-fraunces.md), [ADR-0041](../adr/0041-accents-colour-shapes-never-words.md), [ADR-0047](../adr/0047-bundle-markers-are-route-scoped.md), [ADR-0023](../adr/0023-proved-not-sampled-property-testing.md) (vocabulary rule enforced repo-wide), [ADR-0010](../adr/0010-publication-is-time-driven-published-at-plus-buffer.md) (cited for the calendar-range argument; not amended).
**Proposed ADR:** ADR-0051 (§10) — it **amends nothing** (argued in D12).
**Branch:** `feat/29-stats-calendar-dia-perfeito`. Conventional Commits. Pre-commit never bypassed.
**Snapshot:** written against `main` at `e11fd56`. Point-in-time; where a later ADR disagrees, the ADR wins. **Revised at step 4** against plan reviews A and B (see §13's preamble).

The hard parts of this ticket are not the arithmetic — they are (a) an honest "missed" for a calendar when a missed day is an *absence* with no data source (D2), (b) serving three different consumers (stats screen, conclusion, hub tile) on contracts that are closed to growth the moment they ship (D4), and (c) landing client JS on the hub and on every conclusion without silently busting route budgets whose slack is measured in single kilobytes (§7). D2, D4 and the §7 budget procedure carry those three respectively.

---

## 1. Scope & non-goals

**In scope**

- `packages/core`: `src/date.ts` (the `epochDay` hoist + its guarded inverse), `src/stats.ts` (Dia Perfeito, calendar, distribution, times, totals — all pure), `src/contracts/stats.ts` (two strict contracts), barrel exports, seam-2 unit + property tests.
- `packages/db`: one new module `src/stats.ts` with two readers (`listCompletionsForStats`, `getUserSince`), exported via `@miolos/db/user`, **both** export tripwires widened in the same commit — the `user.test.ts` per-module pin *and* `published.test.ts`'s cross-entry T-DB-S5 (§7, §8). **No migration. No schema change.**
- `apps/api`: `GET /stats` and `GET /stats/calendar`, both the `GET /streak` authenticated-READ template verbatim, seam-4 tested over PGlite.
- `apps/web`: the `/estatisticas` screen (per-game stat blocks + Dias Perfeitos + the calendar), the conclusion's deliberately-absent stat block filled (stat rows, 6-bucket histogram, closing italic line, Termo distribution variant — mount-gated on `syncOutcome === "recorded"`, D13), the hub Termo tile's `em 4/6` (`TermoDoneLink`, D5), live hrefs for the two dead "Estatísticas" links, stats client/hooks, i18n keys, free-play wall bans + probes, `route-ssr` row, `impeccable.yml` lists, `ink-on-accent.test.ts` sheet lists, `route-client-js.mjs` classification and measured bundle figures.
- Docs: this plan (033), ADR-0051, `docs/README.md` rows for both in the same PR, CONTEXT.md rows, `docs/agents/test-ids.md` frontier re-derived at step 8.

**Non-goals — explicitly out**

- **No `completions` schema change of any kind.** §5 of the exploration and `schema.ts:246-252`'s own prediction hold: every fact the ACs need is stored or derivable today. `onTimeSql()` (`packages/db/src/completions.ts:48-50`) remains the **single producer** of on-time; this plan adds projections of that one expression and never a second spelling. T-DB-S24 stays green untouched. Migration `0005` is not consumed.
- **No #58.** A stored on-time column, the per-user-per-day "seen" table, the multi-date sync guard, and the ADR-0026/ADR-0009 amendments are #58's own plan (Fernando's scoping, handoff 032 line 72). Nothing here exposes `onTime` on a wire contract or pre-empts "#58 changes the producer and nothing downstream."
- **No medals (#30).** No medal table, rule, definition or rendering. What #29 owes #30 is structural only: a row type rich enough to be the shared input (D10) and a screen with a place to grow (D10) — zero shipped-unused code.
- **No #31.** No `/arquivo` route, no published-dates enumeration, no late-completion *writer* (late rows can only be manufactured in tests today). The calendar renders late rows honestly when #31 starts producing them; the calendar-range clamp (D6) names exactly what #31 must revisit when it widens `ACCEPTED_DAYS_BACK`.
- No stored aggregates, counters or caches of any kind (ADR-0009/ADR-0049 D6): a merge must need zero stats-specific code, and it does — both endpoints recompute from rows on every read.
- No share button (#34), no `?date=` parameters, no windowed/paginated reads (plan 027 §16 risk 6's measured trigger stands, restated in D3; the calendar *payload* gets its own trigger in D4).

**Not touched at all:** `packages/db/src/schema.ts` (comments included — nothing there is wrong), `packages/db/migrations/`, `packages/db/src/merge.ts`, `packages/games`, `packages/ui/tokens.css`, `apps/api/app/{completions,session,daily,termo,cron,buffer-depth,health,attach,account}` routes, `apps/web/src/play/day-state.ts` (**`DayEntry` gains nothing**), `apps/web/src/free-play/**`, `apps/web/app/modo-livre/**`, every existing contract file. A diff in any of these at step 6 is a finding by itself. `packages/core/src/streak.ts` is touched **only** by D9's import swap; `apps/web/app/hub-day-state.tsx` only by the Termo-tile composition (§6.3); `apps/web/src/play/conclusion-view.tsx` only by the stat block (§6.4).

---

## 2. Decisions register

Each decision answers one or more of the step-1 exploration's thirteen open questions (Q1…Q13). All are settled here so step 5 implements rather than re-litigates; D2, D5, D6 and the pt-BR copy are product-visible and Fernando can override any of them in the PR without blocking.

### D1 — No schema change (Q1)

**Decision: `completions` gains nothing; there is no migration.** §5 fact 4 of the exploration is the argument in full: on-time is derivable (`onTimeSql()`), the distribution is stored (`guesses`, write-only today), times are stored (`elapsed_ms`), totals are counts, and "missed" is an absence (D2). `schema.ts:251` predicted exactly this ("#29's statistics projection is expected to need no schema change either"). The alternative would red T-DB-S24, force migration 0005 under the preview-shares-prod-DB push ordering, and consume ADR amendments Fernando scoped to #58. Consequence stated for reviewers: **`onTimeSql()` stays the single producer of on-time**; this plan's one new projector (D3) imports it, and the comment at `completions.ts:41-46` ("the two readers here plus `listCompletionsForMerge`") is updated to count it.

### D2 — Calendar range and "missed" (Q2): anchored at the account's own first SP day; missed = absence; no published-dates reader

Three candidates were weighed (§9 finding 4): (a) range from the user's first completion, (b) a launch/archive-start anchor, (c) a published-dates reader behind the ADR-0004 wall.

**Decision: the calendar runs from `since` = the SP calendar day of the user's `users.created_at`, through the DB clock's SP today, extended backward by at most `ACCEPTED_DAYS_BACK` days when a completion row legitimately predates `since` (the birth-midnight edge — the exact clamp is D6's).** "Missed" is the absence of any won row on an in-range day.

Why each alternative loses:

- (a) *first completion* fabricates missed days once #31 exists: a late completion of an old date drags the range start backward, painting "missed" over days before the user existed. The account-creation anchor with D6's **bounded** backward extension is immune — the range only ever covers days the account was alive for, plus at most the `ACCEPTED_DAYS_BACK` days a write could legitimately predate account birth.
- (b) *a launch anchor* exists as a concept (ADR-0010: "the archive starts at the first date the production cron actually published") but as **no stored value, constant or config anywhere**; inventing one here would be #31's decision made badly, without #31's needs on the table.
- (c) *a published-dates reader* drags `published.ts`'s "may never be weakened" wall suite and its export tripwires into a ticket that doesn't need them — and buys honesty #29 can't use: whether a specific day's daily was published is indistinguishable from "missed" at day granularity, and a publication gap is a production incident, not a user state. Decisive consistency argument: **`computeStreak` already treats absence as streak-breaking without consulting publication** — a calendar stricter than the streak would be two honesty standards for one absence.

Honesty audit: no "missed" before the user existed (anchor is account birth, extension bounded to the one day a write can legitimately predate it); no "missed" before content existed (an account is minted by visiting the live product, so `created_at` postdates first publication by construction); cheap (one one-row read, D3); #31 uncornered — the clamp's `#31 must revisit` note is written into ADR-0051 (D6). Recorded as ADR-0051 decision 2. `since` is anonymous-account birth (ADR-0003: every visitor is a durable row), so an account that lurked before playing shows those days as missed — accepted and honest: the dailies were there, the account existed. After a merge the winner is the older account (ADR-0049 D3), so `since` only widens.

### D3 — One unfiltered reader + core derivations; no SQL aggregation (Q3)

**Decision: ADR-0048's precedent extends unchanged.** One new reader, `listCompletionsForStats(db, userId)` (§3.1), projects every row of the user — unfiltered, no `where outcome`, no `where on_time` — with all seven row facts, and **every exclusion lives in `packages/core` where the seam tests it** (AC 1's "pure function in `packages/core`, tested at seam 2"). SQL-filtering would create second definitions of the exclusions and leave the core function's rules untestable at the seam — the exact rejection ADR-0048 recorded for the streak. The unbounded per-user read is accepted on the same argument as `listCompletionsForStreak` (`completions.ts:85-98`): the composite PK bounds rows at ≤ 4/day, `completions_user_date_idx` was built for this read, and a windowed read is a later optimisation with a measured trigger (plan 027 §16 risk 6), never a semantic change. `getUserSince` (§3.1) is the second reader: one row, one value.

### D4 — Two endpoints: `GET /stats` and `GET /stats/calendar`; both contracts closed; the hub reads `/stats` (Q4, Q5)

`GET /streak` cannot grow (ADR-0048 D3), so #29's data arrives on new endpoints. **One** endpoint carrying everything was rejected because the consumers have different weights: the hub (every visit) and the conclusion (after every game) need a small bounded payload, while the calendar is unbounded-growing (one entry per account-day, forever) and has exactly one consumer (the stats screen). Since a strict contract can never be split later, the split happens now:

- **`GET /stats`** — bounded aggregates: per-game blocks, Dias Perfeitos count, and `todayTermoGuesses`. Three real consumers: the stats screen, the conclusion stat block, the hub's Termo tile.
- **`GET /stats/calendar`** — the day-by-day enumeration with per-day state and the Dia Perfeito marker. One real consumer: the stats screen.

Every field has a named call site (§3.3) — no speculative surface. **The calendar payload's revisit trigger, stated now so #37 inherits a number rather than a shrug:** when the enumeration exceeds **1,100 days (~3 years of account life)** or the response body exceeds **64 KB** — whichever comes first — the endpoint gets windowing (`?from=`/`?to=` on a *new* contract, per ADR-0048 D3), and not before; at ~30 bytes/day the day bound is reached first and is the one to watch (recorded as part of ADR-0051 decision 3). **#30's medals get their own endpoint and contract when they land** (ADR-0048 D3 makes that the only legal shape, and it is the right one: medal payloads share nothing with these aggregates). Both contracts are `z.strictObject`, parsed on both ends, `Cache-Control: no-store`, the streak-route header conventions (§5). Recorded as ADR-0051 decision 3.

### D5 — The hub's `em 4/6` (Q5): `TermoDoneLink`, a client component owning the whole done anchor for a completed Termo; `DayEntry` untouched

**Decision:** `apps/web/app/hub-day-state.tsx` gains `TermoDoneLink`, a component that **owns the entire done anchor** — the `<Link className={styles.done}>`, its `aria-label`, the `Feito` chip and the two-viewport result spans — and that `HubCardAction`'s completed branch returns **instead of** the generic done link exactly when `game === "termo" && entry.status === "completed"`. This is the repo's gate idiom ("consumers that need a gate mount the consuming component conditionally", `use-streak.ts`): the hook lives inside the conditionally-mounted component, so it takes no options, hooks are never conditional, and at most one fetch fires per hub view. The shape is dictated by the shipped markup (`hub-day-state.tsx:96-135`): the accessible name is the **anchor's** `aria-label` and the result spans are `aria-hidden`, so a child span component could never feed the parent's label — the component that fetches must be the component that renders the anchor.

`TermoDoneLink` calls `useStats()` (§6.1) and renders:

- **Unsettled, settled-`null`, or `stats.date !== date` (the tile's server-resolved day):** the anchor with `aria-label={messages.hoje.completedAria(name)}` — byte-for-byte today's shipped won-Termo tile, so **T-WEB-S80** (`hoje.smoke.test.tsx:384-404`, which finds the tile by `getByLabelText(completedAria(...))`) stays green with no edit. While unsettled it additionally holds the result line box open with the `BLANK_VALUE` non-breaking-space idiom (`conclusion-view.tsx:35`) so the value landing shifts nothing (#37's CLS≈0); on settled-`null` or date mismatch it collapses to the chip-only form (today's shipped honest state — the DB clock and the web server's SP day can disagree across midnight).
- **Value landed and dates match:** `aria-label={messages.hoje.doneGuessesAria(name, n)}` and the two `aria-hidden` result spans via `messages.hoje.doneResultLong(\`${n}/6\`)` / `doneResultShort(\`${n}/6\`)` — exactly the composition Fernando's comment prescribes.

A **played** (lost) Termo stays in the generic `HubCardAction` path (`playedAria`, no fetch); the three grid games' tiles are **byte-identical to before**. `DayEntry` gains **nothing**; device state still derives nothing (ADR-0031 D1). `completedAria` **stays** — it is the unsettled/null/mismatch name, so #29 does not retire it; the `messages.ts` comment saying #29 "may retire the string" is updated to say why it survives.

### D6 — Calendar day semantics (Q8): per-date precedence on-time > late > missed; lost rows never colour a day; the clamped range edge

ADR-0008 rule 2's calendar language is per-DATE ("shows the date as solved with a visually distinct 'solved later' state"), and its consequence names "three visual states per date". **Decision — for each date `d` in `[effectiveSince, today]`:**

- `"onTime"` iff ∃ row with `date === d && outcome === "won" && onTime === true`;
- else `"late"` iff ∃ row with `date === d && outcome === "won" && onTime === false`;
- else `"missed"`.
- `perfect: true` iff `d ∈ perfectDays(rows)` (D7) — only ever possible on an `"onTime"` day.
- **Lost rows never colour a day**: a day whose only row is a lost Termo renders `"missed"` — played is not completed (ADR-0008's three verbs); the loss is visible in the fail row (§4.3), not on the calendar.
- **The clamped range start:** `effectiveSince = max( min(epochDay(since), min over rows of epochDay(row.date)), epochDay(since) − acceptedDaysBack )`. The backward extension exists because a completion may legitimately be dated before account creation — `ACCEPTED_DAYS_BACK = 1` lets a 00:30 account complete yesterday's puzzle — and a real completion of that kind must appear on the calendar. But the extension is **bounded by exactly the days a write can legitimately predate account birth**, so it can never fabricate `"missed"` over days before the user existed: with today's bound of 1, the extension is at most one day and there is no intervening day to mis-paint. An **unbounded** `min()` was rejected at step 3 (review A finding 1): the moment #31 widens `ACCEPTED_DAYS_BACK`, one archive completion of an old date would have dragged the range back arbitrarily far, painting `"missed"` over every intervening pre-birth day — the exact failure D2 rejects candidate (a) for.
- **The bound is a core parameter, not a core constant.** `ACCEPTED_DAYS_BACK` lives at `apps/api/src/publishing/dates.ts:34` — deliberately in the route layer, where ADR-0026 decision 6 requires the write-side bound to live — and core cannot import from an app. So `computeCalendar(rows, since, today, acceptedDaysBack)` takes the bound as its fourth argument and the route passes the imported constant. One constant, one owner, no second spelling — the honest resolution of the dependency.
- **Rows dated before `effectiveSince` are out of calendar range**: they emit no day entry, and the calendar's month grid simply does not extend to them — but they still count in **every** `computeStats` aggregate (distribution, times, totals, `perfectDays`), because the aggregates are whole-history views and the calendar is the account's *life* view. Nothing is hidden, only not painted on a range the account was not alive for. Today this branch is unreachable in production (no writer can produce such a row); it is pinned at seam 2 with manufactured rows (T-CORE-S63).
- **What #31 must revisit (recorded in ADR-0051 decision 2):** when #31 widens `ACCEPTED_DAYS_BACK`, archive completions may be dated arbitrarily far before account birth. #31 must then decide how the calendar shows a pre-birth late completion — widen the range with an honest fourth treatment for pre-birth days (not `"missed"`), or keep them off the calendar and let the aggregates carry them. That is #31's product decision, on #31's table; this plan's clamp guarantees the *default* behaviour until then is never-fabricate-missed.
- Rows dated after `today` (rendered impossible by ADR-0026 decision 6) are inert, the `computeStreak` posture.

Per-game day rendering was rejected: it quadruples the calendar's visual vocabulary against a design system with no reference frame for it, and ADR-0008 already committed to per-date states. Recorded as ADR-0051 decision 2.

### D7 — Dia Perfeito: the exact rule, and never a second streak (part of Q3)

**Decision:** `perfectDays(rows)` in `packages/core/src/stats.ts`: a date `d` is perfect iff **all four games have a row dated `d` with `outcome === "won" && onTime === true`** — which, under the composite PK (≤ 1 row per user-game-date), is exactly AC 1's "exactly four on-time completions of the same day". A lost Termo forfeits it structurally (the lost row occupies Termo's only slot); a late win never counts (`onTime === false`); a played row never counts (`outcome === "lost"`) — the #27-comment obligation, discharged at seam 2 (T-CORE-S60/S61). **Never a second streak:** the function returns a set of dates; no run length, no consecutive-day arithmetic, no "current perfect streak" exists anywhere in code or contract. It surfaces as the calendar's per-day `perfect` marker and one count (`perfectDays`) on `/stats`.

### D8 — Termo's time story (Q7): times are a three-game statistic, full stop

**Decision, stated so no reviewer reads AC 3 otherwise:** "solve times (best/average)" applies to **binairo, sudoku and nonogram only**. Termo's statistic is the guess distribution with its fail row; Termo's `elapsedMs` is recorded and **never rendered anywhere** (ADR-0045 decision 4's own words: "no Termo statistic will ever reflect it, and #29 puts `em 4/6` there instead"). The contract encodes this structurally: the three timed games share `timedGameStatsSchema`; `termo` gets `termoStatsSchema` with **no time field to misuse** (§3.3). Numbers follow F5's frame: best is all-time; the average is a **30-day-window** average (rows dated within the last 30 SP days — the frame's own `Sua média (30 dias)` label, and a recency-honest number); both over on-time wins only. The three stat rows deliberately answer three different questions over three different populations — see §4.4 and ADR-0051 decision 6.

### D9 — Day arithmetic (Q9): hoist `epochDay` into `packages/core/src/date.ts`, with its guarded inverse; `apps/api`'s helpers untouched

Plan 027 declined this hoist because #19 had no need; the calendar **is** the need — `computeCalendar` must enumerate consecutive days and turn epoch days back into ISO strings. **Decision:** new module `packages/core/src/date.ts` exporting `epochDay(date: string): number` (moved verbatim from `streak.ts:47-64`, both `RangeError` guards and the year-1000 comment intact) and `dateFromEpochDay(day: number): string` (the inverse). The inverse is the test-side helper `streak-properties.test.ts:18-21` already uses (`new Date(day * 86_400_000).toISOString().slice(0, 10)`), **productionised with exact guards** because the test-side copy only ever ran over a bounded arbitrary: it throws `RangeError` unless `Number.isInteger(day)` and `MIN_EPOCH_DAY <= day <= MAX_EPOCH_DAY`, where the module defines `const MIN_EPOCH_DAY = epochDay("1000-01-01")` and `const MAX_EPOCH_DAY = epochDay("9999-12-31")` — the exact mirror of `epochDay`'s own year-1000 floor (below it the naive formula emits `"0999-…"`, which `epochDay` rejects, breaking the round trip) and a 9999 ceiling (above it `toISOString` emits expanded-year forms like `"+010000-…"` whose `slice(0, 10)` is garbage). The two constants are exported for the property test's domain (T-CORE-S68). `streak.ts` deletes its private copy and imports from `./date` — the **only** edit to that file; its exported behaviour is bitwise unchanged and no streak test is touched. `apps/api/src/publishing/dates.ts` (`addDays`, `isoWeekdayOf`, `ACCEPTED_DAYS_BACK`) is **not** consolidated — that would be blast radius without need, the exact reasoning plan 027 recorded, now applied in the other direction (and `ACCEPTED_DAYS_BACK` must stay in the route layer per ADR-0026 decision 6 — D6 passes it as a parameter instead). Real call sites for the exports: `stats.ts` (enumeration, the 30-day window), the web calendar's month-grid helper (§6.2), and tests. Recorded as ADR-0051 decision 5.

### D10 — What #29 leaves for #30 (Q11)

- **The row type is the shared input:** `StatsRow` (§3.2) carries `{game, date, outcome, onTime, elapsedMs, hintsUsed, guesses}` — rich enough that #30's rule-derived medals recompute over the same reader with no second reader (ADR-0049 D6 names them together). `hintsUsed` is projected for exactly this reason and is displayed by nothing in #29; a code comment on the field restates ADR-0027/ADR-0031 D6: self-reported, may drive a display, **may never back a medal or entitlement** — the constraint travels with the type so #30 inherits it in writing.
- **The screen leaves a place:** the stats screen's section order is summary → per-game blocks → calendar (§6.2), with a comment in `page.tsx` naming where #30's medal section slots (between summary and per-game blocks, per its "medals display in the stats area"). **Nothing empty is rendered** — a placeholder section would be fake UI.
- **The wire leaves nothing:** medals arrive on their own endpoint/contract (D4) — that is ADR-0048 D3 working as designed, not a gap.

### D11 — Route surfaces (Q10)

`/estatisticas`, index only — no per-game sub-paths (one screen, sectioned; sub-routes would be navigation without content). Additions, all in this PR:

1. `routes.stats = \`/${routeSlugs.stats}\`` in `apps/web/src/i18n/routes.ts` (slug already reserved at line 13).
2. `route-ssr.test.tsx` `ROUTES` row: `{ path: "/estatisticas", marker: "data-page=", load: () => import("../app/estatisticas/page"), daily: undefined }` (the `/privacidade` shape — the page reads no wall).
3. `.github/workflows/impeccable.yml`: `/estatisticas` added to the preflight path list (line **76**), to the marker `case` (`"/estatisticas") marker='data-page=' ;;` beside the `"/privacidade"|"/vincular"` arm at line **87** — or folded into that arm), and to **both** detect URL lists (desktop ends at ~line **167**, mobile at ~line **193**).
4. `route-client-js.mjs`: daily scope by default (not under `/modo-livre` — nothing to classify), and `/estatisticas` **added to `BUDGETED`** under the shared 40 KB default (unlike `/privacidade`, this route ships real client JS and must be watched).
5. The two dead links go live: the hub nav's `<a>` becomes `<Link href={routes.stats}>` (`page.tsx:126-137`, comment updated — `arquivo` stays href-less for #31), and the conclusion's "Ver estatísticas" gains the same href plus the waiting `cursor: pointer` rule (`conclusion-view.module.css:756`'s #29 marker). On the hub, `.secondaryLink` is a **shared** class over four links and `arquivo` stays href-less, so its own waiting comment (`page.module.css:274-276`) is discharged with a **scoped** rule — `.secondaryLink[href] { cursor: pointer; }` — never a bare uncomment that would put a pointer cursor on the still-inert `arquivo` anchor (§7).

Sequencing note (review B finding 4): Next 16 typed routes make `<Link href={routes.stats}>` a type error until `app/estatisticas/page.tsx` exists in the route tree (`next-env.d.ts` → `.next/types/routes.d.ts` literal union), and pre-commit runs `pnpm typecheck` — so the **page shell ships in the same commit as `routes.stats` and the links** (§11 commit 4); only the island content follows in commit 5.

### D12 — One ADR, 0051; it amends nothing (Q12)

**Decision:** ADR-0051 — working title `0051-statistics-are-read-time-derivations-on-closed-contracts.md` — carries the decisions of weight as one design: (1) stats/calendar/Dia Perfeito are pure derivations over one unfiltered reader, recomputed on every read, no stored aggregate, no schema change (the #58 boundary restated); (2) the calendar's account-birth anchor, missed-by-absence, per-date precedence, the lost-row rule, the **clamped** range edge with its route-supplied `acceptedDaysBack` bound, and the named #31 revisit (D2/D6); (3) the two-endpoint contract split, its no-growth posture, and the calendar payload's revisit trigger (D4); (4) times are three-game, Termo's statistic is the distribution (D8 — this **agrees with** ADR-0045 D4, executing it, so no amendment); (5) the `epochDay` hoist with the guarded inverse (D9 — plan 027's refusal was a plan note, not an ADR decision, so nothing is amended); (6) the three stat rows' populations — best = all-time on-time wins, average = 30-day on-time wins, solved = all wins **including late** — with the label obligation that carries the distinction into the UI (§4.4).

The fail row follows **ADR-0008 rule 3 exactly as written** — every lost Termo row, unqualified (§4.3) — so no ADR-0008 sentence and no CONTEXT.md row becomes false. Amendment audit: ADR-0048 is followed (new endpoints are its own D3's instruction; the conclusion gate is its own decision 4, obeyed in D13); ADR-0026/0009's reserved #58 amendments untouched; ADR-0026 decision 6 is *consumed* (the bound is passed, not moved) not amended; ADR-0031/0044/0045 executed. **No `Amends:` header, no reciprocal lines anywhere.** ADR-0051 and this plan each get a `docs/README.md` "Current" row in the same PR (Q13; the napkin's four-PR blocking-finding streak).

### D13 — The conclusion stat block ships in #29 (Q6), mount-gated exactly like the streak card

**Decision: yes, in full** — best/average/solved rows, the 6-bucket histogram, and the closing italic line for the three timed games; the distribution (with fail row) for Termo. The absences at `conclusion-view.tsx:66-73` are explicitly filed against #29, F5/F6 is the only high-fidelity stats reference in the repo, and deferring would leave #29's "stats screens" shipping while the one designed stat surface stays empty.

**The mount gate:** `ConclusionStats` is mounted by the caller only when **`syncOutcome === "recorded"`** — the identical gate, on the identical line-neighbourhood, as the shipped `{syncOutcome === "recorded" && <StreakCard />}` (`conclusion-view.tsx:357`, ADR-0048 decision 4). The reason is the same one the comment at `:350-356` states for the streak: the gate only opens after the server holds the day, so the fetched aggregates **include the game the screen is decorating by construction**. Without it, an offline/pending/rejected conclusion would render `solved`/`averageMs`/histogram values that exclude the game just finished while highlighting its bucket — the screen simultaneously asserting and denying today's play, the exact fake-data dishonesty the absence comment at `:66-77` was written to avoid. Unsettled/offline/rejected states render the shipped absence, which is honest. The closing line's blocker ("it compares against an average that does not exist") dissolves the moment `/stats` exists; its own gate and semantics are §6.4's. Scope honesty: the **share button stays absent (#34)**; the conclusion changes are exactly the stat block and the "Ver estatísticas" href (D11). Rules in §6.4.

---

## 3. Data & contract design

### 3.1 `packages/db` — one new module, `src/stats.ts`

Two readers, exported via `@miolos/db/user` (user-scoped reads, ADR-0026 decision 5); the `user.ts` barrel and **both** export tripwires — `user.test.ts`'s per-module pin and `published.test.ts`'s cross-entry T-DB-S5 (array + `toHaveLength(30)` → 32) — widen in the same commit. `onTimeSql` is imported from `./completions` — the single producer (D1); the `completions.ts:41-46` reader-count comment updates to name this module.

```ts
import type { StatsRow } from "@miolos/core";

/** Every completion row of one user, shaped for the #29/#30 derivations
 *  (ADR-0049 decision 6). Deliberately UNFILTERED — the pure functions in
 *  packages/core are the only place lost and late rows are excluded (D3). */
export async function listCompletionsForStats(
  db: Db,
  userId: string,
): Promise<StatsRow[]>
// .select({ game, date, outcome, onTime: onTimeSql(), elapsedMs, hintsUsed, guesses })
//  .from(completions).where(eq(completions.userId, userId))
//  .orderBy(desc(completions.date));

/** The SP calendar day the account was born on (D2's anchor).
 *  `undefined` only if the user row vanished mid-request (deletion race)
 *  — callers throw, landing in the route's catch-all 500. */
export async function getUserSince(
  db: Db,
  userId: string,
): Promise<string | undefined>
// sql<string>`(${users.createdAt} at time zone ${SAO_PAULO_TIME_ZONE})::date`
```

Notes: `SAO_PAULO_TIME_ZONE` comes from `./published` (the `completions.ts` precedent). The `createdAt`-to-SP-date expression is a **new fact's** derivation, not a second spelling of on-time — stated in the module header so a reviewer doesn't misread ADR-0026 decision 2. No JS `Date` appears in any statement (the file-header law of `completions.ts` applies). `CompletionRecord`, `getCompletion`, `completionResponseSchema` are untouched — T-DB-S11's `guesses` omission stays pinned exactly as shipped.

### 3.2 `packages/core` — row type and function signatures

`packages/core/src/date.ts` (D9): `epochDay`, `dateFromEpochDay`, `MIN_EPOCH_DAY`, `MAX_EPOCH_DAY` — all exported from the index barrel. `dateFromEpochDay` throws `RangeError` on a non-integer or a day outside `[MIN_EPOCH_DAY, MAX_EPOCH_DAY]` (= `epochDay("1000-01-01")` … `epochDay("9999-12-31")`, derived, not spelled as literals).

`packages/core/src/stats.ts`:

```ts
export interface StatsRow {
  readonly game: Game;
  readonly date: string;          // 'YYYY-MM-DD', the puzzle's own SP day
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;       // a FIELD OF THE ROW (the StreakRow posture; #58-forward-compatible)
  readonly elapsedMs: number;     // self-reported; display only (ADR-0027 posture)
  readonly hintsUsed: number;     // self-reported; displayed by NOTHING in #29; may never back a medal
  readonly guesses: number | null; // 1..6 for termo rows, null otherwise (DB CHECK)
}

export const TIMED_GAMES = ["binairo", "sudoku", "nonogram"] as const;
export type TimedGame = (typeof TIMED_GAMES)[number];

/** F5's six buckets: <4, 4–5, 5–6, 6–7, 7–9, >9 minutes. Five bounds, upper-exclusive. */
export const TIME_BUCKET_BOUNDS_MS = [240_000, 300_000, 360_000, 420_000, 540_000] as const;
export function timeBucketIndex(elapsedMs: number): number; // 0..5

export interface TimedGameStats {
  readonly solved: number;               // won rows, late included (§4.4)
  readonly bestMs: number | null;        // min over won ∧ onTime; null when none
  readonly averageMs: number | null;     // rounded mean over won ∧ onTime within the last 30 days (D8)
  readonly averageSampleCount: number;   // |that same 30-day population| — the closing line's gate (§6.4); 0 ⇔ averageMs null
  readonly histogram: readonly [number, number, number, number, number, number]; // won ∧ onTime
}
export interface TermoStats {
  readonly solved: number;               // won rows, late included
  readonly distribution: readonly [number, number, number, number, number, number, number];
  // index 0..5 = guesses 1..6 over won ∧ onTime; index 6 = the fail row, ALL lost rows (§4.3, ADR-0008 rule 3)
}
export interface StatsSummary {
  readonly binairo: TimedGameStats;
  readonly sudoku: TimedGameStats;
  readonly nonogram: TimedGameStats;
  readonly termo: TermoStats;
  readonly perfectDays: number;                 // |perfectDays(rows)|
  readonly todayTermoGuesses: number | null;    // §4.5
}
export function computeStats(rows: readonly StatsRow[], today: string): StatsSummary;

export function perfectDays(rows: readonly StatsRow[]): readonly string[]; // sorted ascending (D7)

export type CalendarDayState = "onTime" | "late" | "missed";
export interface CalendarDay {
  readonly date: string;
  readonly state: CalendarDayState;
  readonly perfect: boolean;
}
export function computeCalendar(
  rows: readonly StatsRow[],
  since: string,
  today: string,
  acceptedDaysBack: number,   // the route passes ACCEPTED_DAYS_BACK (D6) — the bound lives in the route layer (ADR-0026 decision 6)
): readonly CalendarDay[]; // D6's rules; [] if since > today (a guard, not a reachable state)
```

No clock, no timezone, no I/O in the module (the `streak.ts` register); `today` and `since` are caller-supplied from the DB clock and `acceptedDaysBack` from the route constant. `StreakRow` and `computeStreak` are untouched.

### 3.3 Contracts — `packages/core/src/contracts/stats.ts`, verbatim

```ts
import { z } from "zod";
import { isoDateString } from "./daily";

const statCount = z.number().int().min(0);

export const timedGameStatsSchema = z.strictObject({
  solved: statCount,
  bestMs: z.number().int().min(0).nullable(),
  averageMs: z.number().int().min(0).nullable(),
  averageSampleCount: statCount,
  histogram: z.tuple([statCount, statCount, statCount, statCount, statCount, statCount]),
});

export const termoStatsSchema = z.strictObject({
  solved: statCount,
  distribution: z.tuple([
    statCount, statCount, statCount, statCount, statCount, statCount, statCount,
  ]),
});

/** Body of GET /stats. Strict on both ends (ADR-0048 decision 3): growth is a
 *  NEW endpoint — #30's medals arrive on their own contract, never here. */
export const statsResponseSchema = z.strictObject({
  date: isoDateString,          // the DB clock's SP day the summary was computed against
  binairo: timedGameStatsSchema,
  sudoku: timedGameStatsSchema,
  nonogram: timedGameStatsSchema,
  termo: termoStatsSchema,      // structurally time-free (ADR-0045 decision 4)
  perfectDays: statCount,
  todayTermoGuesses: z.number().int().min(1).max(6).nullable(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const calendarDayStateSchema = z.enum(["onTime", "late", "missed"]);

/** Body of GET /stats/calendar. Full enumeration, one entry per day of
 *  [effectiveSince, today] — the client renders, never derives (D3).
 *  NO envelope fields: the range start IS days[0].date and the range end IS
 *  days.at(-1)!.date (`since <= today` holds by construction — both come off
 *  the same DB clock — so the enumeration is never empty; min(1) makes an
 *  impossible empty answer a parse failure, i.e. the catch-all 500, not a
 *  silent lie). A `date`/`since` pair here would be bytes derivable from the
 *  payload on a contract closed to change — the speculative surface this
 *  repo treats as a finding. */
export const statsCalendarResponseSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        date: isoDateString,
        state: calendarDayStateSchema,
        perfect: z.boolean(),
      }),
    )
    .min(1),
});
export type StatsCalendarResponse = z.infer<typeof statsCalendarResponseSchema>;
```

Every field's call site, named: `statsResponseSchema.date` — the hub tile's day-match gate (D5; the one consumer that genuinely needs the server's day, because it compares against the tile's server-resolved `date`); `todayTermoGuesses` — the hub tile and the conclusion's distribution highlight (§6.4); `perfectDays` — the stats screen's summary row; `averageSampleCount` — the conclusion closing line's gate (§6.4; without it no client-visible number distinguishes "average of one" from "average of many", since `solved` and `histogram` are all-time populations); calendar `days` — the stats screen's month grids, with `days[0].date`/`days.at(-1)!.date` serving as range start/end. Implementation note carried into the code: `z.tuple` typing vs core's `readonly` tuples is the known mutable-tuple trap (handoff 023) — spread into a fresh array at the parse boundary if needed, never `as`.

---

## 4. Core derivations — exact rules

All in `packages/core/src/stats.ts`; every rule seam-2 tested (§8). Shared row predicates, named once in code:

- **counts-on-time-won**: `outcome === "won" && onTime === true`
- **counts-late-won**: `outcome === "won" && onTime === false`
- lost rows (`outcome === "lost"`) participate in exactly one place: the fail row (4.3).

### 4.1 Dia Perfeito — `perfectDays(rows)`

Group rows by `date`; a date is perfect iff the set of games with a counts-on-time-won row that date has size 4 (all of `GAMES`). Exclusions, each individually tested: a **late** win never contributes; a **played** (lost) row never contributes; a **lost Termo forfeits** the day (structural: the PK means no won Termo row can coexist). Output: sorted date strings. No consecutive-day arithmetic exists (D7).

### 4.2 Calendar — `computeCalendar(rows, since, today, acceptedDaysBack)`

`effectiveSince = max( min(epochDay(since), min over rows of epochDay(row.date)), epochDay(since) − acceptedDaysBack )` (D6's clamp — with no rows, `effectiveSince = epochDay(since)`). For each epoch day `d` from `effectiveSince` to `epochDay(today)` inclusive, emit `{date: dateFromEpochDay(d), state, perfect}` with D6's precedence: on-time > late > missed; lost rows never colour; `perfect` from 4.1. Rows dated **before** `effectiveSince` emit nothing here (out of calendar range; they still feed every §4.3–4.5 aggregate — D6's rendering rule). Rows dated after `today` are inert. `since > today` → `[]` (a guard, unreachable through the route).

### 4.3 Termo distribution

Over `game === "termo"` rows only: buckets 1..6 count counts-on-time-won rows by `guesses`; **the fail row counts ALL lost rows, unqualified** — ADR-0008 rule 3 exactly as written: *"The loss records in the Termo guess distribution as the fail row"*, and CONTEXT.md rows 13 and 36: *"a lost Termo feeds the guess distribution's fail row **and nothing else**"*. Rule 2's exclusion list ("Late completions never feed the Termo guess distribution…") is scoped to late *completions* — won rows — and under ADR-0008's own three verbs a lost row is *played*, a different verb, so rule 2 never reaches it; there is no intersection to compute and no narrowing to record. (A hypothetical future #31 lost-late row therefore lands in the fail row too — which is what "and nothing else" already says.) A won on-time Termo row with `guesses` null or outside 1..6 (impossible under `completions_guesses_check`) is ignored defensively — the function is total over its type.

### 4.4 Times and totals (three timed games)

Per game in `TIMED_GAMES`: `bestMs` = min `elapsedMs` over counts-on-time-won rows, all time; `averageMs` = `Math.round(mean(elapsedMs))` over counts-on-time-won rows with `epochDay(row.date) > epochDay(today) − 30` (F5's "média (30 dias)", D8), with `averageSampleCount` = the size of that same population (`0` exactly when `averageMs` is `null`); `histogram` = 6-bucket counts over counts-on-time-won rows (all time) via `timeBucketIndex` — bucket edges upper-exclusive: `239_999 → 0`, `240_000 → 1`, `540_000 → 5`. **`solved` = count of ALL won rows, late included** — ADR-0008 rule 2's exclusion list names distributions, time stats, streak medals and Dia Perfeito, not totals, and a late solve is honestly a solve (the calendar already marks it distinct; hiding it from `resolvidos` would contradict "recorded and shown").

**The population mismatch is deliberate and recorded (ADR-0051 decision 6):** the three rows of one stat block answer three different questions — best over *all-time on-time wins*, average over *30-day on-time wins*, solved over *all wins including late* — and the UI labels must carry the distinction: the average's label carries its own `(30 dias)` suffix (F5's), and the other two carry none because all-time is the unmarked reading. Aligning `solved` with the on-time populations was rejected: it would silently un-count solves the calendar visibly shows, trading a labelling subtlety for a lie.

Lost rows never enter any of the numbers here (only Termo can lose, but the predicate is stated, not assumed). Termo's `solved` follows the same all-wins rule; **no Termo time is computed anywhere** (D8).

### 4.5 `todayTermoGuesses`

The `guesses` value of the row with `game === "termo" && date === today && outcome === "won"`, else `null`. (A won row dated today is on-time by the derivation's construction; no `onTime` conjunct is added, and the reasoning is a code comment.)

---

## 5. API routes

Two files, both **verbatim clones of the `GET /streak` template** (`apps/api/app/streak/route.ts`) — every deliberate absence preserved and re-stated in each header: `export const dynamic = "force-dynamic"`; no OPTIONS/preflight change (credentialed GET, no custom headers = CORS simple request); no origin guard (reads); no content-type check (no body); **no request parameters** (the user is the cookie, the day is the DB clock — a `?date=`/`?month=` would be speculative surface); whole handler in `try { … } catch { return errorResponse(500, "internal") }`; `Cache-Control: no-store` + `corsHeaders({credentials: true})` on **every** branch including 401/500; auth FIRST and sequential (`requireUserId`, 401 = zero queries); response `parse`d through the strict schema before `Response.json`.

- **`apps/api/app/stats/route.ts`** — after auth: `const [today, rows] = await Promise.all([todaySaoPaulo(db), listCompletionsForStats(db, userId)])`; answer `statsResponseSchema.parse({ date: today, ...computeStats(rows, today) })`.
- **`apps/api/app/stats/calendar/route.ts`** — after auth: `Promise.all([todaySaoPaulo(db), listCompletionsForStats(db, userId), getUserSince(db, userId)])`; `getUserSince` returning `undefined` throws (→ the catch-all 500 — a deletion race, not a client state); answer `statsCalendarResponseSchema.parse({ days: computeCalendar(rows, since, today, ACCEPTED_DAYS_BACK) })`, with `ACCEPTED_DAYS_BACK` imported from `../../src/publishing/dates` — the D6 bound, passed from the route layer where ADR-0026 decision 6 keeps it. The payload is exactly what core derived: range start = `days[0].date`, range end = `days.at(-1)!.date` — no envelope fields (§3.3).

Error posture: `401 no-session`, `500 internal` — nothing else exists (no 4xx variants; there is no input). Next.js nests `stats/calendar/route.ts` under `stats/` with no conflict (`stats/route.ts` handles the index).

---

## 6. Web

### 6.1 Client plumbing — `apps/web/src/stats/`

- `stats-client.ts`: `fetchStats(): Promise<StatsResponse | undefined>` and `fetchStatsCalendar(): Promise<StatsCalendarResponse | undefined>` — byte-for-byte the `streak-client.ts` register: `NEXT_PUBLIC_API_URL` guard with the loud `console.error`, `credentials: "include"`, no custom headers, `safeParse`, every failure → `undefined`, the "BEHIND THE FREE-PLAY WALL" header.
- `use-stats.ts` / `use-stats-calendar.ts`: the `use-streak.ts` mount-effect hook verbatim — three honest states (`undefined` unsettled / `null` settled-without-value / value), cancelled flag, no options, no `localStorage` cache (ADR-0048 D4).
- `calendar-month.ts`: a pure presentation helper grouping `CalendarDay[]` into month grids (weekday offsets via `epochDay`/`dateFromEpochDay` from core — no `new Date()` timezone arithmetic on data; a `Date.UTC`-based weekday computation is presentation and legal). Unit-tested under T-WEB.

### 6.2 The stats screen — `apps/web/app/estatisticas/page.tsx`

Static server shell (the `/privacidade` register: no `dynamic` export, no db import, no fetch in the server component), marker `data-page="estatisticas"`, `page.module.css`, plus one `"use client"` island beside it (`stats-view.tsx`, the CSS-modules-per-file reason `hub-day-state.tsx` documents) that owns both hooks. `SessionBootstrap` already mounts in the root layout — nothing to add.

Composition (top to bottom): back-to-Hoje top bar (the play-screen chrome register) → title (Fraunces) → **summary row** (`Dias Perfeitos — N`, Instrument Sans `tabular-nums`) → *(the documented #30 medal slot — a comment, no markup, D10)* → **four per-game blocks**: for each timed game, the F5 stat-row register (labels per §6.5: `Seu melhor tempo` / `Sua média (30 dias)` / `<Jogo>s resolvidos`, hairline separators, values `tabular-nums`) above its 6-bucket histogram (DESIGN.md's Histogram component: bars in that game's accent — solid vs `rgba(accent, 0.25)` per DESIGN.md, 3px top radius; **labels `--ink`**, ADR-0041 decision 1); for Termo, the solved row plus the 7-row guess distribution (rows labelled `1`–`6` and the fail row labelled `X`, horizontal bars in Termo's accent, counts `tabular-nums` in `--ink`) → **calendar**: month grids from `calendar-month.ts`, newest month first, back to the month of `days[0].date`; the three day states plus the perfect marker per the design constraints below; cells outside `[days[0].date, days.at(-1).date]` (leading/trailing weekday padding) render empty; a legend composed from `messages.stats.calendar.legend`, all text `--ink`.

**Calendar state carriers — geometry first, colour second (binding, not advisory).** The three states and the perfect marker must be distinguishable **with colour removed**, because the on-time-vs-late distinction is state-bearing and ADR-0041 decision 4's own warning applies (*"a state-bearing rule duplicates nothing and its hue IS the message"*):

- `onTime`: a **filled** cell (solid accent-tinted fill);
- `late`: an **outlined** cell — ring/border with no fill (ADR-0008's "visually distinct 'solved later' state"); hatching is an acceptable alternative carrier;
- `missed`: an **empty** neutral paper cell (no ring, no fill);
- `perfect`: a distinct **shape** (an accent-coloured mark — dot, diamond or corner tick — never a word, ADR-0041) layered on its filled cell.

Filled vs outlined vs empty survives greyscale by construction. Every state **boundary** (the fill edge, the late ring, the perfect mark against its cell) must clear WCAG 1.4.11's **3:1 non-text contrast floor** against its adjacent paper — the implementer computes and records the ratios in the PR body the way ADR-0041's rows do. Within those constraints the pixels are the implementer's, against DESIGN.md/PRODUCT.md (paper cards, hard offset shadows, no gradients, no XP/rank visual language per ADR-0006).

**What CI can and cannot see (recorded so the green is honest):** `/stats` and `/stats/calendar` are `requireUserId`-gated and every credentialed call from the `*.vercel.app` preview is anonymous (ADR-0048's own Rejected-section finding), so **`impeccable detect` only ever scans the settled-`null` zero state** — the neutral current month, empty aggregates. The data-bearing design (populated histograms, three calendar states, the perfect marker) is therefore verified by the jsdom rendering tests (T-WEB-S154/S155, which mock the client and assert the states render distinctly) plus a local browser pass over seeded data, and the PR body says so with screenshots. AC 4's `impeccable detect` green is real for the screen's chrome and zero state, and is **not claimed** as evidence for the data-bearing surfaces.

**Honest zero / no-CLS:** every numeral slot renders with reserved dimensions and the `BLANK_VALUE` idiom while unsettled; `bestMs`/`averageMs` `null` render `messages.stats.emptyValue` ("—"); on settled-`null` (cold visitor, the CI profile) the aggregates render real zeros the way the hub renders streak 0, and the calendar renders the current month with **all cells neutral and no legend claims** — a cold profile has no history to assert. Section heights are reserved so the fetch landing shifts nothing (#37).

**Aim for zero new accent-coloured text.** All new words are `--ink`; bars, cells and the perfect-day marker are shapes. The new `app/estatisticas/page.module.css` enters **both** hardcoded lists in `ink-on-accent.test.ts` — `SHEETS` (the accent-fill scan, `:33-38`) and `SHARED` (the accent-text scan, `:181-185`) — in the same commit as the stylesheet (§7), because that suite is the whole automated ADR-0041 gate and an unlisted sheet is invisible to it. With zero accent text, `ALLOWED_ACCENT_TEXT` and its `size === 4` pin stay untouched. If the design iteration ends with any accent-coloured word after all, the implementer owes the measured contrast ratio, an ADR-0041 consequence (h) row, an `ALLOWED_ACCENT_TEXT` entry **and** the size-pin bump — budgeted as a possibility, not planned.

### 6.3 The hub tile — D5's composition

Edit `apps/web/app/hub-day-state.tsx` only: `TermoDoneLink` per D5 — the **whole done anchor** (Link, `aria-label`, chip, result spans) for the `game === "termo" && entry.status === "completed"` case, returned by `HubCardAction`'s completed branch in place of the generic done link. The generic path (grid games' done tiles, the played tile, the pending CTA) is byte-identical to before. Accessible-name ladder: `completedAria(name)` while unsettled / settled-`null` / `stats.date !== date`; `doneGuessesAria(name, n)` when the value lands and dates match. Comment blocks referencing "#29 lands `em 4/6`" (lines ~117-123) are rewritten to describe the shipped state.

### 6.4 The conclusion stat block — D13

`conclusion-view.tsx` gains a `ConclusionStats` component (in-file or `src/play/conclusion-stats.tsx`, implementer's choice; the `#29` CSS register at `conclusion-view.module.css:285` is where its styles land), **mounted by the caller only when `syncOutcome === "recorded"`** — the `<StreakCard />` gate at `:357`, verbatim, with the same comment discipline: the gate guarantees the fetched aggregates include the game this screen decorates. It calls `useStats()`; on settled-`null` it renders **nothing** (the streak-card absence precedent — every unfetched state stays exactly as honest as the old absence); while unsettled it renders the reserved-height skeleton with `BLANK_VALUE`s.

- **Timed games:** F5's main-card block — the three stat rows (labels §6.5), the 6-bucket histogram with **today's bucket** solid + bold label (bucket index from the local `elapsedMs` via `timeBucketIndex` — the local record/`result` prop; if no local duration exists, no bucket is highlighted), others `rgba(accent, 0.25)`; then the closing italic Fraunces line. **The closing line's gate and semantics, decided:** it renders only when `averageSampleCount >= 2` and a local duration exists — the gate is on the **average's own sample population** (today's row is in the sample by construction, because the `syncOutcome === "recorded"` mount gate means the server already holds the day — the same "includes the day it decorates" semantics as ADR-0048 decision 4's streak card — so `>= 2` means today plus at least one other on-time win in the window, and the line never compares a value against a mean of itself alone). The comparison is against the **inclusive** 30-day average, stated as such in a code comment; this is honest because its direction always agrees with the exclusive comparison (`x < mean(S ∪ {x}) ⇔ x < mean(S)` for nonempty `S`), so F5's sentence stays true under either reading. Local < average → `messages.conclusion.closingFaster` (F5's own line: *"hoje você foi mais rápido que a sua média."*, `f5-conclusao-desktop.dc.html:50`), local > average → `closingSlower` (*"hoje você foi mais devagar que a sua média."*), equal → omitted. Composed in `messages.ts`, never joined in the component (ADR-0018).
- **Termo (both outcomes, ADR-0043's loss state included):** the 7-row distribution; today's row highlighted — on a win via `todayTermoGuesses` (its second call site), on a loss the fail row via the local outcome. No time row exists (D8).

`conclusion-view.tsx:66-73`'s three-absences comment is rewritten: two absences filled by #29, the share button still #34.

### 6.5 i18n — `apps/web/src/i18n/messages.ts` and `src/i18n/format.ts`

All new copy pt-BR, composed **in the module** — every aria sentence ships as a complete composer here, never assembled in a component (ADR-0018). **Bundle-canary law:** the words `então`, `mamãe`, `época` are `FORBIDDEN_EVERYWHERE` in client chunks (`route-client-js.mjs`) — no new copy may use them (audited: none below does).

**Stat-row labels — F5's exact register, adopted and unified.** F5 writes `Seu melhor tempo` / `Sua média (30 dias)` / `Binairos resolvidos` (`f5-conclusao-desktop.dc.html:33-35`); the draft's shorter `melhor tempo`/`média (30 dias)`/`resolvidos` was an unrecorded deviation. Decision: the F5 labels are the register on **both** the conclusion (where F5 is the spec) and the stats screen — one register, no drift; the solved label is a composer over the game's display name. `messages.games.nonogram.name` is `"Nonogram"`, so the composer yields `"Nonograms resolvidos"` — proposed as-is (the F5 pattern applied mechanically); Fernando may adjust any noun in the PR.

New keys (exact copy proposed; Fernando may adjust in PR):

```ts
hoje: {
  // (n is the guess count, 1..6; "1 de 6 tentativas" is correct — tentativas agrees with 6)
  doneGuessesAria: (game: string, n: number) => `${game} concluído em ${n} de 6 tentativas`,
  // completedAria STAYS — the unsettled/settled-null/date-mismatch name (D5);
  // its "#29 may retire the string" comment is rewritten to say why it survives.
},
conclusion: {
  closingFaster: "hoje você foi mais rápido que a sua média.",
  closingSlower: "hoje você foi mais devagar que a sua média.",
},
stats: {
  title: "Estatísticas",
  perfectDays: {
    label: "Dias Perfeitos",
    aria: (n: number) => `${n} ${n === 1 ? "dia perfeito" : "dias perfeitos"}`,
  },
  rows: {
    best: "Seu melhor tempo",
    average: "Sua média (30 dias)",
    solved: (name: string) => `${name}s resolvidos`,   // F5:35 "Binairos resolvidos"
  },
  emptyValue: "—",
  histogram: {
    labels: ["<4", "4–5", "5–6", "6–7", "7–9", ">9"],  // minutes, F5's exact glyph set — VISUAL only
    // Spoken names per bucket — real words, never the glyph labels ("<4" is
    // unreadable aloud). Index-aligned with TIME_BUCKET_BOUNDS_MS.
    bucketNames: [
      "menos de 4 minutos",
      "entre 4 e 5 minutos",
      "entre 5 e 6 minutos",
      "entre 6 e 7 minutos",
      "entre 7 e 9 minutos",
      "mais de 9 minutos",
    ],
    aria: (bucketName: string, n: number) =>
      `${n} ${n === 1 ? "jogo" : "jogos"} ${bucketName ? `— ${bucketName}` : ""}`.trim(),
    // rendered e.g. "3 jogos — entre 4 e 5 minutos", "1 jogo — menos de 4 minutos"
  },
  termo: {
    fail: "X",
    rowAria: (guesses: number, n: number) =>
      `${n} ${n === 1 ? "vitória" : "vitórias"} em ${guesses} ${guesses === 1 ? "tentativa" : "tentativas"}`,
    failAria: (n: number) => `${n} ${n === 1 ? "derrota" : "derrotas"}`,
  },
  calendar: {
    title: "Calendário",
    // "missed" means NO COMPLETION that day — which covers both a day never
    // played and a day played-and-lost (a lost Termo colours no day, D6), so
    // the legend word must be honest for both. "perdido" (collides with the
    // loss vocabulary — it would say "lost" over a day the player lost at
    // Termo, meaning the opposite thing) and "não jogado" (false for a
    // played-lost day) are both rejected. Fernando may adjust.
    legend: { onTime: "no dia", late: "mais tarde", missed: "sem conclusão" },
    // Complete per-state day composers — the formatted date goes IN here,
    // never joined in the component. `date` is formatLongDate(day.date).
    dayAria: {
      onTime: (date: string) => `${date}: concluído no dia`,
      onTimePerfect: (date: string) => `${date}: concluído no dia — Dia Perfeito`,
      late: (date: string) => `${date}: concluído mais tarde`,
      missed: (date: string) => `${date}: sem conclusão`,
    },
    // (no separate perfectAria — the perfect marker's meaning rides the day
    // composer above, so no composer declares a parameter it ignores)
  },
},
```

**`formatMonth`** lives in **`apps/web/src/i18n/format.ts`** beside `formatLongDate`/`formatShortDate` (not in `messages.ts` — formatters live with the locale, `format.ts:1-22`), built on the module's existing `utcNoon` anchor with `new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })` → "agosto de 2026". It inherits `utcNoon`'s UTC-noon reasoning by reusing the function; no new date arithmetic.

### 6.6 SSR / island composition

Server shells render everything static; all data arrives via mount-effect hooks so server markup and pre-hydration paint agree byte-for-byte (the T-WEB-S127 contract on the hub is preserved — `TermoDoneLink` fetches in an effect only). The stats page's island tree serializes nothing React Flight rejects (route-ssr's second assertion covers it).

---

## 7. Walls, budgets, CI surfaces — every list that grows, by file

| File | Change |
|---|---|
| **root `eslint.config.mjs`** (there is no `apps/web/eslint.config.mjs` — the wall lives at the repo root, scoped to the free-play dirs at ~`:494-518`) | Free-play wall: `freePlayBannedModuleGroups` (~`:214-284`) gains `**/stats`, `**/stats/**`, and the screen root `**/app/estatisticas/**` by name (the streak group-4 pattern, both specifier shapes — `src/stats/*` is one hop from walled server values); `freePlayDynamicBannedModule`'s regex (~`:289-294`) gains the same names (`stats(\/|$)`, `estatisticas`) for `import("…")` evasion |
| `apps/web/test/eslint-free-play-wall.test.ts` | T-LINT-S31/S32 probes for the new names, static and dynamic (ids on `it(...)` — that file's shipped convention, §8) |
| `packages/db/src/user.ts` + `packages/db/test/user.test.ts` | Barrel gains `listCompletionsForStats`, `getUserSince`; the pinned per-module export list widens in the same commit |
| **`packages/db/test/published.test.ts`** | **T-DB-S5** (`:756-813`) unions `Object.keys()` across all four package entries and pins both the sorted name array and `toHaveLength(30)` — the two new `user` exports move it to **32**. Widen the array and the count in the same commit as the barrel, with the file's own accounting style: "#29 moved it by exactly two: `listCompletionsForStats` and `getUserSince` on the user entry, never the root." Without this, commit 2 cannot pass pre-commit at all |
| `packages/db/src/completions.ts` | Comment-only: the `onTimeSql` reader-count sentence (D1) |
| `apps/web/src/i18n/routes.ts` | `routes.stats` (D11) |
| `apps/web/test/route-ssr.test.tsx` | The `/estatisticas` row (D11.2) |
| `.github/workflows/impeccable.yml` | `/estatisticas` in the preflight path list (line **76**), the marker `case` (line **87** neighbourhood — the `data-page=` arm), and both detect URL lists (desktop ~**:167**, mobile ~**:193**) — all three places, same PR |
| **`apps/web/test/ink-on-accent.test.ts`** | `app/estatisticas/page.module.css` added to **both** hardcoded sheet lists — `SHEETS` (`:33-38`, the accent-fill/ink scan, T-WEB-S72) and `SHARED` (`:181-185`, the accent-text scan, T-WEB-S73) — same commit as the stylesheet. The stats sheet renders all four game accents, so it is exactly the class of sheet both scans exist for; `ALLOWED_ACCENT_TEXT` and its `size === 4` pin stay untouched unless §6.2's accent-text ritual fires |
| **`apps/web/app/page.module.css`** | The hub twin of the conclusion's cursor rule (`:274-276`: "No cursor: pointer while the anchor is href-less"): `.secondaryLink` is a **shared** class over four links and `arquivo` stays href-less for #31, so the pointer returns via the scoped form **`.secondaryLink[href] { cursor: pointer; }`** (or a modifier class), never an unscoped uncomment; comment rewritten for the remaining `arquivo` case |
| `apps/web/src/play/conclusion-view.module.css` | The `:756` #29 marker's `cursor: pointer` uncommented (that link is not shared — a plain rule is fine) |
| `apps/web/scripts/route-client-js.mjs` | `/estatisticas` added to `BUDGETED` (default 40 KB); comment updated |

**Bundle budgets — the honest procedure.** This PR adds client JS to `/` (the un-budgeted baseline: `TermoDoneLink` + `stats-client` + `use-stats`) and to every play/conclusion route (`ConclusionStats` rides `conclusion-view.tsx`, which is on all of them). The PR body **must publish measured before/after raw-KB figures for every route including `/` itself** (`pnpm build && pnpm bundle-check`; remember `rm -rf apps/web/.next` before typecheck deletes the stats JSON — rebuild first). Known slack is thin: `/termo` ≈ 6.9 KB under its 76 KB; the grid routes were ~2–8 KB under the shared 40 KB after #19. Ordered response if any budget reds, sanctioned here so step 5 doesn't improvise:

1. **Shrink** — the stat block is markup + CSS + one fetch client, no libraries; measure what actually grew before reaching for structure.
2. **A per-route budget entry** at measured + ≤ 10 % with a comment citing #29 and this plan (the ADR-0045 D7 mechanism: budgets are measured, per-route).
3. **Last resort, and a NEW pattern:** lazy-mounting `ConclusionStats` behind `next/dynamic`. There is **no `next/dynamic` anywhere in this repo today**, so reaching this step means introducing a pattern, not applying one — it requires its own written justification in the PR and an explicit check that it preserves §6.6's server-markup/pre-hydration byte-agreement contract (reserved dimensions make the lazy mount honest for CLS, but the SSR-agreement question must be answered, not assumed).

**`MAX_DELTA_BYTES` is never raised** — it arms the motif tripwire — and no budget is retuned to absorb `/` growth silently.

---

## 8. Test plan

**Reserved ranges, from the frontier (re-derive with the grep before allocating; re-derive again at step 8; unspent tails burn):** T-CORE-**S59–S69** · T-DB-**S34–S36** · T-API-**S85–S90** · T-WEB-**S153–S159** · T-LINT-**S31–S32**. Conventions: ids on `it(...)` in core/db/api; in web on `describe(...)` (the shipped area-wide convention) **except** `eslint-free-play-wall.test.ts`, whose shipped per-file convention is ids on `it(...)` (T-LINT-S9…S15 all sit there) — S31/S32 follow the file, not the area. ADR-0023 vocabulary throughout: **"prove" only for construction-backed invariants; fixtures "pin"/"show"** — property tests below run at ≥ 100 runs in the `streak-properties.test.ts` register (fast-check 4.9.0, epoch-day windows so day structure actually arises).

| Id | Where | Claim (one line) |
|---|---|---|
| T-CORE-S59 | `core/test/stats.test.ts` | Pins Dia Perfeito: exactly four on-time wins of one day is perfect; any three are not |
| T-CORE-S60 | 〃 | Pins the forfeits (AC 1 + the #27-comment obligation): a lost Termo forfeits the day; a late win never counts; a played row never counts |
| T-CORE-S61 | `core/test/stats-properties.test.ts` | **Property:** `d ∈ perfectDays(rows)` ⇔ all four games have a won-on-time row dated `d`; output is a date set — no run-length arithmetic exists to test (never a second streak) |
| T-CORE-S62 | 〃 | **Property:** permutation invariance + determinism of `perfectDays`, `computeCalendar`, `computeStats` |
| T-CORE-S63 | `stats.test.ts` | Pins calendar rules: mixed day (on-time + late + lost) → `onTime`; lost-only day → `missed`; endpoints inclusive; the D6 clamp — a row `acceptedDaysBack` days before `since` extends the range, a row earlier than that does **not** (it emits no day entry and the range start stays clamped); rows before `effectiveSince` still feed the aggregates; future rows inert; `perfect` only on `onTime` days |
| T-CORE-S64 | `stats-properties.test.ts` | **Property:** calendar emits each date of `[effectiveSince, today]` exactly once, in order, each state agreeing with the row predicate recomputed independently; `effectiveSince` never precedes `since − acceptedDaysBack` and never fabricates a `missed` before both `since − acceptedDaysBack` and the earliest row |
| T-CORE-S65 | `stats.test.ts` | Pins times/totals: best/average math; the 30-day average window (31-day-old row excluded, 29 included) and `averageSampleCount` = that window's size, `0` ⇔ `averageMs` null; late and lost rows never move best/average/histogram; `solved` counts late wins; bucket edges `239_999→0`, `240_000→1`, `540_000→5` |
| T-CORE-S66 | 〃 | Pins the distribution: buckets 1–6 from on-time wins only; **the fail row counts every lost row, a manufactured late loss included (ADR-0008 rule 3, unqualified)**; late *wins* feed no bucket; null-guess won row ignored |
| T-CORE-S67 | 〃 | Pins `todayTermoGuesses`: won today → n; lost today / no row / won yesterday → null |
| T-CORE-S68 | `core/test/date.test.ts` | `dateFromEpochDay ∘ epochDay` identity as a **property over `[MIN_EPOCH_DAY, MAX_EPOCH_DAY]`** (the guards' own domain); both `epochDay` `RangeError` guards survive the hoist (the T-CORE-S35 claims, re-homed); `dateFromEpochDay` throws `RangeError` on a non-integer, on `MIN_EPOCH_DAY − 1` and on `MAX_EPOCH_DAY + 1` |
| T-CORE-S69 | `core/test/stats-contract.test.ts` | Pins both schemas: strict (unknown key rejected), tuple lengths 6/7, state enum closed, `todayTermoGuesses` range, `averageSampleCount` present, calendar `days` min-length 1 and envelope-free (no `date`/`since` key parses) |
| T-DB-S34 | `db/test/stats.test.ts` | `listCompletionsForStats` returns every row unfiltered, all seven fields, `guesses` projected, SQL-derived `onTime` correct for a manufactured late row, date-descending, other users' rows absent |
| T-DB-S35 | 〃 | `getUserSince` returns the SP day of `created_at` (UTC `T01:00:00Z` → the previous SP date) |
| T-DB-S36 | 〃 | Pins the module surface: `db/src/stats.ts` exports exactly the two readers (the `user.test.ts` per-module pin **and** `published.test.ts` T-DB-S5's cross-entry array + count 30→32 widen in the same commit — both sanctioned edits) |
| T-API-S85 | `api/test/stats.test.ts` | `GET /stats` happy path over PGlite: seeded on-time/late/lost rows → contract parses; the exclusions are visible at the seam (late moves `solved` only; a lost Termo lands in the fail row only) |
| T-API-S86 | 〃 | `GET /stats` discipline: cookieless → 401 with zero queries; thrown db → 500; `no-store` + CORS grant on every branch (the T-API-S53 pattern) |
| T-API-S87 | 〃 | `todayTermoGuesses` at the seam: won today → n; lost → null; another user's win never leaks |
| T-API-S88 | `api/test/stats-calendar.test.ts` | Calendar happy path: range start from `users.created_at`'s SP day; full enumeration ending at the DB clock's today; three states from real rows; `perfect: true` on a four-win day and `false` on a lost-Termo day; payload carries `days` only |
| T-API-S89 | 〃 | Calendar discipline: 401 / 500 / `no-store` on every branch |
| T-API-S90 | 〃 | Pins the clamp at the seam: a row dated one day before `created_at`'s SP day extends the range by exactly one day (the `ACCEPTED_DAYS_BACK` birth-midnight case); a manufactured row dated a week earlier does **not** extend it further |
| T-WEB-S153 | `web/test/stats-page.test.tsx` | The screen's honest zero: pre-fetch skeleton with reserved slots, sections + `data-page` marker present, numerals `tabular-nums` |
| T-WEB-S154 | 〃 | Fetched aggregates render (stats-client mocked): stat rows with the F5 labels, histogram counts + bucket arias from `bucketNames`, Termo distribution + fail row, Dias Perfeitos count, `emptyValue` for null best/average |
| T-WEB-S155 | 〃 | Calendar: three states rendered distinctly (distinct class/geometry hooks, not colour alone), perfect marker present, day arias from the per-state composers, missed only in range, settled-null renders the neutral month |
| T-WEB-S156 | `web/test/hub-termo-result.test.tsx` | `TermoDoneLink`: completed Termo shows `em 4/6` via `doneResultLong` with `doneGuessesAria` when value lands and dates match; `completedAria` + blank line box while unsettled; `completedAria` chip-only on settled-null and on date mismatch (T-WEB-S80 named green); grid tiles byte-identical to before |
| T-WEB-S157 | `web/test/conclusion-stats.test.tsx` | The block: mounts only under `syncOutcome === "recorded"` (absent on pending/rejected); timed rows + histogram + today's-bucket highlight from the local duration; closing line only when `averageSampleCount >= 2` ∧ a local duration exists (faster/slower/omitted-on-equal); Termo variant on win and loss; absent on settled-null |
| T-WEB-S158 | `web/test/stats-client.test.ts` | Both fetchers: parse success, env-unset guard, non-200/parse/network → `undefined` (the streak-client suite's shape) |
| T-WEB-S159 | `web/test/stats-links.test.tsx` | Hub nav and conclusion "Ver estatísticas" carry `routes.stats` |
| T-LINT-S31 | `eslint-free-play-wall.test.ts` | Static probes: free-play scope importing `src/stats/*` or `app/estatisticas/*` fails by name (on `it(...)`, the file's convention) |
| T-LINT-S32 | 〃 | Dynamic-import regex probes for the same names |

**Existing tripwires touched, exhaustively:** `user.test.ts` per-module export pin (widened, T-DB-S36's commit); **`published.test.ts` T-DB-S5** (cross-entry array + `toHaveLength` 30→32, same commit — review B's blocker); `route-ssr.test.tsx` (row added); **`ink-on-accent.test.ts`** (`SHEETS` + `SHARED` gain the new stylesheet — list growth only, no assertion weakened; `ALLOWED_ACCENT_TEXT` and its size pin untouched); nothing else. **Untouched and expected green:** T-DB-S24 (no schema change), T-DB-S11 (`getCompletion` still omits `guesses`), T-DB-S13/S14, the streak suites (D9's hoist changes no behaviour), **T-WEB-S80** (the won-Termo tile keeps `completedAria` as its unsettled name — D5), `bundle-markers`.

## 9. Migration / deploy notes

**None.** No migration is generated or applied; migration `0005` remains free; no Neon step, no push-ordering constraint, no `.env` change, no new dependency. The two new endpoints deploy with the branch's preview and are inert until called.

## 10. Docs

- **This plan** → `docs/plans/033-issue-29-plan-stats-calendar-dia-perfeito.md` + its `docs/README.md` "Current" row, same PR.
- **ADR-0051** (D12) → real file at implementation time + its `docs/README.md` row, same PR. Amends nothing; no reciprocal lines (audited in D12; checked again at exit). Decision list per D12: derivations-not-caches; the clamped calendar range with the #31 revisit note; the contract split + calendar payload trigger; three-game times; the `epochDay` hoist; the stat-row populations.
- **CONTEXT.md**: the **Dia Perfeito** and **Guess distribution** rows gain the ADR-0051 citation and drop the "#29's statistic; #27 only writes the count" future tense; the **Played** and **Fail row** rows (13/36) are **untouched — they stay true verbatim** under §4.3's unqualified fail row; one new row: **Stats calendar / Calendário** — "The per-date history view: completed on time, completed late, or missed, from the account's first SP day (backward-extended at most `ACCEPTED_DAYS_BACK` days for a birth-midnight completion); missed is the absence of a won row; a Dia Perfeito is its rare marker (ADR-0008, ADR-0051)." Proposed via the `/domain-modeling` posture, Fernando-adjustable.
- `docs/agents/test-ids.md` frontier re-derived at step 8 (`grep -rhoE "T-[A-Z]+-S[0-9]+[a-z]?" apps packages | sort -u`).

## 11. Execution order

1. **Branch** `feat/29-stats-calendar-dia-perfeito` off `main`. Re-run the test-id grep; confirm the §8 ranges still start at the frontier (if moved, shift the whole ranges and note it in §13).
2. **Read first:** CLAUDE.md; issue #29 + comment; ADR-0008/0009/0026 (decision 6 especially)/0048/0049/0045 D4/0041/0031 D1; `packages/core/src/streak.ts`; `packages/db/src/completions.ts`; `apps/api/src/publishing/dates.ts` (the `ACCEPTED_DAYS_BACK` comment block); `apps/api/app/streak/route.ts` + `apps/api/test/streak.test.ts`; `apps/web/app/{page,hub-day-state,hub-streak}.tsx`; `src/streak/*`; `conclusion-view.tsx` (`:340-410` — the StreakCard gate); `apps/web/test/{hoje.smoke.test.tsx,ink-on-accent.test.ts}`; `route-client-js.mjs`; `impeccable.yml`; F5/F6 frames + DESIGN.md.
3. **Core** (commit 1): `date.ts` hoist + guarded inverse + bounds constants + `streak.ts` import swap; `stats.ts`; `contracts/stats.ts`; index exports; T-CORE-S59–S69. Gate: `pnpm typecheck && pnpm test` (core scope) — streak suites must pass untouched.
4. **DB** (commit 2): `db/src/stats.ts`; `user.ts` barrel + **both** tripwire widens (`user.test.ts` pin **and** `published.test.ts` T-DB-S5 array/count 30→32 with the accounting comment); `completions.ts` comment; T-DB-S34–S36. Gate: db tests (PGlite, 30 s `beforeAll`) — pre-commit runs the whole suite, so the T-DB-S5 widen is what lets this commit exist at all.
5. **API** (commit 3): the two routes (calendar route imports and passes `ACCEPTED_DAYS_BACK`); T-API-S85–S90. Gate: api tests.
6. **Web, plumbing + hub + page shell** (commit 4): `routes.stats`; **`app/estatisticas/page.tsx` static server shell with the `data-page="estatisticas"` marker + `page.module.css`** (typed routes require the page file before any `<Link href={routes.stats}>` typechecks — D11's sequencing note); the two links go live (+ the scoped `.secondaryLink[href]` cursor rule on the hub, the plain one on the conclusion); `route-ssr.test.tsx` row; `src/stats/*`; wall bans in the root `eslint.config.mjs` + T-LINT-S31/S32; `TermoDoneLink`; `messages` keys + `formatMonth`; T-WEB-S156/S158/S159. Gate: typecheck green **including** the typed-route literals.
7. **Web, screens** (commit 5): the stats island (`stats-view.tsx`, calendar, `calendar-month.ts`) filling the shell; conclusion stat block behind the `syncOutcome === "recorded"` gate; `ink-on-accent.test.ts` SHEETS/SHARED additions (same commit as the stylesheet's accent use); impeccable.yml lists (×3); `BUDGETED`; T-WEB-S153–S155/S157.
8. **Bundle evidence:** `pnpm build && pnpm bundle-check`; record before/after figures for every route incl. `/`; apply §7's ordered response if red.
9. **Docs** (commit 6): ADR-0051; CONTEXT.md; `docs/README.md` rows; this plan file committed; test-ids frontier.
10. **Full mechanical gate** with pasted output: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build && pnpm bundle-check` (nvm prefix: `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`). PR with figures + the §6.2 contrast ratios + seeded-data screenshots; `npx impeccable detect` runs green in CI against the preview (all three lists updated so `/estatisticas` is actually scanned, not vacuously green — and the PR body states the CI scan covers the zero state only, per §6.2).

## 12. Exit criteria

- [ ] All four ACs discharged: Dia Perfeito pure in core, seam-2 unit + property tested incl. the played-row exclusion (T-CORE-S59–S62); calendar renders three states honestly (T-CORE-S63/S64, T-API-S88/S90, T-WEB-S155); distribution + fail row per ADR-0008 rule 3 as written, late-free times, correct totals, server-derived (T-CORE-S65–S66, T-API-S85); screens against the design system, `impeccable detect` green on a scan that includes `/estatisticas`, with the zero-state-only caveat recorded in the PR.
- [ ] `git diff main -- packages/db/src/schema.ts packages/db/migrations` is empty; T-DB-S24 green untouched; `onTimeSql()` has no second spelling (`grep -rn "at time zone" packages apps` shows only the shipped sites + `getUserSince`).
- [ ] `DayEntry` unchanged; hub Termo tile reads `em 4/6` from the server value only; T-WEB-S80 green untouched.
- [ ] Both contracts strict and parsed on both ends; no request parameters; no envelope field derivable from `days`; `no-store` on every branch; `ACCEPTED_DAYS_BACK` reaches core as a route-passed parameter, never a core constant.
- [ ] `ConclusionStats` mounts only under `syncOutcome === "recorded"` (T-WEB-S157).
- [ ] Wall probes red-then-green for the new names in the **root** `eslint.config.mjs`; route-ssr, impeccable (×3 lists at :76/:87/:167/:193), `BUDGETED` all carry `/estatisticas`.
- [ ] T-DB-S5 widened to 32 with its accounting comment; the `user.test.ts` pin widened in the same commit.
- [ ] `ink-on-accent.test.ts` `SHEETS` and `SHARED` both carry `app/estatisticas/page.module.css`; zero new accent-coloured text, or the full ADR-0041 (h) + `ALLOWED_ACCENT_TEXT` + size-pin ritual for each; calendar state boundaries' 3:1 ratios measured and in the PR body.
- [ ] The hub cursor rule is the scoped `.secondaryLink[href]` form; `arquivo` stays cursor-inert.
- [ ] Measured bundle figures for every route incl. `/` in the PR body; no `MAX_DELTA_BYTES` change; any `next/dynamic` use carries §7 step 3's written justification, or none exists.
- [ ] ADR-0051 + plan 033 + two `docs/README.md` rows + CONTEXT.md in the PR; CONTEXT.md rows 13/36 (Played, Fail row) byte-untouched; no ADR gained an unreciprocated amendment; test-id frontier re-derived.
- [ ] Full gate output pasted; pre-commit never bypassed.

## 13. Risks & deviations register

*Revised at step 4 (2026-08-13) against plan reviews A (ADR adherence — findings 1–11) and B (feasibility — findings 1–12); every finding is resolved in the sections above, and the register starts from that corrected baseline. Otherwise empty at plan time. The implement agent appends every deviation from this plan here, with the reason and the section it deviates from. Pre-identified watch items: (1) grid-route budget slack vs the conclusion stat block (§7's ordered response); (2) the `z.tuple`/readonly-tuple typing trap (handoff 023); (3) pt-BR copy vs the three bundle-canary words (§6.5); (4) the `${name}s resolvidos` composer over `"Nonogram"` reads as an anglicism — flagged for Fernando in the PR.*

**Deviations appended at step 5 (backend half, 2026-08-13):**

1. **§3.1 (`getUserSince`)** — the SQL expression is `((created_at at time zone SP)::date)::text`, not the sketch's bare `(…)::date`. Reason: without the trailing `::text` the driver hands back a JS `Date` for a Postgres `date` value (node-postgres/PGlite default type parsing), and the module returns strings, never Dates — this is the shipped `todaySaoPaulo` register (`buffer.ts:21`), which casts `::date)::text` for exactly this reason. T-DB-S35 pins the string shape. No semantic change; the sketch was commented pseudocode.

2. **§8 (property tests)** — the three new property tests pin `seed: 20_260_829` (T-CORE-S61/S62/S64) and `seed: 20_260_813` (T-CORE-S68) alongside `numRuns: 100`. The named register file (`streak-properties.test.ts`) carries no seed, but the step-5 kickoff instruction and the `attach-properties.test.ts` precedent both call for pinned seeds; recorded so a reviewer comparing against the register does not read the seed as drift.

**Deviations appended at step 5 (web half, 2026-08-13):**

3. **§8 ("Existing tripwires touched, exhaustively")** — two additional shipped tests had to be edited, both because they PIN the dead-link state D11.5 exists to flip: `conclusion-view.test.tsx` ("points the CTA at Hoje and leaves the statistics link dead", T-WEB-18's block) and `free-play-routes.test.tsx` T-WEB-S114 ("Arquivo and Estatísticas stay href-less"). Each was updated to assert the NEW state — the stats link carries `routes.stats`, `arquivo` stays href-less — the same sanctioned direction as the route-ssr row; no assertion was weakened and T-WEB-S159 pins the activation itself. §8's "nothing else" list simply missed these two rows; commit 4 cannot pass `pnpm test` without the edits.

4. **§8 again (commit 5)** — one more shipped-test edit forced by D13: `conclusion-view.test.tsx` T-WEB-S128's deferred-fetch case handed ONE `Response` object to every `fetch` call, and a recorded conclusion now fires two gated reads (streak + stats); a Response body reads once, so whichever consumer called `.json()` second threw — when that was the streak, the card under test unmounted and the test failed. Fixed by cloning per call (`deferred.then((r) => r.clone())`); no assertion weakened, the streak card's machine is pinned exactly as before, and the stats read settles to its own honest absence on the wrong-schema body.

5. **§6.2 (the perfect marker's colour)** — the plan's parenthetical calls the Dia Perfeito mark "an accent-coloured mark … layered on its filled cell", but on the solid `--accent-app` fill an accent-coloured mark is invisible, and every accent-tint fill that would let a solid-accent mark read fails the same §6.2 sentence's binding 3:1 fill-edge floor (computed: 25% tint on card = 1.477:1, 60% = 2.79:1; the first mix clearing 3:1 (70% = 3.415:1) drops the day numeral below the 4.5 text floor at 80% = 4.19:1). The shipped resolution keeps the solid fill (6.2980:1 boundary, ADR-0041's own recorded pair) and paints the mark `--paper-card` ON the fill — 6.2980:1, still a SHAPE and never a word, so ADR-0041 is obeyed; only the mark's hue deviates, forced by the arithmetic. The accent still carries the perfect day: the mark only exists on an accent-filled cell.

6. **§6.2 (settled-null "renders the current month")** — implemented with the client clock read in the settled-`null` branch only (an `Intl` SP-timezone read, the hub page's own helper shape): that branch cannot exist before mount, so the server markup never carries its output and §6.6's byte-agreement holds; the neutral month claims no state for any day, selects no record and backs no derived value, so the client-clock invariant is untouched. While UNSETTLED the calendar renders a reserved-height box with no month claimed (the plan named reserved dimensions but not the month question; recorded for completeness).

