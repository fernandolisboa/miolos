# Plan 065 — Issue #163: the archive month view as a real clickable calendar

**Tier 2. One PR.** To be committed as `docs/plans/065-issue-163-plan-archive-calendar.md`
(065 reserved by the orchestrator) with its `docs/README.md` row in the same PR.
Ground: step-1 explore (`~/miolos-session/163-step1-explore.md`), verified against the code on
`main` on 2026-08-20. All decisions below are professional design/engineering calls — recorded
on the issue at step 8, never brought to Fernando (CLAUDE.md § Writing for Fernando).

## Decisions

**D1 — Both surfaces get the calendar; the index shows exactly one month.**
`/arquivo/mes/<mes>` replaces its `DayRows` list with a real calendar grid (the issue title).
`/arquivo` replaces its "Dias recentes" section with the **newest archived month's** calendar
grid, headed by that month's name, and keeps the "Por mês" chips below it (the issue body —
Fernando's screenshot was of `/arquivo`). *Why one month on the index:* rendering every month
as a grid (the stats-calendar shape) would make the index's read unbounded and its height grow
forever — the exact seasonal `first-viewport-column-overflow` class the napkin warns about —
while one grid plus chips keeps every read bounded by construction (ADR-0053 D4 posture) and
the chips one tap from any other month. *Rejected:* calendar on the month pages only, index
untouched — fails the ask's spirit ("`/arquivo` would look much better as a real calendar");
all months as grids on the index — unbounded read, unbounded page.
Early-month sparseness (index grid with 1–2 linked days on the 2nd of a month) is accepted as
the ragged-floor's own shape (ADR-0053 D3: ragged is the shipped shape, not an edge case).

**D2 — "Dias recentes" and `DayRows` go; the "Por mês" chips stay unchanged.**
The calendar **replaces** the rows on both surfaces (a calendar wrapping rows would be the
banned card-in-card / duplicated-content shape). `DayRows`, `recentDayGroups`, the
`.rows/.row/.rowLink/.rowDate/.rowGames/.rowGame` CSS, and `messages.archive.recent.heading`
+ `dayRowAria` are **deleted if no consumer remains** (verify `groupArchivedDays`/
`ArchiveDayGroup` consumers first — the day page and sitemap use them; delete only what is
truly dead, per the napkin's unused-surface rule). Deleting the two message keys reds
`T-WEB-S181` (rewritten in place, same change — test plan). The chips stay: month navigation the
grid does not provide AND the impeccable workflow's discovery source: `impeccable.yml:156`
greps the index body for the first `/arquivo/mes/YYYY-MM` href (verified). **The workflow is
NOT touched**; instead the rewritten index test pins that a non-empty archive index renders at
least one `archiveMonthRoute(...)` href (grammar `/arquivo/mes/\d{4}-\d{2}`), so a future
redesign cannot silently turn the date-bearing scans into the empty-archive skip branch.
*Rejected:* updating the workflow to discover months elsewhere — more moving parts for zero
gain when the chips are independently justified.

**D3 — Cell anatomy: ≥44px link tiles, numeral-only, Sunday-first, weekday header, inert today.**
- Grid: `grid-template-columns: repeat(7, minmax(var(--touch-target-min), 1fr))` (44px floor,
  DESIGN.md), `gap: var(--space-1)` desktop / `2px` mobile. Card wrapper in the stats month
  register — `--paper-card`, 1px `--line`, **neutral** hard shadow `var(--shadow-md) var(--line)`
  (the archive belongs to no game; accents colour shapes only, and this surface earns none —
  ADR-0041), `width: fit-content` desktop, `width: 100%` + `padding: var(--space-3)` mobile.
  Arithmetic at 390px: content 350 − card 2×12 padding − 2 border = 324; 7×44 + 6×2 = 320 ≤ 324.
  Fits; pinned by a stylesheet-text test (D3-t below). The 2px gap is off the 4pt scale: the
  sheet records the forcing arithmetic in a comment beside the rule (7×44 at 390px leaves 30px
  for gaps + padding + border) — the `.doneChip` 9px precedent (arquivo.module.css:554-566).
  Not card-in-card: the card sits bare in `.section` on desk paper, like the stats months.
- **Published past day** = `<Link prefetch={false} href={archiveDayRoute(date)}>`: 1px `--line`
  border tile, `border-radius: var(--radius-cell)`, numeral `--ink` weight 600.
  **Inert in-month day** (unpublished / killed / today / future) = `<span aria-hidden>`:
  no border, numeral `--ink-2` weight 400. **Pad cell** = empty `<span aria-hidden>`.
  Every cell (`.dayCellLink`, `.dayCellInert`, `.dayCellPad`) carries `aspect-ratio: 1` — the
  stats `.day`/`.dayPad` idiom — so the 44px column floor holds on the BLOCK axis too
  (DESIGN.md's ≥44px is two-axis for an interactive tile; the width-only track would leave
  height to line-height). Pinned on both axes by the CSS-geometry test (test-plan item 3).
  Three carriers distinguish linked from inert — border presence (geometry, survives
  greyscale), ink vs ink-2 (15.6663:1 / 5.3003:1 on card paper, both pass AA — the figures the
  stats sheet records at `estatisticas/page.module.css:228,375`; step 5 copies the `--ink-2`
  figure into a comment on `.dayCellInert` and re-verifies it by the same WCAG
  relative-luminance arithmetic over the token hexes, never by recall), weight — and the
  link's accessible name carries the meaning, so no carrier stands alone (ADR-0041 d5).
  Hover: the sheet's existing `.page a:hover` accent underline applies unchanged (shape, not
  word). No per-day game names in cells — they cannot fit at 44px; the day page one tap deeper
  carries them. This loss is the recorded design trade of the ticket.
