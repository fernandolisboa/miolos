# ADR-0026 — Completions are write-once rows; "on time" is derived, never stored

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md)
**Amended by:** [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md) — the merge-repoint consequence's sufficiency claim is corrected: the ordered `ON CONFLICT DO NOTHING` repoint ALONE does not deliver *"the surviving row is the earliest completion"* when the winning account already holds a LATER row for the same (game, date) — the conflict fires and `DO NOTHING` keeps the later row. ADR-0049 decision 2 adds the strictly-earlier DELETE that completes it; the sentence's ordering prescription (`completed_at` ascending, copied) stands.
**Amended by:** [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — decision 6's **lower** bound is removed and its Rejected entry on rate limiting is **reversed** for one branch. Four sentences fall: *"A write may only target SP-today or SP-yesterday"*; *"Without a lower bound any client could write a `won` completion for every past daily … and a stale local record would flush as a completion the player never played"* (which now happens, deliberately); *"One day of slack is what keeps decision 7 from losing legitimate rows"* (no write-side slack survives — the calendar's one-day clamp does, under its own name); and the abuse posture's *"decision 6 caps the date axis at two days"*, replaced by a per-user-per-São-Paulo-day ceiling of 50 archive completions answering `429`. The consequence written about #31 by name stands as a warning and its risk claim is superseded: #31 does **deliberately** what *"Widening it accidentally — by removing the bound while 'fixing' a date test"* names as the accident, with the cost restated (ADR-0053 decision 5) rather than left standing. The Rejected entry *"**Application-level rate limiting on the write, in v1.** Considered and declined"* is **implemented** for the late branch only; the daily branch still ships none. Unchanged: the composite PK, `on_time` derived in SQL, the database clock as the completion instant, the replay short-circuit, and decision 6's layer rule that the write bound lives in the route and never in `wallPredicate`. Multiple `Amended by:` lines stack.
**Amends:** the mint-flood consequence of [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md) — *"Accepted because flood-minted rows are unreferenced and harmless, and Vercel's platform firewall is the backstop."* Flood-minted users can now write rows that are referenced by streak arithmetic; see Consequences.

## Context

[ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
defined the three verbs and left the table to the ticket that first has to
write one: per (user, puzzle) a completion records when it was completed,
the puzzle's own date, and the outcome — and *"'On time' is derivable —
`completed_at` falls within the puzzle's `America/Sao_Paulo` day — and must
stay derivable, because [ADR-0009] recomputes streaks from these rows."*
ADR-0008 also states plainly that *"The row is written once — a loss
followed by an archive replay does not reopen the daily."*

Issue #18 is that ticket. It is also the repo's first **authenticated
write** of any kind: everything before it was a public read
([ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md))
or an identity mint
([ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md)). Five
things were schema-shaped or contract-shaped and had to be settled before
rows exist in production:

1. what makes "written once" **mechanical** rather than a code convention;
2. where `on_time` lives, given that ADR-0009 recomputes from these rows
   and a stored value would be a cache;
3. what an idempotent replay returns — the client that retries is an
   offline queue, not a human;
4. where user-scoped tables sit in the `packages/db` surface ADR-0024
   built, now that `apps/web` holds the database dependency
   ([ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md),
   as extended by [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md));
5. what date range a write may target, since `getPublishedDailyWithSolution`
   carries a published-predicate but no lower bound.

## Decision

1. **Exactly once is the primary key.** `completions` has the composite
   primary key `(user_id, game, date)` and every insert is
   `ON CONFLICT DO NOTHING`. The write-once rule ADR-0008 states in prose
   becomes a constraint the database enforces; no route, no service and no
   future caller can weaken it without a migration.

2. **`on_time` is derived in SQL, never stored.** The definition, in one
   place and one language:

   ```sql
   (completed_at at time zone 'America/Sao_Paulo')::date = date
   ```

   It is computed in the read-back projection, not persisted. No JavaScript
   timezone arithmetic exists anywhere on this path, and no column can drift
   out of agreement with the rows it summarizes.

3. **The completion instant is the database clock.** `completed_at` is
   `defaultNow()`; the request contract carries **no timestamp at all**.
   Accepting a client instant would put the client clock into streak
   arithmetic, which CLAUDE.md forbids outright and which
   [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md)
   already settled for the publication side.

4. **A replay is a success, not a conflict.** `POST /completions` reads the
   existing row **before** the wall read and **before** it judges the grid,
   and returns `200` with `recorded: false` plus the **stored** values. An
   honest replay must never be re-judged: after a `killed_at` the wall read
   would 404 a completion the server actually holds, and a replay whose grid
   differs — a partially restored local record, a second device — would 422
   a row that already exists. `409` was rejected for the same reason: to the
   offline queue, an idempotent retry has to look like success or it never
   clears.

5. **User-scoped tables live on `@miolos/db/user`.** `completions` and
   `hint_grants`, their readers and their writers are reachable only through
   that subpath, which only `apps/api` and tests may import. The root
   `@miolos/db` entry is unchanged, so `apps/web` — which now holds the
   database dependency — cannot **name** these tables through the entry it
   is allowed to have. This is ADR-0024's surface rule applied to the first
   write surface: mechanical, not conventional.

6. **A write may only target SP-today or SP-yesterday, bounded in the route
   and not in SQL.** `POST /completions` reads `todaySaoPaulo(db)` — the
   database clock, never `new Date()` — and rejects
   `body.date < today - ACCEPTED_DAYS_BACK` with `404` *before* the wall
   read. `getPublishedDailyWithSolution` deliberately keeps no lower bound
   of its own: the wall predicate answers *"may this row be shown at all"*
   (published, unkilled, not future), which is a different question from
   *"may this caller claim this day"*, and `getTodayDaily` and
   `getPublishedDaily` share that predicate and must not inherit a
   write-side bound. **The lever the archive ticket (#31) widens is
   therefore the route constant `ACCEPTED_DAYS_BACK`, not `wallPredicate`** —
   widening the predicate instead would leave the route's own bound in force
   and 404 every archive write before the widened SQL is ever consulted.
   Without a lower bound any client could write a `won` completion for every
   past daily — permanently, since decision 1 never reopens a row — and a
   stale local record would flush as a completion the player never played.
   One day of slack is what keeps decision 7 from losing legitimate rows.

   **Amended at #31 — the LOWER bound is gone
   ([ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decisions 5 and 6).** A write may now target any day up to and including
   the São Paulo today; the archive is every published past day and the wall
   is the only authority on which those are. Three sentences above become
   false: *"SP-today or SP-yesterday"*, the *"Without a lower bound"* warning
   (that is now the shipped behaviour, accepted with its cost written out —
   the Termo guess route is an answer oracle at the cost of one authenticated
   request, the grid solvers run locally in a fraction of a millisecond, and
   what forgery buys is `solved` totals and ten volume medals, on ADR-0006
   `:51`'s own terms), and *"One day of slack"* — no write-side slack
   survives. **What this decision actually protects is untouched:** the bound
   still lives in the route and never in SQL, and `wallPredicate` still
   carries no write-side bound. The one-day slack survives as a **separate
   constant with a single owner**, the stats calendar's range clamp
   (`ROLLOVER_SLACK_DAYS`), because feeding the widened write window into
   that clamp would paint fabricated `"missed"` days. And the volume the
   lower bound was implicitly capping is now capped explicitly, by rate
   rather than by date: ADR-0053 decision 13.

7. **A completion synced after the rollover derives as late** — the window
   decisions 3 and 6 open together, stated rather than discovered. Solve at
   23:58 offline, reconnect at 00:05, and `completed_at` is the server write
   instant, so the day derives `on_time: false`. This contradicts issue
   #18's own *"a connection drop mid-puzzle never costs the day"* and is
   **escalated to Fernando as issue
   [#58](https://github.com/fernandolisboa/miolos/issues/58)** rather than
   resolved by the agent (plan 017 §16). It ships as written pending his
   call; the alternative — deriving
   against `greatest(completed_at, puzzle_day_start)` within a bounded
   grace, or clamping a client attestation into `[now() - grace, now()]` —
   is an additive change to the derivation expression and its tests, and it
   changes ADR-0008's definition of on-time, so it belongs to him.

## Rejected

- **`ON CONFLICT … DO UPDATE` (upsert).** The obvious idiom and the wrong
  one: an upsert bumps `completed_at`, which silently converts an on-time
  completion into a late one on any retry that crosses the rollover. The
  bug would be invisible in code review and visible only as a broken streak.
- **A stored `on_time` (or `is_late`) boolean.** Cheaper to query and free
  to get wrong. ADR-0009 recomputes streaks from these rows, so a
  denormalized column is a cache of a value the row already contains; there
  is no cache, and the SQL derivation stays the definition.
- **A surrogate `id` plus a unique index on `(user_id, game, date)`.** Same
  guarantee, one more column and one more index, and it invites a second row
  to be inserted "temporarily". The composite PK also covers the
  `(user_id)` and `(user_id, game)` prefixes for free.
- **`409 Conflict` on a replay.** Semantically defensible for a human
  client, actively harmful here: the caller is a retry queue whose control
  flow *is* the status code, and a status it must special-case as "actually
  fine" is a status that will eventually be handled as a failure.
- **A client-supplied completion instant** (or an "offline finished at"
  field taken at face value). It is the one input that would make a streak
  forgeable with a system-clock change, for a product whose core mechanic is
  the streak.
- **Application-level rate limiting on the write, in v1.** Considered and
  declined with its reasoning recorded below, not skipped.
  *(**REVERSED at #31**, for one branch —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decision 13 ships exactly this: `POST /completions` refuses a **late**
  write with `429 archive-cap` once the caller holds 50 late completions
  written on the current São Paulo day. It ships because decision 6's lower
  bound — the "decision 6 caps the date axis at two days" leg of the posture
  below — is what this entry's reasoning rested on, and #31 removes it. The
  **daily** branch still ships no rate limit at all, and 429 is deliberately
  not a terminal status for the sync queue, so a capped record survives and
  lands after the next rollover. This is the repo's first shipped
  application-level rate limit, which fires ADR-0022 `:69-75`'s revisit
  trigger on a cause its own text did not anticipate.)*

## Consequences

- **The ADR-0009 merge inherits a conflict, and its resolution is fixed
  here.** Re-pointing the losing account's rows is now a CONFLICT operation.
  The merge re-points with
  `ON CONFLICT (user_id, game, date) DO NOTHING` **after ordering the source
  rows by `completed_at` ascending**, so the surviving row is the earliest
  completion — exactly ADR-0009's *"the earliest completion wins"* — and a
  merge can never downgrade an on-time completion to a late one. Any other
  order silently violates both ADRs.
- **One enforcement point ships; the second is a filed follow-up, and this
  ADR does not claim it exists.** What ships in #18 is the **module-graph
  wall**: `completions`/`hint_grants` live off the root entry (decision 5),
  `apps/web` carries ESLint `no-restricted-imports` bans on
  `@miolos/db/publishing`, `@miolos/db/user` and `@miolos/db/testing` plus
  table-name literal bans, and `apps/web/src/db.ts` carries
  `import "server-only"` so a `"use client"` module cannot walk around any
  of it. A **second, independent** enforcement point was designed — a
  least-privilege `miolos_web` Neon role holding `usage on schema public`
  and `select on daily_puzzles` and nothing else — and is **deferred to
  issue [#59](https://github.com/fernandolisboa/miolos/issues/59)** (plan
  017 §5.3, §20). It is deferred because
  `DATABASE_URL` on the `miolos-web` Vercel project is managed by the
  Neon–Vercel integration across Production, Preview and Development;
  hand-overwriting it risks a silent re-sync reverting the credential, which
  would make a "two independent enforcement points" claim quietly false
  while reading as true — worse than not making it. Until #59 lands, the
  database grant is **not** a second layer, and no reviewer should read one
  into this ADR; #59's own acceptance criteria require this ADR to be
  amended only once the grant is live.
- **ADR-0022's flood-mint posture is falsified and restated.** That ADR
  accepted an unthrottled mint *"because flood-minted rows are unreferenced
  and harmless"*. They are no longer unreferenced: a minted user can now
  write completion rows, and completion rows are what streaks are computed
  from. The posture is nonetheless **accepted for v1, deliberately**: the
  composite PK caps rows at one per (user, game, date), decision 6 caps the
  date axis at two days, and each request costs one jsonb wall read plus one
  insert — so the only uncapped axis is minted-users × 2 days, with Vercel's
  platform firewall as the backstop. This is the same cost/availability
  posture ADR-0024 recorded for the public reads, now extended to a write.
  **Revisit trigger:** the first abuse signal, or the rewarded-ad ticket
  (which adds a grant write), whichever comes first.
  *(**Amended at #31** —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decisions 5 and 13. The middle leg of this posture, *"decision 6 caps the
  date axis at two days"*, is deleted: the date axis is now the whole
  archive. The other two legs stand. What replaces it is not a platform
  backstop but an application-level ceiling — 50 late completions per user
  per São Paulo day, `429 archive-cap` — so the uncapped axis becomes
  minted-identities × 50 rather than minted-identities × the archive.
  Verified at #31 that no substitute existed to inherit: no middleware in
  either app, no firewall rules in either `vercel.json`, no rate-limit
  dependency, and session minting still unthrottled. The trigger is now
  observable rather than aspirational — the first `429 archive-cap` in the
  logs is the signal, and it separates a marathon player from a script.)*
- **The late-by-sync window is real and unresolved** (decision 7). Whatever
  Fernando decides, the schema, the route and the client are identical under
  both options — so this ADR does not block on it, and the decision is
  [#58](https://github.com/fernandolisboa/miolos/issues/58), filed before
  merge rather than after and carrying both options in full.
- **The archive ticket (#31) widens decision 6's route constant
  deliberately**, with its own tests and its own `late` semantics
  (ADR-0008). Widening it accidentally — by removing the bound while
  "fixing" a date test — reopens the whole past calendar to forged
  completions, so the bound carries its reason in the route's own comments
  as well as here.
  *(**Amended at #31** —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decisions 5, 6 and 13. #31 did not widen the constant: it **deleted** it,
  splitting the two ideas it held into `ROLLOVER_SLACK_DAYS` (the stats
  calendar's clamp, value unchanged) and `isWritableDate` (the write window,
  upper bound only), one owner each. So the paragraph's own worst case — the
  whole past calendar open to forged completions — is now the shipped
  behaviour, **deliberately** rather than by the accident this sentence
  names. Its risk claim is not left standing: ADR-0053 decision 5 states what
  forgery actually buys (`solved` totals and ten volume medals — never the
  streak, a time statistic, a Termo bucket or Dia Perfeito) and accepts it on
  ADR-0006 `:51`'s terms, while decision 13 caps the volume. The
  carries-its-reason instruction survives and is executed: the route's
  comment now cites ADR-0053 rather than this paragraph.)*
- **#23 / #25 / #27 attach rather than migrate.** `outcome` accommodates
  `'lost'` from day one for Termo, `game` is the request union's
  discriminator, and the route is game-generic; the grid games are expected
  to add a contract variant and nothing else.
- **Every write stays in `apps/api`.** ADR-0014's *"all writes and the cron,
  without exception"* is untouched by ADR-0028's read-side extension;
  `apps/web` posts to the API for this, and only for this.
