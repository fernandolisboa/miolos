# ADR-0064 — Streak-at-risk is a derived decision: read-time window, per-endpoint consent, claim-first ledger, one dispatcher

**Status:** Accepted — 2026-08-20 (issue #32, shipped in #TBD)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0022](./0022-opaque-session-tokens-in-a-sessions-table.md), [ADR-0025](./0025-remote-config-is-a-database-table.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0061](./0061-onboarding-seen-is-a-users-timestamp-merged-earliest-wins.md)
**Amends:** [ADR-0061](./0061-onboarding-seen-is-a-users-timestamp-merged-earliest-wins.md) — decision 2's two-column enumeration of statement 5d, which now folds three (annotation (a) there); the decision stands

## Context

The founding handoff promises exactly one push type — streak at risk, at the
player's habitual time, opt-in after streak ≥ 3, no marketing push — and
ADR-0001 makes "push" mean Web Push. Issue #32's Tier-3 fog-clearing pass
(its 2026-08-19 comment) settled the shape; this ADR records those decisions.
Slice A (#145) ships the opt-in half; the dispatcher (slice B, #146) and the
email hedge (slice C) are its remaining implementers, and every decision here
that only they exercise is recorded now so they attach rather than re-decide.

## Decisions

1. **The habitual play window is derived at read time, never stored.** The
   median São Paulo minute-of-day of the player's earliest on-time completion
   per counted day over the last 21 SP days, extracted DB-side
   (`completed_at at time zone 'America/Sao_Paulo'`, `percentile_disc(0.5)`),
   rounded to the hour because the tick is hourly. No column, no update job:
   the completions rows already carry the signal, and a stored window is a
   cache that can drift (ADR-0051's philosophy). Cold start is structurally
   absent on both surfaces — the opt-in prompt renders on the conclusion,
   which IS the habitual moment by construction, and a send candidate counted
   yesterday by definition, so ≥ 1 sample always exists. The midnight
   wraparound (completions straddling 23:00/01:00) is an accepted v1
   imperfection: circular statistics buy nothing at hourly granularity.

2. **Subscriptions are per endpoint (per browser install), FK to user, with
   `created_at` as the consent evidence.** `push_subscriptions(endpoint PK,
   user_id FK cascade, p256dh, auth, created_at)` + a user index (migration
   0007). Subscribing is the consent act; deleting the row is withdrawal; no
   separate consent column (the ADR-0022/0050 timestamp-is-evidence idiom).
   Several rows per user is the design. `mergeAccounts` gains one remap
   statement — 1b, the sessions precedent, consuming ADR-0049 decision 6's
   reserved extension point — and these rows are NOT revoked on merge:
   ADR-0050 decision 13 is about cookie takeover, and a device's push channel
   follows the merged identity.

3. **The prompt has one lifecycle per account, server-stamped.**
   `users.push_prompt_dismissed_at` (nullable timestamptz, migration 0007):
   decline ("Agora não") and browser denial both stamp it permanently —
   never device storage, which re-prompts exactly the cleared-data user.
   Merged earliest-wins as the third column of statement 5d (ADR-0061's
   fold). Eligibility for the ASK is `isPushConfigured() AND undismissed AND
   streak >= pushOptInStreakThreshold` (remote config, default 3, ADR-0025);
   the threshold gates the ask, never a send — once opted in, the nudge fires
   for any live streak (Q2 on #32, Fernando's confirmable default).

4. **Dormancy is one fail-closed predicate over the full VAPID triple.**
   `isPushConfigured()` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, read at call time — the `isAttachConfigured` posture):
   unconfigured → the subscribe routes 503 before any side effect AND the
   state endpoint reports ineligible with a null key, so no environment
   renders a prompt whose accept would fail, and no half-configured
   environment collects subscriptions the dispatcher can never serve. The
   public key reaches the client inside the state response — one source of
   truth, the api env; no `NEXT_PUBLIC_` twin to drift.

5. **The service worker is caching-free, which discharges ADR-0004 by
   construction.** `apps/web/public/sw.js` registers exactly `push` and
   `notificationclick` — no request-interception handler, no cache storage,
   ever. A worker that never caches cannot cache a future-dated payload. A
   source test (T-WEB-S261) pins the tokens absent; `notificationclick`
   focuses or opens the hub (`/`). Registration happens inside the accept
   gesture only — register → `navigator.serviceWorker.ready` → subscribe,
   the `ready` wait load-bearing (the Push API rejects `subscribe()` with
   `InvalidStateError` on a registration with no active worker).

6. **The dispatcher is the product's only notification code path** (slice B,
   #146). Send iff: holds a subscription (or reminder consent, for the email
   arm), yesterday (SP) counted and today has not (ADR-0048's exact at-risk
   state), the current SP hour equals the derived habitual hour, and no
   ledger row exists for (user, today, channel). All DB-clock arithmetic; no
   JS Date in any statement.

7. **Double-send avoidance is an append-only ledger, claim-first.**
   `notification_sends(user_id, date, channel, sent_at, PK(user_id, date,
   channel))` (slice B's migration): the dispatcher claims by
   `INSERT … ON CONFLICT DO NOTHING RETURNING` before sending — race-safe
   without transactions over neon-http. **The priced residual:** a send
   failure after a claim loses at most that day's nudge for that user;
   claim-after-send risks doubles, which is worse for a never-marketing
   channel.

8. **The hourly tick is a GitHub Actions schedule, not a Vercel cron.**
   `.github/workflows/streak-notify.yml` (slice B), `cron: "0 * * * *"`, one
   curl into a CRON_SECRET-guarded route (the publish cron's fail-closed
   `isAuthorized`, SHA-256 both sides + `timingSafeEqual`). Vercel Hobby
   allows two once-daily jittered crons — an hourly mechanic cannot ride it.
   Actions jitter is absorbed by hourly granularity plus matching on the DB
   clock's current SP hour at execution time.

9. **The `web-push` npm package is taken in `apps/api` only, with the
   dispatcher (#146) — its first caller.** This is the one deliberate
   exception to the hand-rolled-transport posture: VAPID is ES256 JWT
   signing plus RFC 8291 payload encryption (ECDH/P-256 → HKDF →
   AES-128-GCM) — ~150 lines of composition crypto, exactly the class
   "don't roll your own crypto" names, unlike base64url or a fetch call.
   NOT installed in slice A: nothing sends, and an installed dependency with
   no call site is the dormant surface this repo treats as a finding (the
   activation checklist uses `npx web-push` without installing).
   `packages/games`' zero-Node-deps invariant is untouched.

10. **Endpoint hygiene rides the send pass** (slice B): a 404/410 from the
    push service deletes that subscription row in the same pass — browser-
    side revocation surfacing as pruning, which keeps the table honest.

## Rejected

- **A stored habitual-window column or update job** — a cache that drifts;
  the rows carry the signal (decision 1).
- **`sessions.last_seen_at` as the window source** — bumped only when > 1 h
  stale and polluted by non-play visits; completion instants are the act.
- **A per-user subscription row (one row, latest endpoint)** — a player's
  phone and desktop are both real channels; the endpoint is the natural PK.
- **localStorage for the prompt lifecycle** — re-prompts exactly the
  cleared-data user (the ADR-0061 argument, verbatim).
- **Vercel cron for the tick** — Hobby's two once-daily jittered jobs cannot
  carry 24 ticks a day.
- **Hand-rolling the Web Push encryption** — composition crypto is where the
  hand-rolled posture stops (decision 9).
- **Claim-after-send** — risks double sends; worse than a lost nudge on a
  never-marketing channel (decision 7).

## Consequences

- (a) Slice A (#145) is dormant and fail-closed until Fernando runs the
  VAPID activation (three `vercel env add`s); nothing sends until #146.
- (b) The #33 edge: the `notification_opt_in` event fires at successful
  `POST /push/subscriptions` and waits on slice A alone.
- (c) The #36 edge: the settings push toggle consumes `DELETE
  /push/subscriptions`, live from slice A as its seam.
- (d) The email hedge (slice C) shares the dispatcher and the ledger;
  hedge-not-chorus semantics is Q1 on #32, Fernando's call, and the ledger's
  `channel` column supports either answer unchanged.
- (e) iOS Safari without home-screen install never sees the card (the triple
  feature detect) and is slice C's audience. No install nagging in v1.
