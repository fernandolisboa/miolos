# Plan 064 — Issue #33: PostHog telemetry (M3)

**Tier 2.** Commits as `docs/plans/064-issue-33-plan-posthog-telemetry.md` (+ its `docs/README.md` row) in the same PR as the code. One PR. ADR number **0069** (reserved). Ground truth: step-1 explore report (`~/miolos-session/33-step1-explore.md`), all citations re-verified against `main` @ 93e58fd.

## The shape in one sentence

No client SDK at all: a ~1 kB hand-rolled server-side capture helper in `apps/api` posts the five events to `https://us.i.posthog.com/i/v0/e/`; four events fire at their server truth seams, and the one client-only event (`puzzle_started`) rides a Zod-parsed first-party relay route — so the five-event ceiling, no-replay and no-autocapture hold **by construction**, the key never ships in a bundle, and the `/` baseline is untouched.

## Decisions

**D1 — Capture mechanism: hand-rolled `fetch` to the PostHog capture API; zero new dependencies.**
`POST https://us.i.posthog.com/i/v0/e/` takes `{api_key, event, distinct_id, properties}` with no auth header (publishable token in body). A hand-rolled client structurally cannot autocapture, cannot replay, cannot lazy-load remote scripts — the "no sixth event / replay stays disabled" AC is satisfied by construction instead of by an 11-flag kill config that must be pinned forever. Zero bundle cost on `/` (napkin Domain #3), zero `minimumReleaseAge` friction, fewest-dependencies posture (CLAUDE.md), Resend-plain-fetch precedent (ADR-0050).
*Rejected:* `posthog-js` (~82 kB gz on the `/` baseline of every route + a kill config a test must pin + lazy remote-code loading); `posthog-js-lite` (~10-15 kB and still a client SDK holding its own device identity — see D6).

**D2 — Events fire server-side at truth seams; only `puzzle_started` is client-originated, via a first-party relay.**
- `puzzle_completed`, `streak_broken`: inside `POST /completions` (apps/api) — the authoritative write-once moment; offline/deferred syncs count correctly and idempotent replays (`recorded: false`) fire nothing, mechanically.
- `notification_opt_in`: inside `POST /push/subscriptions`, but **only on a genuine first insert** — `stored: true` is not enough. The write is `INSERT … ON CONFLICT DO UPDATE … RETURNING` (`apps/api/src/push/service.ts:59-106`) and the DO UPDATE arm also returns a row, so `stored: true` comes back on re-posts too (key rotation, identical re-subscribe, cross-user repoint); `stored: false` means only "the ceiling refused a new row". Firing on `stored` would re-fire on every successful re-post (#36's settings toggle is a named future re-poster). **Decision: detect insert-vs-update inside `upsertSubscription`** — extend its return to `{stored, inserted}` by adding `(xmax = 0)` to the RETURNING list (the Postgres idiom: a freshly inserted row has `xmax = 0`, an updated one does not; one statement, works over neon-http). If drizzle/neon rejects the expression, fall back to a pre-read `exists` on `(endpoint, user_id)` in the route — check-then-act is acceptable at telemetry grade, one indexed read; implementer verifies which lands. Fire only when `inserted` is true. This preserves the product meaning ("a user opted in") and a new endpoint on a second device firing again is a real opt-in act. Recorded in ADR-0069.
*Rejected:* firing on `stored` (mechanically false claim, re-fires on the DO UPDATE arm); redefining the event as "a consent act was stored" and accepting re-fires (weaker product meaning for zero savings).
- `login_linked`: inside `POST /attach/confirm` on success, property `merged` from the resolver (route line ~74). This route deliberately requires **no session** (the recovery browser may have none), so `requireUserId` is not in scope: the capture uses `distinct_id = resolved.winnerId` from the resolver. Dormant in prod until Resend activates — wired, fires zero times; not a blocker (explore §5).
- `puzzle_started`: no server fact exists (no row before completion), so the client relays it: `POST /telemetry` on apps/api, Zod-parsed against a closed contract, session cookie resolves `distinct_id`, then server-side capture. All server captures run inside Next's `after()` (`next/server`, stable in Next 16.2.12 — implementer verifies via context7) so no telemetry work ever delays a response.
*Rejected:* client-side `puzzle_completed` at the close effect (double-counts vs the queue's retries, misses offline flushes, and needs its own dedup — the row already is the dedup); pure client direct-to-PostHog (needs a client-held identity, D6).

**D3 — `streak_broken`: derived-on-return inside `POST /completions`.** The hardest one. The break itself happens at SP rollover, unobserved (ADR-0048: streak is read-time; no previous-value memory anywhere). Firing point: when a **counted** insert (outcome `won`, `onTime` true, `recorded` true — all in scope at route line ~474-493) starts a **new run after a gap**: load `listCompletionsForStreak(db, userId)` (exists, `packages/db/src/completions.ts:97`); fire iff **all four** hold on that one read: (i) a counted date exists with `date < body.date` and the max such date `prev` satisfies `prev < body.date − 1`; (ii) no *other* counted row exists on `body.date` (same-day second-game guard); (iii) **no counted row exists with `date > body.date`** — the inserted row must be the maximum counted date (the late-flush guard); (iv) `recorded` was true. Payload: `previous_streak = computeStreak(rowsBefore, prev).streak`, `broken_after_date = prev`, `gap_days = epochDay(body.date) − epochDay(prev) − 1` (the count of fully missed days; `epochDay` from `packages/core/src/date.ts`).
*The max-counted-date guard (iii) is load-bearing:* the sync queue flushes **newest date first**, deliberately (`apps/web/src/play/sync.ts:108-121` — today's daily always posts before a queued late completion), and ADR-0066 lets that late completion store counted (`on_time = true` inside the credit window). Without (iii), queue {D, D−1} over a D−5 history fires twice — once when D posts (`prev = D−5`), once when the counted D−1 lands (`prev = D−5`, no counted row *on* D−1). With (iii) either ordering fires at most once: D-first fires, then D−1 is not the max → silent; D−1-first fires, then D sees `prev = D−1` adjacent → silent. One extra condition on the read already being made; zero extra queries.
*Rejected:* client fire-on-return (reverses plan 027 D7's no-cached-streak, client clock adjacent); dispatcher-tick firing (ADR-0068's dispatcher enumerates only push-subscribed users at their habitual hour — covering everyone means a daily full-user scan plus a dedup ledger: real new surface for one event); a `previous_streak` column (a cache, against ADR-0051's philosophy); a fired-events dedup table (schema for telemetry — the guard above is free).
*Recorded semantics (goes in the ADR):* the claim is **at most once per break; exactly once in the sequential single-client case** — not "exactly once" unqualified. Two recorded edges, both accepted residuals in ADR-0069: (1) **retro-close spurious fire** — an insert on `D` with `prev = D−2` fires (1-day gap), then a later credited flush or archive solve of `D−1` (seen day, ADR-0066) retro-closes the gap: the streak never broke, but the event fired. Accepted and recorded rather than suppressed: bounded to exactly-1-day gaps inside the credit window, and zero extra queries. *Rejected:* a `wasSeenOn(db, userId, gapDay)` suppression read when the gap is exactly the credit window — trades a spurious fire for a possible missed one and adds a round trip for telemetry-grade accuracy. (2) **Two-device same-day race** — the guards are check-then-act reads inside `after()` with no transaction available (neon-http, the `guardedInsertSelect` constraint): two counted inserts racing can double-fire or both stay silent. Accepted with the READ COMMITTED reasoning ADR-0053 decision 13 already models; a single client is sequential (`sync.ts`'s `flushing` guard). Also stated: the event timestamp is return-time, not break-time (`broken_after_date` lets analysis re-anchor); a player who never returns, or never lands a counted completion, never fires it — telemetry observes players, not absences. A merge fires nothing here: `mergeAccounts` moves completion rows via raw SQL (`packages/db/src/merge.ts`), never through `POST /completions`.

**D4 — Event scope: archive plays fire `started`/`completed` with distinguishing properties; free play fires nothing, wall-enforced.** The invariant protects the streak, the stats distributions and the medals — PostHog is operational telemetry, and archive engagement is exactly what M3 wants to see. The server cannot perfectly split "archive URL" from "offline flush of the same date" (ADR-0066), so the honest property is the stored verdict: `on_time` on `puzzle_completed`; `archive: body.date !== todaySaoPaulo(db)` on `puzzle_started`. Free play: structurally silent (free-play hooks never mount `usePlayLifecycle`), AND `src/telemetry/` is added **by name** to the free-play static banned group + dynamic-import regex in `eslint.config.mjs` (object (3), ~line 693; groups ~216-424), with red/clean probes in `apps/web/test/eslint-free-play-wall.test.ts` — the wall is named-module and non-transitive (napkin Domain #2), so silence must be enforced, not assumed.

**Payloads (all five — minimal, no PII, no puzzle content per ADR-0004):**
- `puzzle_started`: `{game, date, archive}`
- `puzzle_completed`: `{game, date, elapsed_ms, outcome, on_time}` (a lost Termo fires with `outcome: "lost"`)
- `streak_broken`: `{previous_streak, broken_after_date, gap_days}` (`gap_days` defined in D3: `epochDay(body.date) − epochDay(prev) − 1`, missed days)
- `notification_opt_in`: `{}` (never the endpoint or keys)
- `login_linked`: `{merged}` (never the email)

**D5 — Ingestion route: direct `https://us.i.posthog.com` from apps/api; no Next rewrite proxy.** All PostHog traffic is server→server (D2), so CSP (none today beyond frame-ancestors), ad-blockers and the assets host are irrelevant to it. The only browser-visible telemetry request is `POST /telemetry` to our own API — first-party, same path class as `/streak`. Blockers with a generic `/telemetry` filter will drop `puzzle_started` for those users; accepted and recorded — honest naming over evasion ("observability without surveillance"). The host is a hard-coded constant (region confirmed US, issue #33 comment 2); no `POSTHOG_HOST` env.
*Rejected:* Next `rewrites()` proxy (+`skipTrailingSlashRedirect`, Vercel Hobby invocation/transfer per event, new surface, zero benefit once no client SDK exists).

**D6 — `distinct_id`: the server `userId`, resolved server-side from the session cookie. No new identity surface.** Three of the four server seams already hold `userId` (`requireUserId`), and the relay route resolves it the same way; the exception is `login_linked` — `POST /attach/confirm` requires no session (route ~130-137), so it captures with `distinct_id = resolved.winnerId` (D2). No PostHog device id, no new cookie, no localStorage identifier — so nothing new is stored on the device or about the user, and `/privacidade`'s published sentence ("Medições técnicas mínimas de uso e desempenho. Não gravamos a sua tela nem as suas sessões.", `messages.ts:839-840`) remains exactly true; **no copy change** (the #30/#145 precedent extends the inventory only when a new data class is stored — none is; the full telemetry-vs-policy LGPD review stays deferred to M4/#37 per ADR-0012). Capture sets `$process_person_profile: false` (anonymous-class events — no person profiles built; implementer verifies the exact property name in PostHog docs). Merge (ADR-0009/0049) re-keys later events to the winner `userId`; no `alias` call — accepted, five events don't need cross-device identity. **No opt-out UI this PR** — that is product surface the issue didn't ask for; the first settings surface (#36) / LGPD pass (#37) is its home. Recorded as a non-goal.

**D7 — Error Tracking / `$exception`: not wired here; explicitly #37's.** The plan's reading of "no sixth event exists": five *product-analytics* events; PostHog-internal `$*` events are a different class — but this PR ships **zero** of them anyway (no SDK, and the server helper's event type is a closed five-name union). Whether PostHog Error Tracking discharges #37's "error monitoring live on both apps" AC is decided in #37; nothing here forecloses it (server-side `$exception` capture would reuse this PR's helper). Stated in the ADR and the PR body.

**D8 — Env plumbing: the key moves server-side as `POSTHOG_KEY` on miolos-api; the ledger item ships by default.** The issue comment allows rename/move. **The PR includes the `docs/pending-fernando.md` NOW item in the same diff, wizard-ready (Do/Verify/Blocks/Source):** *Do* — `vercel env add POSTHOG_KEY` on miolos-api for Production/Preview/Development with the token from issue #33; optionally remove the unused `NEXT_PUBLIC_POSTHOG_KEY` from miolos-web (a `NEXT_PUBLIC_` twin would invite client use). *Verify* — `vercel env ls` shows it, then the PostHog dashboard's "Verify installation" goes green on the next deployed event. *Blocks* — all five events in production. *Source* — issue #33 + this PR. The implement step may still *attempt* the CLI move, but production env work by agents is classifier-blocked unattended (ledger NOW §2, the #59 precedent — done "Fernando present and approving"), so failure is the expected case; only a pasted `vercel env ls` proving success moves the item to the Done table in the same PR. Either way the ledger is correct at merge — a silent dormancy of the milestone's headline feature with no visible record is the failure this inversion prevents.
*Rejected:* ledger-item-only-as-fallback ("if CLI auth fails") — it bets the record on the unlikely arm and violates the ledger protocol's same-change rule when the bet loses.
`POSTHOG_KEY` joins `turbo.json` `tasks.build.env` (the #59 idiom; explore confirms it's absent). `apps/api/.env.example` gains a documented row (publishable token, but never commit even this one — CLAUDE.md). **Missing key ⇒ the capture helper no-ops but logs once** — `console.error` behind a module-level guard, the repo's own loud-degrade idiom (`streak-client.ts:16-24`, `bootstrap.ts:167-176`). "Telemetry absent is a valid state" justifies not breaking anything; it does not justify invisibility in the Vercel logs of the exact deployment where someone asks why the dashboard is empty. *Rejected:* the fully silent no-op (departs from the repo idiom with insufficient cause). Vitest/CI never send: no `POSTHOG_KEY` in any test env, and API tests stub the helper/fetch anyway; the once-guard keeps test output quiet and a test pins "logs once, sends nothing, never throws".

## Slices of work (file-level)

**S1 — Contract + server capture helper.**
- `packages/core/src/contracts/telemetry.ts`: `TELEMETRY_EVENTS` (the five names, `as const`), per-event property schemas (`z.strictObject` — repo zod is v4.4.3; not the legacy `.strict()`), the relay request schema (client-originated subset: `puzzle_started` only — `{event: literal, properties: {game: gameSchema, date: calendarDateString}}`). Export from the contracts barrel like `streak.ts`.
- `apps/api/src/telemetry/capture.ts`: `captureEvent(input: {distinctId, event: TelemetryEvent, properties})` → no-op without `process.env.POSTHOG_KEY`; `fetch(POSTHOG_INGESTION_URL, …)` with `AbortSignal.timeout(3000)`, catch-all, **never throws, never awaited by callers outside `after()`**. Host constant `https://us.i.posthog.com/i/v0/e/`.

**S2 — Server seams (apps/api).**
- `app/completions/route.ts`: after `written` (~line 474-493), inside `after()`: if `written.recorded` → capture `puzzle_completed`; if additionally counted → run the D3 break derivation (one `listCompletionsForStreak` call, at most once per counted insert, all four D3 conditions including the max-counted-date guard) and maybe capture `streak_broken`. The telemetry block must be positioned so the response construction is untouched — a thrown derivation error inside `after()` may never affect the response.
- `apps/api/src/push/service.ts` + `app/push/subscriptions/route.ts`: extend `upsertSubscription` to return `{stored, inserted}` (D2 — `(xmax = 0)` in the RETURNING list, or the pre-read fallback); route fires `after(capture notification_opt_in)` only on `inserted === true`.
- `app/attach/confirm/route.ts`: success paths → `after(capture login_linked {merged})`.

**S3 — Relay route.** `apps/api/app/telemetry/route.ts`: `POST` + `OPTIONS` (reuse `corsHeaders`/`preflightResponse`/`isJsonContentType` from `src/cors.ts`, credentials on); the sibling credentialed-POST origin guard — `warnIfGuardDegraded()` + `isCrossSiteWrite` reject (`src/session/origin-guard.ts`), for consistency with every other credentialed write route; session → `userId` (no session ⇒ 204 drop, no error surface for blockers/bots); Zod-parse against the relay schema (reject ⇒ 400); derive `archive` vs `todaySaoPaulo(db)`; `after(captureEvent)`; respond 204. `export const dynamic = "force-dynamic"` like siblings. *Abuse posture, recorded in ADR-0069 (the ADR-0006:51 residual idiom):* `POST /session` is free and unthrottled, so a flood is one minted cookie away; the cost is PostHog free-tier quota (telemetry blindness), never money or data. No rate limit at this traffic level — accepted residual, named.

**S4 — Client (apps/web).**
- `src/telemetry/client.ts` (the `streak-client.ts` shape — fetch-and-parse-only, no React): `markSessionReady()`, and `postPuzzleStarted(game, date)` — buffers until session-ready, per-`(game,date)` once-guard (module map), then `void fetch(${API_URL}/telemetry, {method POST, credentials include, keepalive true})`, catch-swallow. Missing `NEXT_PUBLIC_API_URL` follows that module's existing idiom.
- `src/session/bootstrap.ts`: after `ensureSession` settles (success or failure), call `markSessionReady()` — one import, one call; no other behavior change.
- `src/play/use-play-lifecycle.ts`: in the mount effect (~line 135-141), when `record === null` (fresh attempt — the one game-generic seam; explore §trigger 1) → `postPuzzleStarted(game, date)`. Fires for daily and archive alike (D4); never on restore/concluded. Never awaited — the completion write path stays untouched.
- Cross-device edge (ADR-0065): a day completed on another device opens the remote **completed view** on device B, where `record === null`. Verify at implement time that this path does not mount `usePlayLifecycle` (the expected shape — nothing to do); if it does, gate the fire and add one T-WEB case from headroom.
- Implementer note: the relay POST carries a JSON content-type, which forces a CORS preflight on `puzzle_started` — fine (fire-and-forget), but know that `keepalive: true` rides alongside the preflight; not a correctness issue.

**S5 — Wall.** `eslint.config.mjs`: `src/telemetry` added to the free-play banned groups (static + `freePlayDynamicBannedModule` regex) with its own message citing ADR-0069; red/clean probes in `apps/web/test/eslint-free-play-wall.test.ts` (source-scan assertions through the `code()` stripper, napkin Exec #3).

**S6 — Env + records.** `turbo.json` env; `apps/api/.env.example`; the `docs/pending-fernando.md` NOW item in the same diff, wizard-ready per D8 (attempted CLI success with pasted `vercel env ls` moves it to the Done table instead); **ADR-0069** ("Telemetry is five server-anchored events over a hand-rolled capture" — ceiling, D1-D8, privacy alignment, replay-off as a published promise, and the recorded residuals: D3's retro-close spurious fire and two-device race, D2's insert-detection choice, S3's unthrottled-relay quota exposure) shipped `Proposed` and flipped `Accepted` in this same PR (domain.md lifecycle, napkin Exec #5); plan 064 committed; two `docs/README.md` rows (plan + ADR). ADR-0069 also names the genuinely new privacy fact — **PostHog (US) now holds event rows keyed by the server `userId`, a third-party processor** — as the residual explicitly deferred to #37's LGPD review (ADR-0012), so #37 cannot miss it; the no-copy-change reasoning (D6) is unaffected.

## Test plan (counts; ids reserved on #33 by the orchestrator)

- **T-CORE ×2** (1 + headroom): the telemetry contract — exactly five event names, strict property schemas reject extras/PII-shaped fields.
- **T-API ×21** (20 + 1 headroom — B1's two added cases absorbed from the reserved headroom, total ids unchanged): capture helper 3 (no-key logs once, sends nothing, never throws — the D8 pin; never-throws on network failure/timeout; posted body shape incl. `distinct_id` and `$process_person_profile`); relay route 4 (no-session 204-drop; Zod reject; `archive` derivation; happy path captures with resolved userId); `puzzle_completed` seam 3 (fires on `recorded: true` with full payload; silent on idempotent replay; response unaffected when capture throws); `streak_broken` 6 (gap fires once with `previous_streak`/`gap_days`; adjacent-day continuation silent; first-ever-counted silent; second counted same day silent; **counted late flush arriving after today's counted insert is silent — the B1 repro, pins the max-counted-date guard**; **gap-of-1 fire with the gap day seen still fires — pins the accepted retro-close residual, D3**); `notification_opt_in` 2 (first genuine insert fires; **re-post of an existing endpoint — the DO UPDATE arm — is silent**, exercising `inserted === false` and not merely the ceiling refusal); `login_linked` 2 (fires with `merged`; payload carries no email — through `code()`-style inspection of the captured body).
- **T-WEB ×8** (6 + 2 headroom): client module 4 (buffers until `markSessionReady`; fire-and-forget never throws on a rejecting/never-resolving fetch stub — the "no blocking requests" pin; once-guard per (game,date); request shape via `vi.stubGlobal("fetch")`, the `streak-client.test.ts` pattern); lifecycle 2 (fires on fresh mount only; silent on restored and on concluded records).
- **T-LINT ×2** (1 + headroom): the wall probes, red at free-play paths and clean at daily paths, one id both arms (T-LINT-S49/S50 shape).

Total reserved: **33 ids** across four areas, headroom included; re-derive the frontier by grep at branch time and after the pre-gate `git merge origin/main` (napkin Orchestration #6).

## Gate & evidence plan

- `pnpm typecheck --force`, `pnpm lint`, `pnpm test --force` — real output pasted (evidence rule; cached runs are replays, napkin Exec #8).
- **Bundle figures duty (napkin Domain #3):** `pnpm build && pnpm bundle-check` **from `apps/web`**, before and after, every route **including `/`** published in the PR body. Expected: `/` grows ~1 kB — `bootstrap.ts` (mounted in the root layout via `<SessionBootstrap/>`) importing `markSessionReady` pulls `telemetry/client.ts` into the `/` baseline chunk graph — while the daily + archive **deltas over `/`** move ~0; budgets are never retuned. (One module kept deliberately; splitting a tiny session-ready module out of the poster was rejected as complexity for no budget benefit — the figures duty catches reality either way.) No new web route ⇒ no `route-client-js.mjs` classification change (it must still exit 0).
- **No blocking requests on the play path**: the T-WEB never-resolving-fetch test + the structural facts (client fire-and-forget `void`; server captures inside `after()`), stated with the test ids in the PR body.
- **No `npx impeccable detect`**: zero UI changes (no opt-out toggle by D6 — reason stated in the PR body).
- Zod at the one new boundary (relay route); no new dependencies (D1) so `minimumReleaseAge` is moot; no DB migration so the deploy trap is not in play.
- PR body: tier named (2), what changed, decision D7's #37 note, and the activation state: the `docs/pending-fernando.md` NOW item is in the diff (D8) — Fernando runs the env move via `/wizard` — unless the attempted CLI move succeeded with `vercel env ls` output pasted, in which case the item sits in the Done table and the PR says "nothing needs Fernando".

## Exit criteria

1. All five events captured at the D2 seams with the D4 payloads; the dashboard's "Verify installation" goes green on the first deployed event **once the key is live (the D8 ledger item — discharged in-PR only with pasted `vercel env ls` evidence)**; until then the deployed helper logs its one missing-key line and the criterion is pending on that item, not silently unmet.
2. Event-name ceiling pinned by type union + contract test; no SDK, no `$pageview`/`$exception`/replay code path exists anywhere.
3. Wall extended with green probes; free play provably silent.
4. Gate green with pasted output; bundle before/after published; ADR-0069 `Accepted`, plan 064 + both README rows in the merged diff; issue #33 closed.

## Non-goals

No client PostHog SDK; no error tracking / `$exception` (D7 → #37); no opt-out or settings surface (D6 → #36/#37); no privacy copy change (D6, reasoned); no pageviews, web vitals, heatmaps, surveys, flags; no Next rewrite proxy; no `alias`/person-profile identity work; no email hedge or dispatcher changes.

---

**Summary.** The plan ships PostHog with zero dependencies and zero client SDK: a small server-side capture helper in `apps/api` posts to the US ingestion endpoint with `distinct_id` = the existing server `userId`, four events fire inside their authoritative routes (`puzzle_completed` and a derived-on-return, at-most-once-per-break `streak_broken` in `POST /completions`, `notification_opt_in` on a genuine first-insert subscription, `login_linked` on attach confirm keyed by the resolver's `winnerId`), and `puzzle_started` — the only event with no server fact — rides a Zod-parsed first-party `POST /telemetry` relay fired fire-and-forget from the shared play-lifecycle mount seam, covering daily and archive with an `archive`/`on_time` distinction while free play is silenced both structurally and by a named extension of the ESLint wall. The five-event ceiling, no-autocapture and no-replay hold by construction; the `/` baseline grows only by the ~1 kB client module with before/after figures published; the `POSTHOG_KEY` production move ships as a wizard-ready `docs/pending-fernando.md` item in the same PR; ADR-0069 records the whole posture — including the D3 residuals, the relay quota exposure and the PostHog-as-processor fact deferred to #37's LGPD review — and error tracking is explicitly left to #37.

---

## Step-4 changelog (review `33-step3-review.md`, verdict REJECT — all 3 blocking + 9 non-blocking applied, none disputed)

- **B1**: D3 gained condition (iii), the max-counted-date guard (kills the newest-first-flush double-fire, `sync.ts:108-121` re-verified); the claim weakened to "at most once per break; exactly once in the sequential single-client case"; the retro-close edge decided as accept-and-record (rejected: `wasSeenOn` suppression) and the two-device race recorded as an accepted residual; `gap_days` defined (`epochDay` arithmetic); T-API `streak_broken` grew to 6 with the B1 repro and the retro-close pin, absorbed from headroom (20 named + 1 headroom, 33 ids unchanged).
- **B2**: D2's false `stored: true` claim replaced with insert-vs-update detection in `upsertSubscription` (`(xmax = 0)` in RETURNING, pre-read fallback; option (a), recorded in ADR-0069); S2 updated; the re-post test now exercises the DO UPDATE arm.
- **B3**: D8 inverted — the wizard-ready ledger NOW item ships in the PR by default, CLI success (with pasted `vercel env ls`) moves it to Done; missing key now logs once via `console.error` (repo idiom) instead of silent no-op, with a test pin; exit criterion 1 made conditional on the ledger item; PR-body line updated.
- **N1**: D6/D2 corrected — `login_linked` uses `resolved.winnerId` (no session on `/attach/confirm`); merge-fires-nothing note added to D3 (`merge.ts` raw SQL).
- **N2**: S3 gained `warnIfGuardDegraded` + `isCrossSiteWrite` (path corrected to `src/session/origin-guard.ts`) and the recorded unthrottled-relay quota residual.
- **N3**: bundle expectation fixed — `/` grows ~1 kB, deltas over `/` move ~0; one module kept, split rejected.
- **N4**: S4 gained the ADR-0065 remote-completed-view verification sentence (+ conditional T-WEB headroom case).
- **N5**: S6/ADR-0069 gained the PostHog-as-third-party-processor residual, named for #37.
- **N6**: firing point kept; `gap_days` defined in D3 and the payload table.
- **N7**: B1/B2 cases absorbed into reserved headroom; counts annotated, 33 ids unchanged.
- **N8**: `z.strictObject` in S1; `after()` note kept; the preflight/keepalive implementer note added to S4; the review's `src/cors.ts` attribution for the origin guard was inaccurate — helpers live in `src/session/origin-guard.ts` (verified), written correctly.
- **N9**: D4/D5/D7, non-goals, ADR lifecycle — unchanged as ruled.

---

## Step-5 deviations (appended at implementation; the plan body above stays as written)

A plan is a point-in-time snapshot. These are the places where the code
contradicts it, each with the reason and the record that now governs.

- **D2 / S2 — `(xmax = 0)` in the RETURNING list does not type.** The plan's
  first choice for insert-vs-update detection fails on a clean tree: `Db` is
  a union of two drizzle database classes (`apps/api/src/db/client.ts`), and
  TypeScript cannot resolve the generic fields-overload of
  `.returning(fields)` through a union of overloaded methods — only the
  0-arg signature survives, so the projected form is TS2554 (probed against
  both the `.select()` and `.values()` chains). **The plan's own named
  fallback lands instead**: a pre-read `exists` scoped to the caller's
  `(endpoint, user_id)`, one read on the endpoint PK. The plan anticipated
  this arm ("implementer verifies which lands"), so it is a resolution
  rather than a departure. Recorded in ADR-0069 decision 6, with the
  check-then-act residual priced at telemetry grade and the CEILING left
  untouched inside the insert.

- **S4 — the cross-device gate travels as an INPUT, not as a read.** The
  plan's conditional arm fired (the remote completed view does mount
  `usePlayLifecycle`), but its prescription — read the claim inside the hook
  — cannot ship. `play/day-state.ts` reaches `src/day/**`, and
  `apps/web/test/archive-day.test.tsx` asserts that no archive page's module
  graph contains either, because the archive's play shells mount the same
  hook and a user-specific read on a public crawler-facing route is what
  ADR-0053 decision 10's "Why no endpoint" rules out (**not** decision 9,
  which is "there is no archive conclusion route" — step-6 ADR B1; the
  correction landed at every site in the step-7 round). The first
  implementation did read it there
  and **made that test red**. So `usePlayLifecycle` gained a
  `remotelyClaimed` input, the four daily screen roots pass what they
  already hold for their own render-time swap, and the archive shells pass
  nothing. Recorded in ADR-0069 consequences (c) and (d), the second of
  which prices the cold-direct-load residual the plan already anticipated.

- **S4 — `record === null` is spelled `record === undefined`.** The plan's
  freshness test names a value `readPlayRecord` does not return. No
  behavioural difference; noted so a later reader does not hunt for a null.

- **S6 / D8 — no `vercel env` command was attempted.** The plan permitted an
  attempt and predicted failure; production-credential commands are
  classifier-blocked in an unattended session, so the attempt was skipped
  rather than run into the block. The ledger NOW item — which the plan makes
  the default path — ships in this PR, and the exit criterion stays pending
  on it exactly as the plan's B3 inversion specifies.
