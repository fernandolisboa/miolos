# Plan 059 — Issue #58: late sync credits from a server-seen day; on-time is stored at write

**Tier 2** (schema change, contract-adjacent, needs an ADR). Step-2 plan, revised at step 4 per the
step-3 review. The product decision is **made** — Fernando's 2026-08-02 comment on #58; nothing here
reopens it. The 2026-08-19 triage correction relabelled the issue `ready-for-agent` and reserved the
test ids this plan spends.

**The rule (verbatim substance):** the server records that a user was online on São Paulo date `D`
(one row per user per day). A completion for `D` that syncs after the rollover is credited to `D`
**iff** that record exists. No record → the completion still lands as **played/late** (ADR-0008's
existing verbs), never for the streak or Dia Perfeito. Guard: refuse a sync carrying completions for
more than one distinct past **date** (dates, not games — three grid games for one date is legitimate).
The credit window stays one day back (his "`ACCEPTED_DAYS_BACK` stays 1"). Constraint 1 (ADR-0009):
the on-time decision is made **once, at write time, and stored on the completion row**, so the streak
stays derivable from completion rows alone.

**The plan's invariant sentence:** *the seen-days table is consulted exactly once per completion, at
write time, inside `POST /completions`; no streak, statistics, medal or day-state computation reads it,
and the pure merge recompute (`mergeCompletions`) never consults it — `mergeAccounts`'s §5 union moves
rows, it computes nothing — so a streak remains derivable from completion rows alone (ADR-0009, untouched).*

**Abuse story (two lines):** future content does not exist before its São Paulo midnight (ADR-0004's
wall), so holding day `D+1`'s puzzle requires being online on `D+1` — which writes that day's seen row
and makes an honest sync possible. Going dark banks at most one day (`D`) and forfeits every day spent dark.

## 0. Sequencing and numbering (preflight)

- **Blocked on #145's migration landing on `main` and being applied to Neon** (parallel journal
  entries collide — the on-issue reservation). If #145 has not merged when step 5 starts, **stop and wait**.
