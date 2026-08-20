# ADR-0066 — A late sync is credited from a server-seen day; on-time is stored at write

**Status:** Accepted — 2026-08-20 (issue #58, shipped in #PRNUM)
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
**Amends:** [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md) — decision 2 (*"`on_time` is derived in SQL, never stored"*) and the Rejected entry *"A stored `on_time` (or `is_late`) boolean"* are **reversed**; decision 7's escalation is resolved; the merge consequence's *"a merge can never downgrade an on-time completion to a late one"* gains a falsified corner (decision 7 below).
**Amends:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md) — the consequence sentence *"'On time' is derivable … and must stay derivable, because ADR-0009 recomputes streaks from these rows"* is falsified in its mechanism: on-time is now **decided once at write time and stored on the row**. What that sentence was actually protecting — ADR-0009's *"a streak is always derivable from completion rows"* — is exactly what storage preserves (decision 2 below). The **Completed (on time)** verb's definition gains the credit clause: solved during its own São Paulo day, **or** synced exactly one day late by a user the server itself saw online on that day.
**Amends:** [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md) — additive, as its header anticipated (*"#58's queued amendment … additive"*): seen days are a **write-time-only** input. The invariant sentence of decision 3 below is the amendment's whole content; the conclusion — completions are the source of truth, streaks recompute from them alone — is unchanged.

## Context