- Numerals: `var(--font-ui)` + `font-variant-numeric: tabular-nums`, 14px — a column of
  aligning figures is ADR-0036 decision 1's exact case (Fraunces has no tabular figures).
- **Weekday header row**, Sunday-first to match the geometry helper's 0-Sunday arithmetic:
  seven separate elements, `aria-hidden` (each link's name is a full date; headers are visual
  scaffolding), kicker register 11px uppercase `--ink-2`. Strings are a new
  `messages.archive.calendar.weekdays` 7-tuple `["dom","seg","ter","qua","qui","sex","sáb"]`
  (i18n stays externalised; no Intl weekday formatter, so no new module-scope formatter and no
  period-trimming). Each element's direct uppercase text is 3 chars — the `all-caps-body`
  >30-char predicate is per-element, so this is safe by construction and pinned by test.
- Aria: the linked cell's name carries the **weekday** — the one fact the aria-hidden header
  withholds (column position; the parity the old "31 · segunda-feira" rows announced).
  `aria-label={messages.archive.calendar.dayAria(formatLongDate(date), weekdayLong)}` →
  "15 de agosto de 2026 — sábado", composed WHOLE in `messages` (the `dayRowAria` em-dash
  idiom); the visible "15" leads the name, so WCAG 2.5.3 label-in-name holds. `weekdayLong`
  is a second 7-tuple `calendar.weekdaysLong` ("domingo" … "sábado") indexed by the 0-Sunday
  column — still no Intl weekday formatter anywhere; recorded on the issue. Structure:
  `<ul role="list">` grid container (the `list-style:none`/WebKit note in `stats-view.tsx`),
  one `<li>` per cell (pads/inert li `aria-hidden`, keyed by index; days keyed by date). No
  roving focus — ADR-0030 is for game boards; ~31 tab stops equals today's row count.
- **Today is inert, never linked.** The reader (`archivedWallPredicate`) can never return
  today, so "linked = present in the reader's result" needs **no clock read anywhere** — the
  app's single sanctioned device-clock call site stays the stats neutral month. *Rejected:*
  linking today to ride the 307 — a link that bounces to the hub from inside the archive is a
  surprise, and the issue's own wording is "every published **past** day".
