# ADR-0069 — Telemetry is five server-anchored events over a hand-rolled capture

**Status:** Accepted — 2026-08-21 (issue #33, shipped in #176)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md), [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md), [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md)

## Context

The founding handoff names five product-analytics events and nothing else,
and `/privacidade` already publishes the promise those five have to keep:
*"Medições técnicas mínimas de uso e desempenho. Não gravamos a sua tela nem
as suas sessões."* The project invariants add **no session replay** as a
veto rather than a preference.

The default way to satisfy issue #33 is `posthog-js` with autocapture,
pageviews and replay switched off. That makes the promise a CONFIGURATION —
eleven flags a test would have to pin forever, on a dependency that
lazy-loads remote code, against a `/` baseline every route in the app
inherits. This ADR records the opposite shape: the ceiling holds by
construction instead.

## Decisions

1. **A hand-rolled server-side capture. No SDK, no dependency.**
   `POST https://us.i.posthog.com/i/v0/e/` with `{api_key, event,
   distinct_id, properties}` in the body — the publishable token needs no
   auth header. `apps/api/src/telemetry/capture.ts` is the whole client. A
   helper this small **cannot** autocapture, cannot page-view, cannot
   lazy-load remote scripts and cannot record a session: the no-replay
   promise and the five-event ceiling are properties of the code rather
   than of a config that must never drift. Zero bundle cost on `/`, zero
   `minimumReleaseAge` friction, and the fewest-dependencies posture
   `CLAUDE.md` asks for; the Resend plain-`fetch` transport (ADR-0050) is
   the precedent. *Rejected:* `posthog-js` (~82 kB gz on every route's
   baseline plus the kill config); `posthog-js-lite` (~10–15 kB and still a
   client SDK holding its own device identity — see decision 5).
   The host is a constant, not an env var: the region is confirmed US and a
   configurable host would be surface with no consumer.

2. **Four events fire at their server truth seams; only `puzzle_started`
   is client-originated, and it rides a first-party relay.**
   - `puzzle_completed` and `streak_broken` inside `POST /completions` —
     the authoritative write-once moment, so an offline flush counts
     correctly and an idempotent replay (`recorded: false`) fires nothing,
     mechanically. The row IS the dedup.
   - `notification_opt_in` inside `POST /push/subscriptions`, on a genuine
     first insert only (decision 6).
   - `login_linked` inside `POST /attach/confirm`, keyed by the resolver's
     `winnerId` — that route deliberately requires no session, because the
     recovery browser may have none.
   - `puzzle_started` has no server fact behind it (no row exists before
     the grid closes), so the client posts it to `POST /telemetry` on
     apps/api: Zod-parsed against a closed **single-literal** contract, the
     session cookie resolving `distinct_id`, the server capturing. The
     other four cannot be forged through that door, and the PostHog key
     never ships in a bundle.

   Every capture runs **post-response**, inside Next's `after()`, wrapped so
   a thrown derivation can never reach the response
   (`runAfterResponse`). No telemetry work delays or fails a route.

   *Rejected:* a client-side `puzzle_completed` at the close effect (it
   double-counts against the queue's retries, misses offline flushes and
   needs its own dedup — the row already is one); direct
   client-to-PostHog (needs a client-held identity, decision 5); a Next
   `rewrites()` proxy (all traffic is server→server, so ad-blockers and CSP
   are irrelevant to it; the proxy would buy nothing and cost per-event
   invocations).

3. **`streak_broken` is derived on return, and its claim is bounded.**
   The break itself happens at São Paulo rollover, unobserved: the streak is
   read-time (ADR-0048) and nothing anywhere stores a previous value. So the
   event fires when a **counted** insert (`won`, `onTime`, `recorded`)
   starts a new run after a gap. `deriveStreakBroken` reads
   `listCompletionsForStreak` once and requires **all four**:

   (i) a counted date `prev` exists with `prev < inserted − 1` — an
   adjacent yesterday is a continuation;
   (ii) the inserted row is the only counted row on its date;
   (iii) **the inserted row is the maximum counted date**;
   (iv) `recorded` was true.

   Condition (iii) is load-bearing. The sync queue flushes newest-date-first
   on purpose (`play/sync.ts` — today's daily always posts before a queued
   late completion) and ADR-0066 lets that late completion store counted, so
   without it a queued `{D, D−1}` over a `D−5` history fires twice. With it,
   either ordering fires at most once.

   Payload: `previous_streak = computeStreak(rows, prev).streak` (the one
   streak authority, never re-derived), `broken_after_date = prev`,
   `gap_days = epochDay(inserted) − epochDay(prev) − 1` — the count of
   fully missed days.

   **The recorded claim is "at most once per break; exactly once in the
   sequential single-client case"** — not "exactly once" unqualified.
   Three residuals, all accepted and named:
   - **Retro-close spurious fire.** An insert on `D` with `prev = D−2`
     fires, then a later credited flush or archive solve of `D−1` (a seen
     day, ADR-0066) retro-closes the gap: the streak never broke, but the
     event fired. Bounded to exactly-1-day gaps inside the credit window,
     and costs zero extra queries. *Rejected:* a `wasSeenOn` suppression
     read — it trades a spurious fire for a possible missed one and adds a
     round trip for telemetry-grade accuracy.
   - **Two-device same-day race.** The guards are check-then-act reads
     inside `after()` with no transaction available (neon-http, the
     `guardedInsertSelect` constraint): two racing counted inserts can
     double-fire or both stay silent. The READ COMMITTED reasoning ADR-0053
     decision 13 already models; a single client is sequential
     (`sync.ts`'s `flushing` guard).
   - **Timestamp is return-time, not break-time.** `broken_after_date`
     lets any analysis re-anchor. A player who never returns, or never
     lands a counted completion, never fires it — telemetry observes
     players, not absences. A merge fires nothing here: `mergeAccounts`
     moves completion rows by raw SQL, never through `POST /completions`.

4. **Archive plays fire with distinguishing properties; free play fires
   nothing, and the wall enforces it.**
   The invariant protects the streak, the statistics distributions and the
   medals — PostHog is operational telemetry, and archive engagement is
   exactly what M3 wants to see. The server cannot perfectly split "archive
   URL" from "offline flush of the same date" (ADR-0066), so the honest
   property is the stored verdict: `on_time` on `puzzle_completed`, and
   `archive: date !== todaySaoPaulo(db)` on `puzzle_started` — **derived
   server-side, never client-asserted**.

   Free play is structurally silent (it never mounts `usePlayLifecycle`,
   the only caller) AND `src/telemetry` is banned by name from
   `apps/web/src/free-play` and `app/modo-livre` in both the static group
   and the dynamic-import regex (ADR-0046, the napkin's one-hop rule).
   Structural silence is exactly the kind of claim that survives until
   someone adds a second caller; the wall is what makes it mechanical.

   **Payloads — minimal, no PII, no puzzle content (ADR-0004):**

   | event | properties |
   |---|---|
   | `puzzle_started` | `{game, date, archive}` |
   | `puzzle_completed` | `{game, date, elapsed_ms, outcome, on_time}` |
   | `streak_broken` | `{previous_streak, broken_after_date, gap_days}` |
   | `notification_opt_in` | `{}` — never the endpoint or the keys |
   | `login_linked` | `{merged}` — never the email |

5. **`distinct_id` is the server `userId`. No new identity surface.**
   Three of the four server seams already hold it (`requireUserId`), the
   relay resolves it the same way, and `login_linked` uses the resolver's
   `winnerId`. **No PostHog device id, no new cookie, no `localStorage`
   identifier** — so nothing new is stored on the device or about the user,
   and `/privacidade`'s published inventory stays exactly true with **no
   copy change** (the #30/#145 precedent extends it only when a new data
   class is stored; none is). Captures set
   `$process_person_profile: false`: anonymous-class events, no person
   profiles. Merge (ADR-0009/0049) re-keys later events to the winner; no
   `alias` call — five events do not need cross-device identity. **No
   opt-out UI in this PR**: that is product surface the issue did not ask
   for, and its home is the first settings surface (#36) / the LGPD pass
   (#37).

   **The genuinely new privacy fact, named so #37 cannot miss it:**
   PostHog (US) now holds event rows keyed by the server `userId` — a
   third-party processor. The full telemetry-vs-policy LGPD review stays
   deferred to #37 under ADR-0012; this ADR is where that review starts.

6. **`notification_opt_in` fires on a genuine first insert, not on
   `stored: true`.** The subscribe write is `INSERT … ON CONFLICT DO
   UPDATE … RETURNING`, and the DO UPDATE arm returns a row too, so
   `stored: true` comes back on every re-post — key rotation, an identical
   re-subscribe, a cross-user repoint, and #36's future settings toggle.
   Firing on it would re-count an opt-in that already happened.
   `upsertSubscription` therefore answers `{stored, inserted}`.

   The mechanism is the **plan's named fallback, not its first choice**:
   `(xmax = 0)` in the RETURNING list does not type on a clean tree, because
   `Db` is a union of two drizzle database classes and TypeScript cannot
   resolve the generic fields-overload of `.returning(fields)` through a
   union of overloaded methods. A pre-read `exists` scoped to the caller's
   `(endpoint, user_id)` lands instead — one read on the endpoint PK.
   Check-then-act is accepted **at telemetry grade only**: two racing first
   posts of one endpoint can double-report. The **ceiling** (ADR-0068
   decision 1) is untouched and stays folded into the insert, where
   check-then-act was measured broken. Under the pair scope a cross-user
   repoint reads as `inserted` for the posting user — a channel this user
   did not hold before, which is a real opt-in act and the product meaning
   intended.

7. **The relay is unthrottled, and that is priced rather than fixed.**
   `POST /session` is free and unminted-cookie-cheap, so a flood of relayed
   `puzzle_started` events is one minted cookie away. The cost is PostHog
   free-tier quota — telemetry blindness — never money and never data: the
   route writes nothing, reads one published date, and the contract admits
   one event with two properties. No rate limit at this traffic level; an
   accepted, named residual in the ADR-0006 `:51` idiom. It also carries the
   sibling credentialed-POST preamble (origin guard, JSON content type), and
   **no session is a 204 drop rather than a 401** — a blocker or a bot gets
   no error surface to probe, and a start with no identity is not a fact
   this system records.

   Naming the route `/telemetry` means a generic blocker filter will drop
   `puzzle_started` for those users. Accepted: honest naming over evasion.

8. **Missing `POSTHOG_KEY` is a valid state, and a LOUD one.** The helper
   no-ops, sends nothing and never throws — but logs one `console.error` per
   instance (the `streak-client.ts` / `bootstrap.ts` idiom). "Telemetry
   absent is valid" justifies not breaking anything; it does not justify
   invisibility in the logs of the exact deployment where someone asks why
   the dashboard is empty. Tests and CI never send: no `POSTHOG_KEY` in any
   test env, and the once-guard keeps the output quiet.
   The key lives **server-side only, on miolos-api**, with **no
   `NEXT_PUBLIC_` twin** — a public twin would invite client use. Its
   production activation is a `docs/pending-fernando.md` NOW item, because
   production env work by agents is classifier-blocked unattended.

9. **Error Tracking / `$exception` is not wired here; it is #37's.**
   "No sixth event exists" is a claim about the five *product-analytics*
   events; PostHog-internal `$*` events are a different class — and this
   change ships **zero** of them anyway, since there is no SDK and the
   helper's event type is a closed five-name union. Whether PostHog Error
   Tracking discharges #37's "error monitoring live on both apps" is #37's
   call; nothing here forecloses it, and a server-side `$exception` capture
   would reuse this helper.

## Consequences

(a) A sixth event is a **compile error**, not a review finding: `captureEvent`
types its `event` off `TELEMETRY_EVENTS`, and the relay contract is a single
literal. The runtime half is pinned by the contract test.

(b) `apps/web`'s `/` baseline grows by the relay client alone — measured
**+0.7 KB raw / +0.3 KB gzip** — because `session/bootstrap.ts` (mounted in
the root layout) imports `markSessionReady`. Every route's delta over `/`
moves ≤ 0.2 KB. No budget was retuned.

(c) **`usePlayLifecycle` gained an input rather than a read.** The
`puzzle_started` gate needs the server's day claim, and the claim lives in
`play/day-state.ts`, which reaches `src/day/**` — which no archive page's
module graph may contain (ADR-0053 **decision 10's "Why no endpoint"** —
*"a user-specific fragment on a public page … speculative surface with one
consumer and a per-request cost on a crawler-facing route"* — on the
un-cached-archive trade decision 2 makes; pinned by `archive-day.test.tsx`,
and the archive's shells mount the same hook). **Not decision 9**, which is
"there is no archive conclusion route" and concerns `ConclusionView`: this
consequence and three other records cited it, copied from the pin's own
comment, which carried the wrong number too (step-6 ADR B1). All are
corrected, the pin included. So
the four daily screen roots pass `remotelyClaimed` in, and the archive
passes nothing. A first implementation that read the claim inside the hook
made that test red; the wall was right.

(d) **The cold-load residual of that gate.** `remotelyClaimed` is captured at
the first render and never updated — putting the live value in the mount
effect's dependency array would re-run the restore, the prune and the sync
registration whenever a `GET /day` lands. On a **cold direct load** the
payload has not arrived at first render, so a day finished on another device
reports one `puzzle_started` before the remote view swaps in. The case the
gate actually covers is the **warm** one — a client-side navigation from the
hub, whose done tile links to the board route — which is the common path.

(e) `after()` throws outside a request scope, which is exactly how the API's
test suites invoke route handlers (a direct `POST(request)` call, no Next
server). `runAfterResponse` therefore falls back to immediate
fire-and-forget scheduling, chained onto a `telemetrySettled()` promise so
tests can await both positive and negative assertions. In a deployed route
the `after()` arm always wins; the fallback is a test seam, not a second
production path.

(f) Until the `POSTHOG_KEY` ledger item is discharged, the deployed helper
logs its one missing-key line and captures nothing. Exit criterion "the
dashboard verifies installation" is **pending on that item**, not silently
unmet.