- Numbering assumptions, re-derived at step 5 against `main`:
  - **Migrations:** journal at `0006`; #145 takes `0007`; this ticket **`0008`** + post-deploy **`0009`** (§1.3).
  - **ADRs — no constant.** The map already shifted once: #140 landed ADR-0062 on 2026-08-19 while
    #145's plan said 0062 (its implementer was instructed to shift). This ticket's ADR — **"the #58
    ADR"** everywhere below — takes the next free number at ITS step 5, re-derived after
    `git merge origin/main` against every unlanded plan/issue holding a number claim (plans 058/060,
    #145, #140), coordinating with #145's implementer. Plans are snapshots.
  - **Plans:** `docs/plans/059` (reserved on the issue); its `docs/README.md` row ships in the PR.

## 1. Schema (migration `0008`, applied to Neon BEFORE the branch's first push)

### 1.1 `user_seen_days`

New table in `packages/db/src/schema.ts`, user-scoped, reachable only via `@miolos/db/user`
(ADR-0026 decision 5). CONTEXT.md gains the term **Seen day** (§7).

- `user_id uuid not null references users(id) on delete cascade`
- `date date not null` (string mode; the São Paulo calendar day — the `completions.date` idiom, no neologism)
- `primary key (user_id, date)` — idempotency is the PK, the completions pattern.
- **No other column.** A row is the whole fact. A `first_seen_at` timestamp was rejected: zero readers
  (unread surface is a standing HIGH finding), and the §5 union needs none — `ON CONFLICT DO NOTHING` suffices.

### 1.2 `completions.on_time`

- Drizzle schema: `onTime: boolean("on_time").notNull()` — **no default in the schema object**, so every
  writer must decide (drizzle builds INSERT column lists from the table; the `guesses` precedent).
- Migration `0008` (hand-shaped, breakpoint-separated, each statement idempotent — no transactions over neon-http):
  1. `alter table completions add column if not exists on_time boolean not null default false;` (metadata-only)
  2. Backfill, **one-directional**: `update completions set on_time = true where not on_time and
     (completed_at at time zone 'America/Sao_Paulo')::date = date;` — equivalent to the full derivation
     here (every pre-existing row starts at the default `false`) and re-run-safe forever: it only
     promotes `false → derived-true`, never the reverse — it can never destroy a credit (a credit IS a
     stored `true` where the derivation says false). It is 0009's sweep, the same statement, deliberately.
  3. `create table if not exists user_seen_days (…);`
- The DB `default false` is deliberate and temporary: previews share the production database, so until
  the production deploy **old production code** keeps inserting without the column; the default keeps
  those inserts legal and §1.3 repairs them.

### 1.3 Migration `0009` — post-deploy repair (committed in the same PR, applied AFTER the production deploy)

1. The same one-directional sweep as 0008's statement 2 — exact by construction: new code never stores
   `false` where the derivation is true, so it touches precisely the old-code window rows; credits untouched.
2. `alter table completions alter column on_time drop default;` — from here a writer omitting the column
   fails loudly instead of silently storing `false` (drizzle's no-default object and T-DB-S24's
   column-list pin cover code writers; `DROP DEFAULT` covers hand-written SQL).

**The visible window, stated honestly (and in the PR body's apply story):** between the production
deploy and the 0009 apply, new readers project the stored column, so daily rows written by OLD code in
the 0008→deploy window (stored `false`, derivation true) read as *late* — streaks can visibly dip. It
lasts one deploy cycle (0009 is a named operator step applied immediately post-deploy, hence urgent)
and self-heals: the sweep promotes exactly those rows and the next streak read recomputes.

### 1.4 Backfill semantics

Backfilled `on_time` equals the **current read-time derivation** (`onTimeSql()`) — old rows keep
exactly the meaning every reader gave them; the credit applies only forward (`user_seen_days` starts
empty, so the first creditable flush follows the first full São Paulo day in production; failure
direction is the status quo, late, never a false credit). Equivalence pinned by T-DB-S73 (§8).

## 2. Recording seen days (the write points)

**Three hooks in `apps/api/src/session/service.ts`: `resolveSession`, `mintSession` and
`createSessionForUser`.** Every authenticated request funnels through `resolveSession` (via
`requireUserId` or the session routes) **except** attach-confirm, whose `createSessionForUser` mints
the clicking browser's session directly — the click proves presence, so it is the third write point.
One softened edge: puzzle pages are served by `apps/web`'s direct DB read (ADR-0014) and the session
bootstrap is a separate request, so a page load whose `ensureSession` failed can leave a day
unrecorded — failure direction is the status quo (late), a later sync needs the cookie anyway; residual accepted.

- New `packages/db/src/seen-days.ts` (exported from `@miolos/db/user`): `recordSeenDay(db, userId)` →
  `insert into user_seen_days (user_id, date) values ($1, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;` — the **DB clock names the day** (ADR-0010; no JS date math on the path).
- All three hooks await it — `resolveSession` after a successful hash lookup, `mintSession` after its two
  inserts, `createSessionForUser` after its insert. Awaited, not fire-and-forget — an error is the request's 500.
- **Rejected:** gating on the 1-hour `last_seen_at` staleness send-gate — it under-records exactly the
  23:58→00:05 persona (a day's requests can all fall within an hour of a pre-midnight bump).
  **Rejected for v1:** the data-modifying-CTE fold and a per-instance `(userId, spDay)` memo —
  unmeasured wins on the hottest read; both in the #58 ADR as the seam if the +1 round trip shows up.
- Reader: `wasSeenOn(db, userId, date)` — a PK-point `exists` read, same module; consumed only by
  `POST /completions` (the invariant sentence).
- **Retention (decided, in the #58 ADR):** only `today − 1` is ever read, so older rows are dead weight
  (~365/user/year, unioned forever by §5): one idempotent delete (`date < (now() at time zone
  'America/Sao_Paulo')::date - 1`) joins the existing daily `/cron/publish` route, wrapped so its
  failure logs without masking the publish result. Widening the credit window widens this predicate too.

## 3. The write-time on-time rule

### 3.1 The pure rule (packages/core)

New pure function, e.g. `onTimeAtWrite` in a small `packages/core/src/on-time.ts` (exported from the
root entry; no new dependency): given `(date, today, seenOnDate)` →

- `date === today` → `true` (identical to the old derivation: `completed_at` is the DB clock at insert).
- `date` exactly **one day back** (the existing `epochDay` helper — pure calendar math) **∧** `seenOnDate` → `true` (the credit).
- otherwise → `false` (played/late — archive writes and unseen late syncs alike).

The window constant lives beside it (`LATE_SYNC_CREDIT_DAYS_BACK = 1`, one owner, a comment separating
it from `ROLLOVER_SLACK_DAYS`/`isWritableDate` — the #31 lesson). Widening it is an ADR amendment, never a tweak.

### 3.2 The route (`apps/api/app/completions/route.ts`)

After the wall read and the judge, before `recordCompletion`:

- `today` is already read once via `todaySaoPaulo(db)` — reuse it (its comment already promises this).
- If `isLateDate(body.date, today)`: `seen = isCreditWindowDate ? await wasSeenOn(db, userId, body.date) : false`.
- `onTime = onTimeAtWrite(body.date, today, seen)` joins `input` — and decides the ceiling arm (§3.3).
- **The guard (multi-past-date refusal):** when the write would store `on_time = true` for a **past**
  date, first check `hasCreditedPastDateToday(db, userId, today, body.date)` — a row with
  `on_time = true`, `date < today`, `date <> body.date`, written on the current SP day
  (`writtenOnSaoPauloDay(today)`, existing predicate)? If yes → **422 `multi-date-sync`**, no row.
  - Why this shape: each POST carries one completion, so "a sync" is invisible server-side; the
    enforceable form is *per user per writing day, at most one distinct past date is ever credited* —
    exactly his "at most one day banks". Archive/late writes claim no credit and are untouched
    (ADR-0053's ceiling legitimately spans many distinct dates).
  - 422 is already terminal in the sync client (`TERMINAL_STATUSES`) — no client change. Under
    window = 1 the shape is **unreachable for ANY client**, honest or not: a stored `true` on a past
    date is only produced for exactly `today − 1`, one such date exists per writing day, same-date is
    excluded, and backfilled trues fail `writtenOnSaoPauloDay(today)`. The guard ships as a deliberate
    **widening tripwire** (dead code by design — say so in its comment so step 6 doesn't flag it;
    T-API-S139's raw seed is a state production cannot produce).
  - Read-then-act is accepted **with the reason in the route comment and the ADR**: under a 1-day window
    a concurrent double-credit of two distinct dates is structurally impossible; the ADR carries the
    revisit trigger — *any widening must fold this guard into the insert* (the step-6 F1 precedent).

### 3.3 `recordCompletion` (`packages/db/src/completions.ts`)

- `input` gains required `onTime: boolean`; both arms store it verbatim — `.values({... onTime})` on the
  daily arm, the value joining `guardedInsertSelect`'s select list (its doc block promises the loud red).
- **A credited write is EXEMPT from the archive ceiling.** Exact predicate: the route passes the ceiling
  option (`{ day, max }`) only when `onTime === false`; an `onTime === true` write always takes the
  plain-values arm, never `guardedInsertSelect`. Without the exemption a player at the ceiling (50
  archive rows today; device B holding yesterday's daily) 429s the credited flush — 429 is correctly
  non-terminal, so it retries after the next rollover, lands two days back, and stores `false`: a
  permanently lost streak day on a write-once row, the exact outcome #58 exists to prevent (and the
  corner that would falsify §7's "#18 made true" claim). Safe: the credit is server-derived and
  unforgeable (a seen row plus the 1-day window, never client input), bounded ≤3 rows/user/day by
  construction (one creditable date; three grid games; Termo cannot be offline, ADR-0039). Reasoning
  recorded as a decision item in the #58 ADR.
- For the arm it still guards, the ceiling's count predicate flips from `not (onTimeSql())` to `not on_time`.
- `onTimeSql()` is **deleted** once no reader uses it (§4); its doc block already names #58 as doing this.

## 4. Read-site flip (inventory by grep, `onTimeSql`)

All four projections flip to `onTime: completions.onTime`; nothing downstream changes shape:
`getCompletion`, `listCompletionsForStreak`, `listCompletionsForDay` (`packages/db/src/completions.ts`);
`listCompletionsForStats` (`stats.ts`); `listCompletionsForMerge` (`merge.ts`); plus
`guardedInsertSelect`'s count predicate (§3.3).

`packages/core` is untouched as a consumer: `computeStreak`, `computeStats`/`computeCalendar`,
`dayStateFromRows` and `mergeCompletions` all take `onTime` as row data already (ADR-0048's consequence
names #58 as "changes the producer and nothing in this ADR"). Wire contracts unchanged.

## 5. Merge duties (`packages/db/src/merge.ts`)

- The completions **repoint** (statement ii) adds `on_time` to its explicit column list — copied, never
  recomputed. `T-DB-S24` (the mechanical column-list tripwire) reds on the migration until this lands;
  `merge.ts`'s comments already reserve the seat ("#58's stored on_time joins this list").
- **`user_seen_days` merges by union** (ADR-0049's extension point, the completions idiom):
  `insert into user_seen_days (user_id, date) select winner, date from user_seen_days where user_id =
  loser on conflict do nothing;` then `delete` the loser's rows ("emptied means EMPTIED"). Individually
  idempotent; recorded in the #58 ADR and as an additive note on ADR-0049.
- **A falsified corner, recorded not patched:** ADR-0026's "a merge can never downgrade an on-time
  completion to a late one" was a theorem of the derivation; with the credit, an earlier **late** row
  (archive, unseen) beats a later **credited** row for the same puzzle and earliest-wins keeps the late
  one. Fernando's "needs no special case" — keep earliest-wins, amend the ADR-0026 sentence, pin it
  (T-CORE-S106); the #58 ADR says in one sentence that a merge can thus visibly break a streak the
  user saw (so support isn't surprised).

## 6. Client: no change — verified, not assumed

Step 5 verifies the decision's "schema/route/client identical" claim: request schema unchanged;
`completionResponseSchema` already carries `onTime: z.boolean()`; 422 terminal and 429 non-terminal in
`apps/web/src/play/sync.ts`; the date-descending flush order already posts yesterday's daily ahead of
stale archive records. Termo cannot be played offline (ADR-0039), so the beneficiaries are the three
grid games. No UI change → `npx impeccable detect` is not triggered (say so in the PR body).

## 7. Records (all in the implementing PR, same diff as the code)

- **The #58 ADR (new, short; number per §0): "A late sync is credited from a server-seen day; on-time
  is stored at write."** Decision items: the table, its write points and its retention rule (§2); the
  pure write-time rule and the 1-day credit window; the credited write's ceiling exemption with its
  429-loses-the-day reasoning (§3.3); the guard and its per-writing-day reading of "one sync";
  storage-as-authority (backfill = old derivation; credit forward-only); the merge union, downgrade
  corner and visible-streak-break sentence (§5); the CTE-fold and guard-fold revisit triggers. Lands
  `Proposed`, flipped to **Accepted** in the same PR (domain.md lifecycle). Carries
  `**Amends:**` lines; each amended ADR gets the reciprocal `**Amended by:**` **in the same commit**:
  - **ADR-0026** — decision 2 ("derived in SQL, never stored") and the Rejected "stored `on_time`
    boolean" entry are reversed (ADR-0009's constraint forces storage once the seen-fact enters the
    definition); decision 7's escalation resolved; "merge can never downgrade" gains the §5 corner.
  - **ADR-0008** — *"'On time' is derivable … and must stay derivable"* is falsified (now decided at
    write and stored; what stays true is ADR-0009's actual constraint, which the sentence was serving);
    the on-time verb's definition gains the credit clause.
  - **ADR-0009** — conclusion unchanged; additive `Amended by:` (its header already anticipates "#58's
    queued amendment … additive"): seen-days are write-time-only, the invariant sentence verbatim.
- **Annotation sweep** for prose the flip falsifies (committed docs only; plans/handoffs are snapshots —
  handoff 058 §10 and plan 054's stale framing are already corrected by the issue's triage comment):
  - ADR-0060 ("a projection of the one `onTimeSql()` derivation") and ADR-0031 consequence (a)
    ("`on_time` is derived in SQL") → annotated (stored column).
  - `packages/db/src/schema.ts` completions doc block ("On time is DERIVED, never stored") and the
    `completions.ts` header/doc blocks → rewritten with the new rule and #58-ADR citations.
  - `packages/core/src/stats.ts` `todayTermoGuesses` comment: its invariant ("a won row dated today is
    on time") **stays true** under the write rule; only the justification sentence is reworded.
  - CONTEXT.md: new **Seen day** row; **Completion (on time)** gains the credit clause; **Late-write
    ceiling** follows the stored column and the exemption. Grep for stale "on-time is derived" spellings.
- **#18's promise** (*"a connection drop mid-puzzle never costs the day"*) is **made true**: ADR-0026
  decision 7 quoted it as contradicted; the #58 ADR and the 0026 amendment close it. ADR-0004's
  offline paragraph is unaffected.
- `docs/README.md` rows for plan 059 and the #58 ADR; test-id frontier re-derived at step 8.

## 8. Test plan (the reserved ids; unspent tails burn)

- **T-CORE-S105** — `onTimeAtWrite` truth table: today → true; one-day-back ∧ seen → true;
  one-day-back ∧ unseen → false; two-plus days back → false even when seen.
- **T-CORE-S106** — `mergeCompletions` treats `onTime` as data: the §5 corner pinned as accepted earliest-wins.
- **T-DB-S71** — `recordSeenDay` idempotent: called twice on one SP day → one row, dated by the DB clock.
- **T-DB-S72** — both arms store the supplied `onTime` verbatim and every reader projects the stored
  value, not a derivation — pinned by a row whose stored `on_time` contradicts the old derivation.
- **T-DB-S73** — backfill equivalence: seed manipulated-`completed_at` rows (on-time and late shapes),
  run 0008's UPDATE on PGlite, assert stored `on_time` equals `onTimeSql()` on every row (a pin — ADR-0023).
- **T-DB-S74** — merge unions seen days: winner gets the loser's dates, overlaps conflict-away, loser
  emptied, re-run is a no-op (T-DB-S20's double-run posture).
- **T-DB-S75** — a credited row written today does not consume the ceiling (`not on_time` count), and
  a user AT the ceiling still lands the credited flush — the §3.3 exemption pinned at the ceiling, not
  just the count.
- **T-API-S137** — the credit end-to-end: seed a seen row for yesterday, sync yesterday's completion
  today → 200 with `onTime: true`, and `GET /streak` counts the day.
- **T-API-S138** — no seen row → 200, recorded, `onTime: false`; streak and Dia Perfeito unmoved.
- **T-API-S139** — multi-past-refusal: seed (raw, via the testing helpers) a credited past-dated row
  written today for another date, POST a creditable completion → 422 `multi-date-sync`, no row.
- **T-API-S140** — presence at the seam: an authenticated request leaves exactly one `user_seen_days`
  row for the DB clock's today; a second adds none; attach-confirm (`createSessionForUser`) records too.
- **T-WEB-S283** — the sync client posts a queued yesterday record unchanged and settles on the 200
  (response schema already carries `onTime` — the no-client-change pin).
- **T-WEB-S284** — a 422 from the route settles the record as rejected with no retry (already terminal).
- **T-WEB-S285** — headroom for review rounds; burned if unspent.

Existing pins expected to red-then-green: `T-DB-S24` (repoint column list), the `packages/db`
column-set pins in `test/user.test.ts`, and source-scans over the new doc blocks (`code()` stripper — napkin rule).

## 9. Build order

1. **Step 0:** confirm #145 merged and its migration applied; re-derive migration/ADR/plan numbers.
2. Branch `feat/58-late-sync-seen-days`. Write migrations 0008 + 0009; **apply 0008 to Neon before the
   first push** (the temp-script-over-`@neondatabase/serverless` ritual, env pulled outside the repo).
3. Schema + `packages/core` pure rule + `packages/db` (seen-days module, `recordCompletion`, reader
   flip, merge statements) — TDD at these seams (`/implement`).
4. `apps/api`: the three session-service hooks; route credit + guard + ceiling-arm choice; the cron
   retention delete.
5. Docs: the #58 ADR, amendments, CONTEXT.md, README rows, doc-block sweep.
6. Gate with pasted output (`--force` for evidence), six step-6 lenses, fixes, merge; **apply 0009 after
   the production deploy** and paste that evidence into the PR as a follow-up comment.

## 10. Landmines

- **No transactions over neon-http; PGlite has no batch** — every migration statement and merge
  statement individually idempotent; the guarded insert stays one statement.
- **Previews share the production DB** — 0008 before first push; interim default and 0009 repair: §1.2–1.3, told once.
- Do not let the credit leak into `wallPredicate`, `isWritableDate` or the stats calendar's clamp —
  three different questions, three owners (the #31 lesson).
- `pnpm` via nvm prefix; a red in an untouched package is a finding; frontier grep before allocating
  (expect a merge-time collision, resolve by moving unlanded ids only).

## 11. Exit criteria

- Gate green with real output; all reserved ids spent or burned; frontier re-derived at step 8.
- The #58 ADR Accepted in the shipping PR; reciprocal `Amended by:` on **ADR-0008, ADR-0009 and ADR-0026**
  (not migrations 0008/0009), plus the ADR-0031/ADR-0060 annotations and CONTEXT.md rows, in the same diff.
- 0008 applied pre-push with evidence; 0009 documented and applied post-deploy with evidence.
- The invariant sentence verified by review: no reference to `user_seen_days` outside `seen-days.ts`,
  the session service, `POST /completions`, `mergeAccounts` and the cron delete.
- Post-merge tier check: if this PR's process artifacts outweigh its diff, say so in the handoff.
