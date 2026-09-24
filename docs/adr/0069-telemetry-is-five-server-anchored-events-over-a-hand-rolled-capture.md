# ADR-0069 — Telemetry is five server-anchored events over a hand-rolled capture

**Status:** Accepted — 2026-08-21 (issue #33, shipped in #176)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0012](./0012-minimal-lgpd-ships-with-email-attach.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0060](./0060-the-day-payload-is-server-truth-and-the-device-may-only-add-to-it.md), [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md), [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md), [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0049](./0049-account-merge-one-pure-function-one-idempotent-operation.md), [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md), [ADR-0064](./0064-streak-at-risk-is-a-derived-decision.md), [ADR-0068](./0068-the-dispatchers-operating-decisions.md)

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
   **THE REJECTION IS ENFORCED, not merely recorded** (step-6 issue B1):
   issue #33's AC says session replay is disabled *and stays disabled*, and
   "stays" cannot rest on nobody having installed an SDK. Both rejected
   clients, `@posthog/*` and `rrweb` are banned as imports repo-wide
   (`replayCapableClientGroups` in `eslint.config.mjs`, `T-LINT-S53`) and
   as **dependencies** in every workspace manifest and in the lockfile
   (`T-WEB-S322`) — the second of which is what closes dynamic `import()`
   and `require()`, neither of which an import ban can see. A future ticket
   that needs one supersedes this decision first, in the open.
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

   **The number is `computeStreak`'s, never re-derived — but the PREDICATE
   is spelled twice, and that is worth saying** (step-6 ADR N2).
   `deriveStreakBroken` re-spells the conjunction `computeStreak` uses to
   find a run boundary (`row.outcome !== "won" || !row.onTime`) in order to
   locate the gap; ADR-0048's Rejected list warns against "a second streak
   definition", and ADR-0068 set the precedent of naming this kind of
   deliberate duplication in the ADR rather than only in a code comment.
   ADR-0048's `computeStreak` remains the only streak authority, and the
   number this event carries comes from it.

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
   - **Partial retro-close: the fire survives with arithmetic that no
     longer matches the rows** (step-6 correctness N1). `gap_days` and
     `previous_streak` are computed from the rows visible AT FIRE TIME, and
     under the newest-first flush that guard (iii) exists for, a credited
     row can land BEHIND the fire and shorten the gap it described.
     `T-API-S169`'s own fixture is an instance: the surviving fire reports
     `broken_after_date: T−5, gap_days: 4`, and once the credited `T−1` row
     lands the true gap is 3. The bullet above covers the gap being closed
     ENTIRELY; this one covers it merely shrinking. Same trade, same
     acceptance: telemetry grade, zero extra queries.
   - **Two-device same-day race.** The guards are check-then-act reads
     inside `after()` with no transaction available (neon-http, the
     `guardedInsertSelect` constraint). **The code is SAFER than this ADR
     first claimed** (step-6 correctness N2): every reachable interleaving
     yields one fire or zero, never two, because under READ COMMITTED each
     post-insert read follows its own committed insert and so cannot miss
     the sibling's row. The residual is UNDER-firing, not double-firing.
     The READ COMMITTED reasoning ADR-0053 decision 13 already models; a
     single client is sequential (`sync.ts`'s `flushing` guard).
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

   `elapsed_ms` is `body.elapsedMs` — **the client-reported figure**, the
   same number the stored completion row and every published statistic
   already use (step-6 issue N4). Consistent by construction, but the
   issue's *"with time"* is a client assertion, not a server measurement,
   and that is worth knowing before anyone reads a percentile off it.

   **The wall is a SOURCE-IMPORT wall, not a module-graph one** (step-6
   security N5). `session/bootstrap.ts` imports `markSessionReady`, and
   bootstrap is mounted in the root layout, so `src/telemetry/client.ts`
   ships in every page's bundle — `app/modo-livre` included. Free play
   fires zero events because `usePlayLifecycle` is the only caller and free
   play never mounts it; the ESLint entries stop free-play SOURCE from
   importing the module, which is what makes the claim mechanical rather
   than merely true today. Both facts are load-bearing, and neither alone
   is the whole claim.

   **`notification_opt_in` means the BROWSER-PUSH subscription** (step-6
   issue N2). #32's reminder-email consent is an independent flag collected
   at attach and fires nothing here. That is the founding handoff's opt-in,
   but it is a narrowing and is recorded as one.

5. **`distinct_id` is the server `userId`. No new identity surface.**
   Three of the four server seams already hold it (`requireUserId`), the
   relay resolves it the same way, and `login_linked` uses the resolver's
   `winnerId`. **No PostHog device id, no new cookie, no `localStorage`
   identifier** — so nothing new is stored **on the device**. Captures set
   `$process_person_profile: false`: anonymous-class events, no person
   profiles. Merge (ADR-0009/0049) re-keys later events to the winner; no
   `alias` call — five events do not need cross-device identity. **No
   opt-out UI in this PR**: that is product surface the issue did not ask
   for, and its home is the first settings surface (#36) / the LGPD pass
   (#37).

   **`/privacidade` IS EXTENDED IN THIS PR, and the first draft of this
   decision was wrong to say otherwise** (step-6 security B1 and ADR B2,
   converged independently). The declined-copy reasoning read *"the
   #30/#145 precedent extends the inventory only when a new data class is
   stored; none is"* — but that is not the criterion the page's own block
   comment states. The criterion is *"the page states EXACTLY what this
   release ships"*, and the #30 medals and #145 push comments each spell it
   out as **"data about the user"**. Five behavioural event rows tied to an
   account id are data about the user by that criterion, and both
   precedents shipped their inventory line **in the same PR as the
   mechanism**. The declining sentence also contradicted this decision's
   own next paragraph, which concedes the fact and then defers it.
   `privacy.collected.telemetry` is therefore widened in place — the #30
   and #145 shape — to state which measurements, that they are keyed to the
   anonymous account and never to the email, that PostHog processes them
   outside Brazil, and how they are removed. It is an inventory and legal
   statement, not a UI/UX call, so it is a professional decision made here
   rather than a question for Fernando.

   **THE DELETION RESIDUAL, stated rather than left implied.** `POST
   /account/delete` is a single `db.delete(users)` cascade over OUR tables —
   sessions, completions, hint grants, medal grants, attach tokens, push
   subscriptions, seen days. **It issues no PostHog deletion**, so event
   rows keyed to that `userId` survive the erasure, and the page's
   *"apaga … de uma vez"* is true of what the deletion section enumerates
   and not of the provider's copy. Closing it needs a PostHog **personal**
   API key (the publishable token cannot delete) — a new credential, a new
   pending-Fernando item and a new failure mode on the deletion path, which
   is scope this issue did not ask for and cannot decide alone. So the
   published copy carries the honest path instead (`privacidade@miolos.app`,
   already the page's human channel), the gap is a **SOON** item in
   `docs/pending-fernando.md`, and #37's LGPD review under ADR-0012 owns
   the decision. **A fourth residual, related:** the loser of an account
   merge keeps its own `userId` alive as a PostHog `distinct_id` — outside
   the reach of `CONTEXT.md`'s Tombstone row and of `mergeAccounts`, which
   moves completion rows by raw SQL. #37 inherits that too.

   **The genuinely new privacy fact, named so #37 cannot miss it:**
   PostHog (US) now holds event rows keyed by the server `userId` — a
   third-party processor. The full telemetry-vs-policy LGPD review stays
   deferred to #37 under ADR-0012; this ADR is where that review starts,
   and the ORDERING that makes the deferral safe is written into the ledger
   item rather than left to memory: the privacy copy ships before the key
   does, and NOW §3 carries that as a hard precondition.

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
   contract admits one event with two properties. **It is not free,
   though, and the first draft of this sentence said "never money"** —
   step-6 security N1 and performance NB-2: `requireUserId` resolves the
   session (a read, an unconditional `recordSeenDay` write and sometimes a
   `last_seen_at` update) and `todaySaoPaulo(db)` is a real round trip, so
   one relayed event is 3–4 Neon round trips plus a Vercel invocation. The
   conclusion is unchanged — `POST /session` is a strictly more expensive
   unthrottled surface that already exists, so a limit here buys nothing —
   but "the relay is cheap, not free" is the honest framing. No rate limit at this traffic level; an
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
   `NEXT_PUBLIC_` twin** — a public twin would invite client use. One
   exists today, unread, on miolos-web, so **removing it is a REQUIRED step
   of the activation item, not an optional one** (step-6 security B2): an
   ADR that forbids the twin beside a runbook that makes removing it
   optional leaves exactly the state this decision says must not exist. Its
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
the first render and never updated for the `puzzle_started` snapshot or the
mount effect — putting the live value in the mount effect's dependency array
would re-run the restore, the prune and the sync registration whenever a
`GET /day` lands. The pause effect is the one exception: it
reads the live `remotelyClaimed`, not the mount snapshot, so a claim that
lands after mount still pauses a clock already running. On a **cold direct
load** the payload has not arrived at first render, so a day finished on
another device reports one `puzzle_started` before the remote view swaps in.
The case the gate actually covers is the **warm** one — a client-side navigation from the
hub, whose done tile links to the board route — which is the common path.

**The ARCHIVE's version of this is structural, not a timing window**
(step-6 correctness N7). The archive shells pass no `remotelyClaimed` at
all — they may not, by (c) — so an archived date the player completed on
another device reports one `puzzle_started` on every device that opens it,
with `archive: true`. Unlike (d)'s cold-load case, no gate can ever cover
it without putting a user-specific read back into the archive's module
graph. `useServerDayClaim` would answer `undefined` for an archived date
anyway, so the omitted flag is behaviourally identical to what a read
would have produced.

(e) `after()` throws outside a request scope, which is exactly how the API's
test suites invoke route handlers (a direct `POST(request)` call, no Next
server). `runAfterResponse` therefore falls back to immediate
fire-and-forget scheduling, chained onto a `telemetrySettled()` promise so
tests can await both positive and negative assertions. In a deployed route
the `after()` arm always wins; the fallback is a test seam, not a second
production path — and that is an assumption about a framework, so the catch
is narrowed to the known throw message and any OTHER throw logs once
before taking the fallback (step-6 quality B2). It cannot become a silent
second production path on a Next bump.

(f) Until the `POSTHOG_KEY` ledger item is discharged, the deployed helper
logs its one missing-key line and captures nothing. Exit criterion "the
dashboard verifies installation" is **pending on that item**, not silently
unmet. **`login_linked` additionally waits on Resend** (ledger NOW §1): the
attach flow is dormant in production, so discharging the key alone yields
four event streams, not five (step-6 issue B3). The ledger item says so.

(g) **The unrelated API suites print the missing-key line.** Five
pre-existing `apps/api` files exercise the four seam routes without stubbing
a key, so each prints one `POSTHOG_KEY is unset` `console.error` into the
gate log. That is decision 8's pin working, not a failure, and the
once-per-instance guard is what keeps it at five lines rather than
hundreds (step-6 quality NB-8).

(h) **The relay accepts a FUTURE date and labels it `archive: true`.**
`calendarDateString` validates that a string is a real calendar date, not
that it is a date this product has a puzzle for, so a session can post
`{game, date: "2030-01-01"}` and have it captured. No ADR-0004 exposure —
nothing about a puzzle travels either way — and no legitimate client can do
it, because a daily's date comes from the server payload and an archive
date from the URL. Left as garbage-in at telemetry grade rather than
closed, on the same footing as decision 7's unthrottled relay: a bound
would be a second date-validity spelling on a route whose contract
deliberately carries none (step-6 correctness N4, ADR N3). Whoever reads
the archive-engagement metric filters on it.
