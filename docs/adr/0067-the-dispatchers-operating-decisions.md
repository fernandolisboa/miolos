# ADR-0067 — The dispatcher's operating decisions: write-side subscription ceiling, ledger merge duty, one-snapshot tick instant

**Status:** Accepted — 2026-08-20 (issue #146, shipped in #171)
**Depends on:** [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md), [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md)

## Context

ADR-0064 recorded the streak-at-risk architecture and deliberately left a
set of operating questions to the dispatcher ticket (#146): it says "#146
decides" in decision 10's note, prices the claim-first residual without
naming the tick's clock seam, and never touches the #145 step-6 residual of
an unbounded per-user subscription list. This ticket makes six genuine
decisions; scattering six decision-weight annotations across ADR-0064 would
bury them, so they live here, and ADR-0064 carries three thin annotations
pointing back (its own falsified sentences — Q1, Q2, and decision 10's open
call). Fernando's #32 answers of 2026-08-20 govern: **Q1 = 1a** (push only
for dual-consent users; email is the no-subscription fallback, slice C) and
**Q2 = 2a** (the nudge fires for ANY live streak — no `>= 3` gate anywhere
in the candidate SQL).

## Decisions

1. **A per-user subscription ceiling of 10 distinct endpoints, enforced
   write-side, folded into the subscribe upsert's own INSERT.** The threat
   (the #145 residual): one anonymously mintable session inserting
   unbounded DISTINCT https endpoints — the Zod floor admits any https
   URL — that the dispatcher must then HTTP-request every tick. A
   write-side ceiling bounds storage AND sends; a dispatch-side cap bounds
   neither. The mechanism is the `guardedInsertSelect` precedent
   (completions.ts, ADR-0053 decision 13 — check-then-act was measured
   broken there): the proposed row is guarded by `(count < 10) OR exists
   (endpoint, user_id)`. The `exists` disjunct is load-bearing (without it
   `ON CONFLICT DO UPDATE` never fires at the cap, and a key-rotation
   re-subscribe on a full account silently fails) and is **scoped to the
   caller's `(endpoint, user_id)` on purpose**: unscoped, a second session
   could mint 10 endpoints the first re-posts to itself — the shipped
   upsert repoints an endpoint to the posting user — re-opening the exact
   residual the cap closes. At the cap a NEW endpoint answers **429** (the
   late-write-ceiling status precedent) and stores nothing; a same-user
   re-subscribe upserts normally; a cross-user repoint also answers 429.
   Honest residuals: (i) READ COMMITTED overshoot by the number in flight
   (ADR-0053 decision 13's exact bound); (ii) a full account cannot take
   over an endpoint another user holds until it frees a slot.

2. **`notification_sends` acquires its merge duty: union then empty**
   (merge.ts statements 5e/5f — the seen-days 4b/4c idiom, consuming
   ADR-0049 decision 6's extension point). Without it, a same-day merge of
   a claimed loser into an unclaimed at-risk winner re-nudges the winner,
   and loser rows would reference the tombstone against "emptied means
   EMPTIED". `ON CONFLICT DO NOTHING` on the composite PK — presence is
   presence; whichever `sent_at` survives is immaterial, the row's whole
   function is "do not send again" — with `sent_at` COPIED, never
   re-stamped. Individually idempotent; crash-prefix-safe.

3. **The tick instant is ONE database snapshot, then parameters all the way
   down.** `readTickInstant(db)` reads the SP day and SP hour in one
   statement (they can never straddle midnight against each other); the
   route passes `{today, hour}` into `runNotifyTick` and everything below
   takes them as parameters. This is the testability seam that keeps "DB
   clock only" literally true: the values originate in one Postgres read,
   JS never computes a date or hour, and every behavioral test is
   real-clock-free with explicit fixtures. The transport is injected the
   same way (`send: NudgeSend`), so no test mocks a module.

4. **`POST /cron/notify`, 503 when unconfigured, 200 with failures.** POST
   because the tick writes and sends and Vercel cron (GET) is not the
   driver; no `dynamic` export (a POST handler is dynamic by definition —
   the route says so where publish's export would be). 401 via the
   extracted shared `isAuthorized` (src/cron/auth.ts — publish's diff is
   import-only). **503 when `!isPushConfigured()`, before any DB read**:
   the subscribe routes' fail-closed posture, and with `curl -fsS` a red
   hourly Actions run on a misconfigured prod IS the alert. **200 whenever
   the tick ran, even with `failed > 0`** — a lost nudge is ADR-0064
   decision 7's priced residual, not an outage; the per-line
   `{event:"cron-notify"}` log carries the observability (the publish
   idiom).

5. **Serial sends, TTL 3600, no artificial candidate cap, `maxDuration:
   60`.** The publish cron's measured reasoning holds: round-trips
   dominate, concurrency multiplies connection pressure, v1 N is small.
   TTL 3600 is a decision — web-push's default is four weeks, and a streak
   nudge delivered tomorrow is worse than none; one hour matches the
   mechanic's granularity. **Revisit trigger, measured not guessed: when a
   tick's logged `candidates` approaches ~150, introduce bounded
   concurrency.** Two residuals stated: claim-before-send means a crash
   between a user's claim and their send loses that day's nudge (decision
   7's priced residual, restated); and a 60 s timeout silently drops the
   **unclaimed tail** of an oversized candidate list — those users are
   never claimed and never sent that hour. Beside them, the skipped-tick
   residual: a tick GitHub skips or delays past the hour loses that hour's
   cohort's nudge for the day — the route matches equality on the current
   SP hour, deliberately, and no catch-up pass exists (rides ADR-0064
   decision 8's granularity choice).

6. **`pushsubscriptionchange` is deferred to #36, the settings-toggle
   ticket.** The handler needs a credentialed cross-origin re-POST from
   worker context — a new network-capable surface in a worker whose whole
   ADR-0004 argument is "no third capability" (T-WEB-S261 pins the exact
   listener set); the event is rare and browser-initiated; the
   granted-but-unsubscribed install is already re-askable at #36's toggle,
   the recorded re-ask surface; and 404/410 pruning (shipped here) keeps
   the table honest meanwhile. Recorded as annotation (b) on ADR-0064
   decision 10 and as a comment on #36 — an action filed, not an
   observation.

**A deliberate duplication, noted with its reason:** the candidate SQL
encodes "a day counts iff a won ∧ on-time row exists" as a **prefilter** —
ADR-0048's `computeStreak` remains the only streak authority (the copy's
number comes from it, and T-API-S144 pins the sent number to it). Running
`computeStreak` over every user per tick is the rejected alternative: cost
without a correctness gain. The prefilter also deliberately **narrows**
ADR-0064 decision 1's "earliest on-time completion" sample to won ∧ on-time
rows — one predicate does both the counted-day and the sample job, and a
lost-but-on-time earlier play is excluded from the median; an ADR-0066
credited day's sample is the sync instant, not a play instant (accepted
imperfection, recorded in notify.ts's doc block).

## Rejected

- **A dispatch-side candidate cap** — bounds neither storage nor the
  honesty of the send list; the write-side ceiling is where the bound is
  real (decision 1).
- **Claim-after-send** — re-rejected by reference (ADR-0064's Rejected
  list): double sends are worse than a lost nudge on a never-marketing
  channel.
- **Catch-up matching (`habitual_hour <= hour`)** — changes ADR-0064
  decision 6's closed hour-equality semantics; a skipped tick's cohort
  waits for tomorrow rather than being nudged at a non-habitual hour.

## Consequences

- The dispatcher is LIVE at merge: VAPID is configured in production and
  `CRON_SECRET` is a GitHub repo secret (both in `docs/pending-fernando.md`'s
  Done table), so the first top-of-hour Actions tick after merge sends real
  notifications to any real subscriptions. Expected first-tick reality:
  `candidates` ≈ 0 (opt-in shipped 2026-08-19; the threshold gates the ask).
- Slice C (email) rides the same ledger (`channel` admits `'email'`,
  `claimNudgeSend` takes the channel) and writes its OWN candidate reader
  with Q1 = 1a's `NOT EXISTS (push subscription)` conjunct — the push
  reader is push-named and untouched.
- Rollback is "revert the merge": the workflow file reverts with it, and
  the `notification_sends` table is append-only inert without the route.