- Month heading: index section `<h2>{formatMonth(...)}</h2>` above the card (headings are
  all-caps-exempt and not uppercase anyway); month page keeps its existing `<h1>` and gains no
  duplicate title inside the card. Longest name "fevereiro de 2026" (17 chars) is in the
  worst-case fixture.

**D4 — Geometry extraction: one spelling, new neutral home `src/calendar/month-grid.ts`.**
Extract `buildMonth`'s algorithm from `apps/web/src/stats/calendar-month.ts` into a new
`apps/web/src/calendar/month-grid.ts` exporting `WEEK_LENGTH` and a generic
`buildMonthCells<T>(monthKey: string, cellAt: (epochDay: number) => T): { month, cells: readonly (T | null)[] }`
where `null` is **out-of-month padding only** and `cellAt` is total over in-month days (stats
passes a `cellAt` returning `CalendarDay | null`, so its cells type is unchanged; the Euclidean
0-Sunday arithmetic and `nextMonthFirst` move verbatim). `calendar-month.ts` keeps its entire
public surface (`calendarMonths`, `neutralMonth`, `CalendarMonth`) and delegates — stats tests
must pass **unmodified**, which is the refactor's proof. New `apps/web/src/archive/calendar.ts`:
`interface ArchiveCalendarCell { date: string; linked: boolean }` and
`archiveCalendarMonth(month: string, publishedDates: ReadonlySet<string>)` built on
`buildMonthCells`. *Why:* two spellings of month geometry is the drift the repo hates (the
module's own doc: "the ONE spelling"), and the generic now has two real consumers — not the
speculative `<T>` the napkin kills. *Rejected:* a byte-copy sibling in `src/archive/` (drift);
hoisting to `packages/ui`/`core` (legal — pure value function — but there is no second app
consumer, and a package move is weight this ticket doesn't earn); archive importing from
`src/stats/` (couples the archive to a stats-named module and leaves "one spelling" living
under one domain's roof).

**D5 — Zero client JS stays zero, stated as an invariant.** Everything ships as server-rendered
`<Link prefetch={false}>` anchors composed through `archiveDayRoute`/`archiveMonthRoute`. No
`"use client"`, no hook, no new route ⇒ `scripts/route-client-js.mjs` classification is
untouched. Proof at the gate: `pnpm build` in `apps/web` then `pnpm bundle-check` **from
`apps/web`** (napkin Execution 2), output pasted, `/arquivo` and `/arquivo/mes/[mes]` deltas
unchanged. The 31-cell `prefetch={false}` guard is ADR-0053 D2's multiplier watch, kept.

**D6 — No ADR and no amendment, checked sentence by sentence.** This is a presentation change
inside ADR-0053's shipped frame. Audited against its text: D1's "one date link per row … ~31
touch targets rather than 124 anchors" stays true in substance (one link per **day**, ~31
targets); D2 (`force-dynamic`, prefetch guard), D3 (no anchor — the index still derives the
newest month from the reader's own answer), D4 (reads stay bounded by construction — the index
window widens 32 → 124 rows, still a constant), D12 (discovery grammar untouched, href kept)
and the Rejected list (no query-param months, no pagination) all hold. Empty archive stays
200 + marker + sentence with **no skeleton grid**; empty month stays a real 404 (grid renders
only when `days.length > 0`, which the existing `notFound()` already guarantees). ADR-0041/0036
are obeyed, not amended. The plan states this so the step-6 ADR lens has the audit in hand.

## Work slices (file-level)

1. **Geometry** — new `apps/web/src/calendar/month-grid.ts`; rewire
   `apps/web/src/stats/calendar-month.ts` to delegate (public API byte-compatible). New unit
   test for `buildMonthCells` (leading pads, whole-week invariant, 2026-08 = 31 days starting
   Saturday → 42 cells/6 weeks, 2028-02 leap, pre-1970 Euclidean branch).
2. **Archive model** — new `apps/web/src/archive/calendar.ts` (`archiveCalendarMonth`), pure,
   no clock. Unit test: linked mapping, killed-day/ragged absence renders inert with no code
   change, Feb bounds.
3. **Shared view** — new `apps/web/app/arquivo/calendar-grid.tsx`:
   `ArchiveCalendar({ month, publishedDates })` (synchronous, props-only — RTL renders it
   directly). Renders weekday header + `<ul role="list">` grid per D3. CSS added to
   `apps/web/app/arquivo/arquivo.module.css`: `.calendarCard`, `.weekdays`, `.weekday`,
   `.calendarGrid`, `.dayCellLink`, `.dayCellInert`, `.dayCellPad`, `.dayNumeral` (+ the
   768px mobile block, 2px-gap and `--ink-2` comments per D3). New strings:
   `messages.archive.calendar.weekdays`, `.weekdaysLong`, `.dayAria` (audit comment: none of
   the FORBIDDEN_EVERYWHERE words). Both new files fall under T-WEB-S181's pt-BR-literal scan
   (`app/arquivo` + `src/archive`) — a second mechanical reason the accented weekday strings
   ("sáb") live in `messages`, never inlined; visible so a step-5 shortcut can't inline them.
4. **Month page** — `apps/web/app/arquivo/month-view.tsx`: replace `<DayRows …>` with
   `<ArchiveCalendar month={month} publishedDates={…} />`; props become
   `{ month, dates (or groups→dates), previous, next }`; h1, back link, sibling `monthNav`
   unchanged. `mes/[mes]/page.tsx`: pass the day set (`days.map(d => d.date)` deduped);
   readers, bounds, 404 and canonical-poisoning defence untouched.
5. **Index** — `apps/web/app/arquivo/page.tsx`: `ROW_WINDOW` 32 → `NEWEST_MONTH_ROW_WINDOW = 124`
   (31 days × 4 games — the maximum rows one month holds; comment says so). Keep the single
   `Promise.all` shape. Derive the grid month **from the window itself** —
   `monthOf(days[0].date)` (`src/archive/parse-params.ts`) — and its published set as the
   matching prefix, so the grid and its data cannot straddle midnight disagreeing with each
   other; `months` feeds only the chips. `index-view.tsx`: props
   `{ calendar: { month, dates } | undefined, months }`; "Dias recentes" section → calendar
   section headed `<h2>{formatMonth(…)}</h2>`; "Por mês" chips and empty state unchanged
   (empty = `months.length === 0 && calendar === undefined`).
6. **Deletions** — `day-rows.tsx`, row CSS, `recentDayGroups`, `messages.archive.recent`,
   `dayRowAria` — each only after grepping for remaining consumers (day page!). Update the doc
   comments that describe row anatomy (`month-view.tsx` header, sheet header). `docs/plans/037`
   and ADR texts are snapshots/records — not rewritten.
7. **Docs** — commit this plan as `docs/plans/065-issue-163-plan-archive-calendar.md` +
   `docs/README.md` row.

## Test plan (counts; orchestrator reserves ids on the issue before step 5)

The new ids come from **the range reserved on issue #163 by the orchestrator before step 5** —
never from a number this plan states (burned tails, #162's, and live reservations, #169's,
make any snapshot stale). The reserving agent re-derives the frontier by grep at reservation
time (command and burned-slots table in `docs/agents/test-ids.md`) and after every
`git merge origin/main`.

Rewritten in place under their existing ids (a landed id keeps its meaning — the tests' subject
is the same surface): `T-WEB-S167` (index: calendar section, month heading, linked-cell hrefs
via `archiveDayRoute`, ≥1 month-chip href pinned by grammar — the workflow-discovery invariant),
`T-WEB-S168` (empty archive: sentence, no skeleton grid), `T-WEB-S182` (ragged: absent day →
inert cell, no placeholder), `T-WEB-S169` (month page: grid replaces rows; bounds/404/siblings/
metadata assertions kept; the 12-month all-caps loop extended over the grid + weekday header
using impeccable's own direct-text predicate; the stylesheet uppercase scan extended to
`.weekday`), `T-WEB-S181` (`archive-copy.test.ts`, widened in the same change as slice 6's
deletions — the T-WEB-S100 precedent, no new id: drop :49 `copy.recent.heading` and :91
`copy.dayRowAria`; add `calendar.weekdays`/`.weekdaysLong` — 7-tuples of strings — and a
`calendar.dayAria(…)` byte assertion to the reachability arm; its pt-BR scan covers the new
files, see slice 3). `T-WEB-S166` should pass untouched — every new href composes
through the route helpers; any new source-scan assertion goes through the `code()` stripper
(napkin Execution 3). `T-WEB-S221` untouched (day-card chips don't move). Stats tests
(`calendar-month`, `stats-view`) pass **unmodified** — the extraction's proof.

**New T-WEB ids needed: 6 — 3 planned + 3 review-round headroom** (unchanged by the step-4
adjustments: S181's widening reuses its landed id; the new pins all live inside test 3).
1. `month-grid` geometry unit (slice 1). 2. `archiveCalendarMonth` model (slice 2).
3. Calendar CSS geometry pin (S221 stylesheet-text idiom, S169's per-selector `block()`
   checks): 7-column arithmetic at the mobile padding (7×44 + 6×2 + 2×12 + 2 ≤ 350) **and the
   block axis** (every cell rule declares `aspect-ratio: 1`, so ≥44px holds on both axes);
   **within the calendar's own rule blocks, uppercase only on `.weekday`** (never a
   whole-sheet sweep — `.barKicker`, `.monthChip`, `.monthNavKicker`, `.cardKicker`,
   `.doneChip` carry it legitimately elsewhere); numeral rule carries `--font-ui` +
   `tabular-nums`; and `.page` declares no `display: flex` at any width — the pin for
   historical break 1 (`first-viewport-column-overflow`).
No new T-API / T-DB / T-LINT ids: no reader, route, schema or wall change of any kind
(`packages/db` byte-identical — a `git diff` criterion).

## Impeccable worst case (first-class, before the preview scan)

Both historical archive gate breaks were calendar-dated, not commit-dated; measure the worst
case, then pin it:
- **Unit pins (run before any preview):** the S169 all-caps loop over all 12 months × the full
  month page (grid, weekday header, siblings) — impeccable's predicate element by element,
  ≤30 chars of direct uppercase text; the CSS geometry pin above. These are the tests that make
  the seasonal shape diff-visible.
- **Worst-case fixtures, both viewports (390×844 and desktop 1440×900):** 2026-08 (31 days
  starting Saturday → 6 week rows, the tallest grid) and a fevereiro month (longest heading,
  17 chars); index fixture with the full chip list; sparse-month index fixture (1 linked day).
  Local repro per napkin Shell 6: throwaway vitest render of the real components + real
  stylesheets, unhash `_name_hash` classes, #35-style `file://` fixture, **repo puppeteer,
  never the MCP browser**, `document.fonts.ready` before shooting; `cream-palette` on file://
  is the stylesheet-loaded proof, dismissed with that reason; any other finding checked against
  a control fixture of the shipped composition.
- **Overflow check:** `.page` stays normal block flow at every width (do not reintroduce any
  flex/two-column shell — unit-pinned by test 3); the card, ~330–380 × ~350–420px, sits far under
  the 1.4×-viewport-height trigger, and the page gets *shorter* than the 21-row shape that
  fired. Verify on the fixtures anyway; the numbers go in the PR body.
- **Committed evidence:** before/after screenshots under `docs/evidence/163-archive-calendar/`,
  embedded in the PR via SHA-pinned raw URLs (a claim without a commit is a dead link).

## Gate & evidence plan

All commands `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&`-prefixed; real output
pasted (`--force` on typecheck/test — a turbo cache hit is a replay; `lint` takes no flag).
1. `git merge origin/main` before the gate (catches a concurrent test-id collision by design).
2. `pnpm typecheck --force`, `pnpm lint`, `pnpm test --force`.
3. `pnpm build` in `apps/web`, then `pnpm bundle-check` **from `apps/web`** — `/arquivo*`
   classification and deltas unchanged (D5's proof).
4. `Impeccable` workflow on the preview: both viewport steps ran, exit 0, silent; evidence =
   step-name-filtered log (`awk -F'\t' '$2 ~ /impeccable detect/'`) + the preflight lines
   showing the **discovered** month/day/play paths still resolve (proves D2's invariant live).
5. PR body: tier named (Tier 2), what changed, gate output inline, screenshots, the design
   calls (D1–D3) summarised with reasons; "nothing needs Fernando" stated explicitly if true
   (expected: true — no pending-ledger item foreseen).

## Exit criteria

- Both surfaces render the clickable calendar; every linked cell's href composes through
  `archiveDayRoute`; today/future/absent days inert; empty archive 200 + sentence, empty month
  404 — all pinned by tests.
- Index body still carries a `/arquivo/mes/YYYY-MM` href (test-pinned) and the workflow's
  discovered scans ran green on the preview.
- Zero client JS delta on `/arquivo*` (bundle-check output pasted); `packages/db` and
  `migrations/**` byte-identical (`git diff` shown).
- Stats calendar tests pass unmodified; full gate green with pasted output; worst-case
  screenshots committed under `docs/evidence/163-archive-calendar/`.
- Plan committed as `docs/plans/065-…` + README row; design calls recorded on issue #163;
  issue closed at step 8 only with everything green.

## Non-goals

No new DB reader/index/migration; no API surface; no client JS; no workflow edit; no changes
to the day page, play routes, OG images (#104 — stay out of `src/og/**` and index metadata),
sitemap/robots; no query-param month switching; no per-day game info in cells; no multi-month
index; no ADR; no change to today's 307s or to `force-dynamic`.

## Summary

Replace the archive's day-row lists with one shared, server-rendered, zero-client-JS calendar
grid: the month page's rows become the grid; the index shows the newest archived month's grid
(one widened 124-row bounded read) above the surviving "Por mês" chips, which keep the
impeccable workflow's URL discovery, now test-pinned. Cells are ≥44px **square**
`<Link prefetch={false}>` tiles for published past days (named "15 de agosto de 2026 —
sábado") and aria-hidden inert numerals otherwise, under an aria-hidden Sunday-first pt-BR
weekday header, tabular Instrument Sans numerals, neutral stats-register card; the month
geometry is extracted once into `src/calendar/month-grid.ts` (stats API unchanged, tests
unmodified) plus a new pure `src/archive/calendar.ts`. Six new T-WEB ids (3 planned + 3
headroom), five archive tests rewritten in place, the seasonal impeccable worst case (6-week
2026-08, fevereiro heading, both viewports) unit-pinned before the preview scan and evidenced
by committed screenshots; no ADR is needed — D6 records the sentence-level audit that says so.

## Step-4 changelog (2026-08-21; review `163-step3-review.md`, ACCEPT-WITH-ADJUSTMENTS)

All eight findings applied; none disputed. **Test-id count unchanged: 6 new T-WEB ids
(3 planned + 3 headroom), zero new T-API/T-DB/T-LINT.**

1. **F1** — frontier paragraph replaced: ids come from the on-issue #163 reservation, frontier
   re-derived by grep; per the orchestrator's stricter direction, no numbers stated anywhere.
2. **F2** — `T-WEB-S181` added to the rewritten-in-place list (drop :49/:91, widen the
   reachability arm; no new id); pt-BR-scan note added to slice 3; D2 cross-references it.
3. **Adj. 3** — every cell rule gains `aspect-ratio: 1` (stats idiom); test 3 pins both axes.
4. **Adj. 4** — uppercase assertion scoped to the calendar's rule blocks (S169 `block()` idiom).
5. **Adj. 5** — accessible name gains the weekday via `calendar.dayAria` + `weekdaysLong`
   ("15 de agosto de 2026 — sábado"); no Intl formatter; recorded on the issue.
6. **Adj. 6** — test 3 also pins `.page` declares no `display: flex` (historical break 1).
7. **Adj. 7** — the off-scale 2px gap gets a sheet arithmetic comment (`.doneChip` precedent).
8. **Adj. 8** — review corrected: the `--ink-2` 5.3003:1 figure IS recorded (stats sheet
   :228/:375); applied as asked — step 5 copies it to `.dayCellInert` and re-verifies.