ADR-0026 decision 7 shipped the honest window: solve offline at 23:58,
reconnect at 00:05, and `completed_at` is the server write instant, so the
day derived late and the streak broke — contradicting issue #18's own *"a
connection drop mid-puzzle never costs the day"*. Fernando decided the rule
on 2026-08-02 (the comment on #58), and this ADR records that decision
executed, not reopened.

## Decision

1. **The rule (Fernando, 2026-08-02, verbatim in substance).** The server
   records that a user was online on São Paulo date `D` — one row per user
   per day, `user_seen_days (user_id, date)`, written `ON CONFLICT DO
   NOTHING` with the DB clock naming the day (ADR-0010; no client date and
   no JS date math on the path). A completion for `D` that syncs after the
   rollover is credited to `D` **iff** that record exists and `D` is
   exactly one day back (`LATE_SYNC_CREDIT_DAYS_BACK = 1`, packages/core —
   his *"`ACCEPTED_DAYS_BACK` stays 1"*; `isWritableDate` is untouched). No
   record → the completion still lands as **played/late** (ADR-0008's
   existing verbs), never for the streak or Dia Perfeito. The failure
   direction of every edge is the status quo — late — never a false credit.

2. **On-time is decided once, at write time, and stored** (`completions.on_time`).
   This is ADR-0009's own constraint forcing the storage ADR-0026 rejected:
   once the seen-fact enters the definition, a read-time derivation would
   have to consult a second table on every streak read, and *"a streak is
   always derivable from completion rows"* would be false. The pure rule is
   `onTimeAtWrite(date, today, seenOnDate)` (packages/core): today → true;
   exactly one day back ∧ seen → true; otherwise false. `POST /completions`
   is its one caller; every reader projects the stored column; the old
   `onTimeSql()` derivation is deleted.

3. **The invariant sentence.** The seen-days table is consulted exactly once
   per completion, at write time, inside `POST /completions`; no streak,
   statistics, medal or day-state computation reads it, and the pure merge
   recompute (`mergeCompletions`) never consults it — `mergeAccounts`'s
   union moves rows, it computes nothing — so a streak remains derivable
   from completion rows alone (ADR-0009, untouched). The complete reference
   set: `packages/db/src/seen-days.ts`, the session service's three hooks,
   `POST /completions`, `mergeAccounts`, and the `/cron/publish` retention
   delete. A new consumer amends this ADR.

4. **The write points are the session service's three authentications**
   (`resolveSession`, `mintSession`, `createSessionForUser` — the last
   because attach-confirm mints the clicking browser's session directly and
   the click proves presence). Awaited, never fire-and-forget. Deliberately
   NOT gated on the 1-hour `last_seen_at` staleness send-gate: that gate
   under-records exactly the 23:58→00:05 persona. One softened edge,
   accepted: puzzle pages are apps/web's direct DB read (ADR-0014) and the
   session bootstrap is a separate request, so a page load whose
   `ensureSession` failed can leave a day unrecorded — failure direction
   late, and a later sync needs the cookie anyway. **Rejected for v1:** a
   data-modifying-CTE fold into `resolveSession`'s lookup and a
   per-instance `(userId, spDay)` memo — unmeasured wins on the hottest
   read; `recordSeenDay` is the seam if the +1 round trip ever shows up.

5. **Retention.** Only `today − 1` is ever read, so the daily
   `/cron/publish` run deletes rows older than that (`pruneSeenDays`) —
   wrapped so a failure logs without masking the publish result. Widening
   the credit window widens this predicate too.

6. **The guard: at most one distinct past date is ever credited per user
   per São Paulo writing day** — the enforceable form of *"refuse a sync
   carrying completions for more than one distinct past date"*, since each
   POST carries one completion and "a sync" is invisible server-side.
   Dates, not games: three grid games for one date are legitimate. Before
   storing a past-date credit the route consults
   `hasCreditedPastDateToday`; a hit is **`422 multi-date-sync`**, no row —
   422 is already terminal in the sync client, so no client change. Under
   window = 1 the guard is **unreachable for any client, honest or not** (a
   stored past-date `true` is only ever minted for exactly `today − 1`, one
   such date exists per writing day, the same date is excluded, and
   backfilled trues fail the written-today predicate): it ships as a
   deliberate **widening tripwire**. Read-then-act is accepted **with its
   reason**: under a 1-day window a concurrent double-credit of two
   distinct dates is structurally impossible. **Revisit trigger: any
   widening of the window must fold this guard into the insert** (the
   step-6 F1 precedent) — and must revisit decision 5's predicate and this
   guard's per-day arithmetic together.

7. **The merge needs no special case, and one theorem dies.** `on_time` is
   COPIED by the repoint (T-DB-S24's pinned column list); `user_seen_days`
   merges by union then the loser's delete (ADR-0049 decision 6's extension
   point, the completions idiom — statements 4b/4c, individually
   idempotent). ADR-0026's *"a merge can never downgrade an on-time
   completion to a late one"* was a theorem of the derivation and is now
   **falsified**: an earlier **late** row (archive, unseen sync) beats a
   later **credited** row for the same puzzle, and earliest-wins keeps the
   late one — so a merge can visibly break a streak the user saw
   (T-CORE-S106 pins it; support should not be surprised). Fernando's call:
   keep earliest-wins, amend the sentence.

8. **A credited write is exempt from the late-write ceiling.** The route
   passes the ceiling option only when `onTime === false`; an
   `onTime === true` write always takes the plain-values arm. Without the
   exemption a player at the ceiling would 429 the credited flush; 429 is
   correctly non-terminal, so the record would retry after the next
   rollover, land two days back, and store `false` — a permanently lost
   streak day on a write-once row, the exact outcome #58 exists to prevent.
   Safe because the credit is server-derived and unforgeable (a seen row
   plus the 1-day window, never client input) and bounded at ≤3 rows per
   user per day by construction (one creditable date; three grid games;
   Termo cannot be played offline, ADR-0039). The guarded arm's count
   predicate flips to the stored `not on_time` (T-DB-S75).

9. **Storage-as-authority migration.** Migration 0008 (pre-push, additive
   only: the table; the column with a **temporary** DB default `false`; a
   **one-directional** backfill that can only promote `false →
   derived-true`, equal to the read-time derivation because every
   pre-existing row starts false). Migration 0009 (post-deploy: the same
   sweep, exact by construction since new code never stores false where the
   derivation is true; then `DROP DEFAULT`, so hand-written SQL fails
   loudly). **The visible window, stated honestly:** between the production
   deploy and 0009's apply, daily rows written by OLD code read as late and
   streaks can visibly dip; it lasts one deploy cycle and self-heals when
   the sweep promotes exactly those rows. Backfilled values equal the old
   derivation, so old rows keep exactly the meaning every reader gave them;
   the credit applies only forward (`user_seen_days` starts empty).

## Rejected

- **A grace window / clamped client attestation** (issue #58's option 2):
  Fernando chose the server-owned record instead — the client never asserts
  a date, and the abuse story stays structural: future content does not
  exist before its São Paulo midnight (ADR-0004's wall), so holding day
  `D+1`'s puzzle requires being online on `D+1`, which writes that day's
  seen row. Going dark banks at most one day and forfeits every day spent
  dark.
- **A `first_seen_at` timestamp on the seen row.** Zero readers (an unread
  surface is a standing HIGH finding); the union needs none.
- **Gating the seen write on the `last_seen_at` staleness send-gate**, the
  CTE fold and the per-instance memo — decision 4.
- **Consulting `user_seen_days` at read time** — decision 2's whole point.

## Consequences

- **#18's promise is made true**: *"a connection drop mid-puzzle never
  costs the day"* now holds for the player the server saw — ADR-0026
  decision 7 quoted it as contradicted; this ADR closes it.
- The beneficiaries are the three grid games; Termo cannot be played
  offline at all (ADR-0039), so nothing here touches it.
- No client change: request schema unchanged, `completionResponseSchema`
  already carries `onTime`, 422 already terminal and 429 already
  non-terminal in the sync ladder, and the date-descending flush order
  already posts yesterday's daily ahead of stale archive records
  (T-WEB-S283/S284 pin the no-change claim).
- `ACCEPTED_DAYS_BACK`'s semantics are unchanged in spirit: the write
  window (`isWritableDate`) is untouched, and the credit window is a new,
  separate constant with one owner — do not let it leak into
  `wallPredicate`, `isWritableDate` or the stats calendar's clamp (the #31
  lesson: three questions, three owners).
