# Plan 063 — Issue #146: the streak-at-risk dispatcher

**Tier 2, step 2 (Plan).** Commits as `docs/plans/063-issue-146-plan-streak-at-risk-dispatcher.md` in the implementing PR, with its `docs/README.md` "Current" row (docs numbering is global; highest committed doc is 062).

**Governing records — do not reopen:** ADR-0064 decisions 1, 3, 6, 7, 8, 9, 10 (Accepted, PR #154); ADR-0048 (the at-risk state); Fernando's #32 answers of 2026-08-20: **Q1 = 1a** (dual-consent users get push only; email is the fallback when no push subscription exists — slice C's rule) and **Q2 = 2a** (the nudge fires for **any** live streak at risk — **no `>= 3` gate anywhere in the candidate SQL**). Every citation in this plan was verified against the tree on 2026-08-20; the `percentile_disc` probe in §4.4 was **executed**, not assumed.

**What is live the moment this merges: VAPID is configured in production and `CRON_SECRET` is a GitHub repo secret (both in `docs/pending-fernando.md`'s Done table — never re-ask either). The dispatcher is NOT dormant.** Real subscription rows can exist; the first top-of-hour Actions tick after merge sends real notifications. §11 gives the safe order.

## 0. Revision record (step 4, 2026-08-20 — the step-3 review's blockers, applied)

1. **Cap guard (§4.6/§6.2):** the `exists` disjunct is now scoped to `(endpoint, user_id)` — unscoped, a second anonymous session could mint endpoints the first re-posts to itself past the ceiling. Residuals restated as (i) READ COMMITTED overshoot and (ii) at-cap cross-user-repoint → 429; T-API-S151 gains that case. The shipped client tolerates the 429 (review-verified).
2. **Floor justification (§6.1):** "a nudge that can never fire" was false — half-up fires the 23:40-habit nudge at the 00:xx tick, ~24 h early, minutes after the habitual play. Replaced with that true reason; floor stays.
3. **Frontier narrative (§7/§10/§12):** #158 (PR #166, commit 80f030a) merged and already reconciled `docs/agents/test-ids.md` — the "correct the stale S290 row" duty would now write a false record and is dropped; the S297–S298 reservation stands; re-derive by grep (and the 063/0067 doc numbers) at commit time.

Review notes (a)–(f) folded in place: §6.4 renumbered 5e/5f; the d1 narrowing and the credited-sync-instant sample recorded (§6.1/§9); the unclaimed-tail residual added (§4.10/§9); §3's join-order claim corrected honestly; T-WEB-S297 also pins `-X POST`.

---

## 1. Scope in one paragraph

The sending half of #32, push channel only: migration 0010 (`notification_sends`), a candidate reader in SQL on the DB clock, `POST /cron/notify` behind the extracted fail-closed `isAuthorized`, an hourly GitHub Actions tick, `web-push` sends with pt-BR copy carrying `computeStreak`'s number, 404/410 pruning, a per-user subscription ceiling (the #145 residual), and a `mergeAccounts` duty for the ledger. No UI change, no email sending (slice C), no new Fernando action.

## 2. Read first (a fresh implementer's list)

- `docs/adr/0064-streak-at-risk-is-a-derived-decision.md` — decisions 1, 6–10 are the spec.
- `apps/api/app/cron/publish/route.ts` — `isAuthorized` (to extract), fault isolation, per-line JSON logging, side-duty wrapping.
- `apps/api/src/push/service.ts`, `apps/api/src/push/config.ts`, `packages/core/src/contracts/notifications.ts` — what #145 shipped.
- `packages/db/src/completions.ts` (`listCompletionsForStreak`, `writtenOnSaoPauloDay`'s SP register), `packages/db/src/merge.ts` (statements 1b/4b/4c), `packages/db/src/buffer.ts:todaySaoPaulo`.
- `.github/workflows/buffer-alert.yml` — the workflow template. `apps/api/vercel.json`. `apps/web/public/sw.js`.
- `.claude/napkin.md` §Shell 2 (Neon apply ritual), §Deploy 1 (preview shares prod DB), §Execution 2/8 (gate evidence).

## 3. Step 0 — migration 0010, applied to Neon BEFORE the branch's first push

Drizzle schema addition (`packages/db/src/schema.ts`):

```ts
export const notificationSends = pgTable(
  "notification_sends",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),           // the SP day the nudge protects (= today at claim time)
    channel: text("channel").notNull(),     // 'push' | 'email' — slice C's arm rides the same ledger
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date, t.channel] }),
    check("notification_sends_channel_check", sql`${t.channel} in ('push','email')`),
  ],
);
```

Doc block states: append-only; the ONLY writers are the dispatcher's claim (`INSERT … ON CONFLICT DO NOTHING RETURNING`, before any send — ADR-0064 d7) and `mergeAccounts`' union/empty pair (§6.4); the only reader is the candidate prefilter (§6.1). Generated as `packages/db/migrations/0010_*.sql` via the repo's drizzle-kit ritual — expected SQL: `CREATE TABLE "notification_sends" (…)` with the composite PK, the CHECK, and the FK `ON DELETE cascade` (the 0007 register). **Re-derive the number at implement time** — 0009 is the highest on `main` now; a parallel landing moves it.

**Apply ritual (napkin §Shell 2 + §Deploy 1):** preview deploys share the production Neon DB, so apply before the branch's first push — a new table changes no INSERT column list (no drizzle column-list trap), but the schema-before-code order costs nothing and removes all thought. `vercel env pull` to a path outside the repo, temp script over `<repo>/packages/db/node_modules/@neondatabase/serverless/index.mjs`, one `query()` per `--> statement-breakpoint` chunk, then delete script + env file. Paste the verification in the PR body.

No index beyond the PK: the ledger is looked up by its full key. (The candidate query's habitual CTE aggregates over every user with in-window completions before the `push_subscriptions` join — the honest cost statement and the revisit path are in §6.1's doc block.)

## 4. The open decisions, resolved

Numbered as in the step-1 report §(d). Nothing here reopens a closed decision.

1. **`POST /cron/notify`.** The issue says POST and POST is right: the tick causes writes and sends, and this route is never Vercel-cron-driven (Vercel's cron sends GET — the reason `/cron/publish` is a GET). The Actions curl does `-X POST` trivially. **No `export const dynamic = "force-dynamic"`**: only GET handlers participate in Next's static optimisation; a POST handler is dynamic by definition — say so in a comment where publish's export would be, so the asymmetry reads as a decision. No CORS, no OPTIONS (publish's "not a browser endpoint" posture).

2. **`isAuthorized` extracts to `apps/api/src/cron/auth.ts`** (new directory, the `src/push`/`src/session` shape), doc block moved verbatim with it (plan 014 D15 + ADR-0022 citations intact). `app/cron/publish/route.ts` imports it — **zero behavior change to publish**, pinned by the existing `cron-publish.test.ts` auth assertions staying green untouched. Both routes call the one function.

3. **The current-SP-hour seam: one DB snapshot, then parameters all the way down.** New reader `readTickInstant(db)` → `{ today, hour }` in ONE statement — `select ((now() at time zone ${SAO_PAULO_TIME_ZONE})::date)::text as today, extract(hour from now() at time zone ${SAO_PAULO_TIME_ZONE})::int as hour` (the `todaySaoPaulo` shape-check register; one statement so date and hour can never straddle midnight against each other). The route reads it once and passes `{today, hour}` into the tick; `listPushNudgeCandidates(db, {today, hour})` and everything below take them as parameters. **Every behavioral test is therefore real-clock-free and deterministic** — explicit `today`/`hour`/`completed_at` fixtures; PGlite's unfakeable `now()` is touched only by `readTickInstant`'s own shape/range test. This is still "DB clock only, no JS `Date` in any statement": the values originate in one Postgres read and JS never computes a date or hour. Route-level tests assert auth, dormancy and contract shape; the send behavior is proven at the tick seam below the snapshot (no `now()`-relative seeding, no boundary-crossing flake window).

4. **`percentile_disc(0.5)` works under PGlite — probed in this session, evidence:**

   ```
   $ node pglite-percentile-probe.mjs        # PGlite from packages/db/node_modules
   percentile_disc: [{"med":2}]              # within group (order by v), values (1),(2),(9)
   tz extract: [{"h":18}]                    # extract(hour from tstz at time zone 'America/Sao_Paulo')
   combined: [{"medh":8}]                    # percentile_disc over per-row SP hours → 8, correct
   ```

   The ordered-set aggregate, the SP-hour extraction and their composition all run in the WASM build. No fallback needed; the candidate SQL commits to the ADR-0064 d1 spelling.

5. **`mergeAccounts` gains a `notification_sends` duty: union then empty** (the 4b/4c seen-days idiom exactly — §6.4). Without it, a same-day merge of a claimed loser into an unclaimed at-risk winner re-nudges the winner, and loser rows would reference the tombstone against ADR-0049 d6's "emptied means EMPTIED". `ON CONFLICT DO NOTHING` on the composite PK (presence is presence — whichever `sent_at` survives is immaterial, the row's whole function is "do not send again"); individually idempotent; T-DB-S20's double-run snapshot and fixture are **widened in place** (the `push_subscriptions`/`user_seen_days` precedent, no new id).

6. **Per-user subscription ceiling: 10 distinct endpoints, enforced write-side, folded into the INSERT.** The residual's threat is one session inserting unbounded DISTINCT endpoints the dispatcher must then HTTP-request each tick; a write-side ceiling bounds storage AND sends, where a dispatch-side cap bounds neither storage nor honesty. 10 covers any real device fleet (phone + desktop + tablet + spare browsers) with slack. Mechanism is the `guardedInsertSelect` precedent (completions.ts — check-then-act was measured broken there; the folded guard is the fix): the upsert's proposed row is guarded by `((select count(*) from push_subscriptions where user_id = X) < 10 or exists (select 1 from push_subscriptions where endpoint = E and user_id = X))` — the `exists` disjunct is load-bearing: without it, `ON CONFLICT DO UPDATE` never fires at the cap because no row is proposed, and a key-rotation re-subscribe on a full account would silently fail. **The disjunct is scoped to the caller `(endpoint, user_id)` on purpose:** unscoped (`endpoint = E` alone) it defeats the cap against its own threat model — the shipped upsert repoints an endpoint to the posting user (the `created_at` CASE exists precisely for that), so a second anonymous session could insert 10 attacker-invented https endpoints (the Zod floor admits any https URL) and the first session could re-post them to itself, `exists` passing each round, accumulating unbounded rows the dispatcher must HTTP-request each tick — the exact #145 residual this cap exists to close, re-opened through a side door. **At the cap, a NEW endpoint answers 429** (the late-write-ceiling status precedent), stores nothing; a same-user re-subscribe of an existing endpoint upserts normally; **a cross-user repoint at the cap also answers 429** — correct, since the repoint would raise the new owner's fan-out past the ceiling. Honest residuals, stated in the doc block: (i) READ COMMITTED lets concurrent in-flight inserts overshoot by the number in flight (ADR-0053 d13's exact bound); (ii) the at-cap cross-user-repoint refusal — a full account cannot take over an endpoint another user holds until it frees a slot. Touches `upsertSubscription` + the subscribe route; no client change shipped — the shipped `postPushSubscription` returns `response.ok`, so a 429 reads as "not stored" and takes T-WEB-S271's existing unwind path (verified against the shipped client in the step-3 review, not assumed).

7. **`pushsubscriptionchange`: NOT in this ticket — assigned to #36, recorded on ADR-0064 decision 10 as an annotation.** Reasons: the handler needs a credentialed cross-origin re-POST from worker context — a new network-capable surface in a worker whose whole ADR-0004 argument is "no third capability" (T-WEB-S261 pins the exact listener set); the event is rare and browser-initiated; the granted-but-unsubscribed install is already re-askable at #36's settings toggle, which is the recorded re-ask surface; and 404/410 pruning here keeps the table honest meanwhile. **Action filed, not observed:** the implementing PR posts a comment on #36 ("the toggle ticket decides/ships the `pushsubscriptionchange` re-post; ADR-0064 d10 annotation (a) has the context") and writes that annotation. No new ticket.

8. **pt-BR copy lives in `apps/api/src/notify/copy.ts`** (the `email/copy.ts` precedent — the payload is composed server-side; `apps/api` has no `messages.ts` and the strings-externalised rule's recorded exception machinery is web-side). Exact strings (professional copy decision, made here, not brought to Fernando; CONTEXT.md vocabulary — *sequência*, *virada*):
   - `title`: `"Miolos"`
   - `body`, n ≥ 2: `` `Sua sequência de ${n} dias termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.` ``
   - `body`, n = 1: `"Sua sequência de 1 dia termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la."`
   No puzzle content, ever. The number comes from `computeStreak(rows, today).streak` over `listCompletionsForStreak` — copy only, never the send condition.

9. **Response contract `cronNotifyResponseSchema`** in `packages/core/src/contracts/cron.ts` (the register already there), strict: `{ candidates, claimed, sent, pruned, failed }`, all `z.number().int().min(0)`. Parsed before `Response.json` (the publish precedent). Status semantics: **401** unauthorized; **503 when `!isPushConfigured()`, before any DB read** — the subscribe routes' fail-closed posture, and a red hourly Actions run on a misconfigured prod IS the alert (`curl -fsS` makes it one); **200** whenever the tick ran, even with `failed > 0` (a lost nudge is the priced d7 residual, not an outage — per-line `{event:"cron-notify", …}` JSON logging carries the observability, publish's idiom). An escaped throw 500s naturally.

10. **Serial sends, no artificial candidate cap, `maxDuration: 60`.** The publish cron's measured reasoning holds (round-trips dominate; concurrency multiplies connection pressure); v1 scale makes N small. `apps/api/vercel.json` `functions` gains `"app/cron/notify/route.ts": { "maxDuration": 60 }`; the `crons` array **must not** gain an entry (ADR-0064 d8). Revisit trigger recorded in ADR-0067: when a tick's logged `candidates` approaches ~150, introduce bounded concurrency — a measured trigger, not a guess. Honest crash-window statement: claim-before-send means a timeout or crash between a user's claim and their send loses that user's nudge for that day; that is ADR-0064 d7's priced residual, restated, not a new decision. A distinct residual, also stated: a 60 s timeout silently drops the **unclaimed tail** of an oversized candidate list for that hour — those users are never claimed and never sent; recorded in ADR-0067 beside the skipped-tick residual (§9).

11. **Email arm: nothing ships, nothing is precluded.** The `channel` CHECK admits `'email'`; `claimNudgeSend` takes `channel: "push" | "email"`; the candidate reader is push-named (`listPushNudgeCandidates`, joins `push_subscriptions`) so slice C writes its own reader with Q1 = 1a's `NOT EXISTS (push subscription)` conjunct without touching this one. No speculative email code (the unused-surface finding class).

12. **The candidate reader and the claim live in `packages/db/src/notify.ts`**, exported via **`@miolos/db/user`**. The reader is cross-table (completions × push_subscriptions × notification_sends) — `packages/db` owns cross-table operations (merge.ts's recorded rule); the `pruneSeenDays` precedent already puts a cron-side duty on the user entry. The `user.ts` export-list tripwire (`test/user.test.ts`) and `T-DB-9e`/`T-DB-S5` counters are **widened in the same diff** (standing precedent, no new ids). `notificationSends` the table joins `user.ts`'s schema export line (beside `completions`, `hintGrants`) — NOT the root entry (`index.ts` stays pinned as-is; apps/web must not be able to name the ledger).

13. **ADR-0064 annotations owed (falsified records):** consequence (d) — Q1 is answered (1a, Fernando 2026-08-20, recorded on #32); decision 3's "Fernando's confirmable default" — confirmed (Q2 = 2a); decision 10's note — the #146 call is made (deferred to #36, annotation per resolution 7). All three in the implementing PR's docs commit.

14. **A new ADR is warranted: ADR-0067, `Proposed`, flipped to `Accepted` in the shipping PR** (lifecycle per `docs/agents/domain.md`). Reason: this ticket makes six genuine decisions ADR-0064 explicitly left open or never touched — the subscription ceiling (a behavior change at a shipped boundary), the ledger merge duty, the one-snapshot tick instant, POST + 503 dormancy semantics, serial sends with a measured revisit trigger, and the `pushsubscriptionchange` deferral — and scattering six decision-weight annotations across ADR-0064 would bury them. ADR-0064 gets the three thin annotations of resolution 13 (its own falsified sentences), each pointing at 0067 where the new decision lives. 0067 also records, with its reason, the one deliberate duplication: the candidate SQL encodes "a day counts iff a won ∧ on-time row exists" as a **prefilter** — ADR-0048's `computeStreak` remains the only streak authority (the copy's number comes from it, and a T-API test pins the sent number to it); running `computeStreak` over every user per tick is the rejected alternative (cost without a correctness gain). Sketch in §9.

## 5. Dependency: `web-push`

- `pnpm add web-push` in `apps/api` (runtime dep) + `pnpm add -D @types/web-push` (no bundled types; the DefinitelyTyped package is the right call over a hand-rolled local declaration for a crypto-adjacent API surface — drift there is exactly where `strict: true` should be leaning on upstream). Versions verified this session: `web-push@3.6.7` (2024-01-16) and `@types/web-push@3.6.4` (2024-10-22) — both far outside `minimumReleaseAge: 10080`, so both resolve.
- Transitive deps (`asn1.js`, `http_ece`, `https-proxy-agent`, `jws`, `minimist`) are age- and `trustPolicy: no-downgrade`-checked at install. If `ERR_PNPM_TRUST_DOWNGRADE` fires on any, the fix is an exact `name@version` `trustPolicyExclude` entry with a comment verified against the registry — never a bare name (napkin §Shell 7).
- `packages/games` untouched (zero-Node-deps invariant; ADR-0064 d9 already prices the exception as apps/api-only).

## 6. The build, module by module

### 6.1 `packages/db/src/notify.ts` — new

```ts
export async function listPushNudgeCandidates(
  db: Db, args: { today: string; hour: number },
): Promise<string[]>   // user ids
```

One statement (drizzle `sql` template; `SAO_PAULO_TIME_ZONE` imported from `./published`, never a literal):

```sql
with counted_day_starts as (
  select c.user_id, c.date, min(c.completed_at) as first_on_time
  from completions c
  where c.outcome = 'won' and c.on_time
    and c.date >= ${today}::date - 21 and c.date < ${today}::date
  group by c.user_id, c.date
),
habitual as (
  select user_id,
         (percentile_disc(0.5) within group (
            order by extract(hour from first_on_time at time zone ${SAO_PAULO_TIME_ZONE})
          ))::int as habitual_hour
  from counted_day_starts
  group by user_id
)
select distinct p.user_id
from push_subscriptions p
join habitual h on h.user_id = p.user_id
where h.habitual_hour = ${hour}::int
  and exists (select 1 from completions y
              where y.user_id = p.user_id and y.date = ${today}::date - 1
                and y.outcome = 'won' and y.on_time)
  and not exists (select 1 from completions t
              where t.user_id = p.user_id and t.date = ${today}::date
                and t.outcome = 'won' and t.on_time)
  and not exists (select 1 from notification_sends n
              where n.user_id = p.user_id and n.date = ${today}::date
                and n.channel = 'push')
```

Doc block records: the ADR-0064 d1 spelling — "median SP minute-of-day … rounded to the hour" is implemented as `percentile_disc` over the per-counted-day earliest instant's **extracted hour** (extraction = floor of minute-of-day to the hour; equivalent to flooring the median sample's minute-of-day, and floor rather than round-half-up is deliberate — half-up rounds a 23:40 habit to hour 0, and that nudge still fires, at the worst possible moment: the 00:xx tick of the at-risk day itself, yesterday counted and today not, ~24 h before the deadline and minutes after the user habitually finished playing. Floor lands it at the 23:xx tick — just before the habitual minute and ~1 h before the rollover); the sample deliberately narrows d1's "earliest on-time completion" to won∧on-time rows — one predicate does both the counted-day and the sample job; a lost-but-on-time earlier play is excluded (recorded in ADR-0067's prefilter note, §9); an ADR-0066 credited yesterday satisfies the conjuncts by design, and its `completed_at` — the sync instant, not a play instant — feeds the median as a sample (accepted imperfection); the 21-day window is `[today − 21, today)`; cold start is structurally absent (a candidate counted yesterday ⇒ ≥ 1 sample); the ledger `not exists` is a **prefilter only** — the claim insert is the race authority; the counted-day conjuncts are ADR-0048's prefilter, not a second streak definition (§4.14); the habitual CTE aggregates over every user with in-window completions before the `push_subscriptions` join (the planner will not reliably push the join through the GROUP BY) — harmless at v1 scale, and a subscriber prefilter inside the CTE is the recorded restructure if tick timings ever show it; `CompletionRecord` is untouched and `completed_at` never leaves SQL. Rides `completions_user_date_idx`. **No JS `Date` anywhere.**

```ts
export async function claimNudgeSend(
  db: Db, args: { userId: string; date: string; channel: "push" | "email" },
): Promise<boolean>    // true = this call owns the send
```

`INSERT … ON CONFLICT DO NOTHING RETURNING`, `sent_at` DB-side default — the write-once idiom, race-safe without transactions (neon-http constraint).

```ts
export async function readTickInstant(db: Db): Promise<{ today: string; hour: number }>
```

The one-snapshot reader of §4.3, with `todaySaoPaulo`'s shape-check-and-throw register (parse the row, throw on surprise).

Exports join `@miolos/db/user` (`user.ts`); tripwires widened in the same diff (§4.12).

### 6.2 `apps/api/src/push/service.ts` — two additions

- `listSubscriptions(db, userId)` → `{ endpoint, p256dh, auth }[]` (single-table, rides `push_subscriptions_user_id_idx` — the index's own doc block names this read).
- `pruneSubscription(db, endpoint)` — delete by endpoint PK, **no user scope**: the dispatcher acts on rows it just read, and a 404/410 is the push service's verdict about the endpoint itself. Doc block distinguishes it from `deleteSubscription`'s own-rows-only client path (that scoping is a session-boundary defence; no session is on this path).
- `upsertSubscription` gains the folded ceiling of §4.6 (INSERT … SELECT … WHERE guard with the `exists` disjunct scoped to `(endpoint, user_id)`, + `ON CONFLICT DO UPDATE`, the existing `created_at` CASE preserved byte-for-byte). Returns whether a row landed so the route can 429. `PUSH_SUBSCRIPTION_CEILING = 10` as a named constant with the decision comment; the doc block carries §4.6's two residuals.

### 6.3 `apps/api/src/notify/` — new: `copy.ts`, `transport.ts`, `dispatcher.ts`

- `copy.ts`: `nudgeCopy(streak: number): { title: string; body: string }` — §4.8's strings.
- `transport.ts`: `sendWebPush(subscription, payload)` → `{ ok: true } | { ok: false; statusCode: number | undefined }`. Wraps `web-push`: `setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)` read at call time (the `isPushConfigured` posture — never cached at module load), `sendNotification({endpoint, keys}, JSON.stringify(payload), { TTL: 3600 })`. **TTL 3600 is a decision**: web-push's default TTL is four weeks, and a streak nudge delivered tomorrow is worse than none — one hour matches the mechanic's granularity. Catches `WebPushError`, surfaces `statusCode`; never throws for a send failure.
- `dispatcher.ts`: `runNotifyTick(db, { today, hour, send })` → the counters of §4.9. Per candidate, **in this order**: (1) `claimNudgeSend` — **claim BEFORE send** (ADR-0064 d7; a crash after the claim loses that day's nudge for that user, stated in the doc block as the priced residual); not claimed → skip (counts toward `candidates` only); (2) streak number via `listCompletionsForStreak` + `computeStreak(rows, today).streak`; (3) `pushNudgePayloadSchema.parse(nudgeCopy(streak))`; (4) `listSubscriptions`, serial `send` per row; `ok` → `sent++`; `statusCode` 404/410 → `pruneSubscription` + `pruned++`; anything else → `failed++`, row stays, claim stands. Each candidate wrapped in try/catch with a loud `console.error` (the `runTopUp` fault-isolation precedent) so one user's blowup never starves the rest of the tick.

### 6.4 `packages/db/src/merge.ts` — statements 5e/5f (after 5d, before statement 6 — the file's next free slots in its own sequence)

The 4b/4c idiom verbatim, retargeted:

```sql
insert into notification_sends (user_id, date, channel, sent_at)
select ${winnerId}::uuid, date, channel, sent_at
  from notification_sends where user_id = ${loserId}
on conflict (user_id, date, channel) do nothing;
delete from notification_sends where user_id = ${loserId};
```

`sent_at` COPIED, never `now()` (the recorded-moment rule); a PK collision keeps the winner's row (presence is presence — comment states it). Individually idempotent; crash-prefix-safe.

### 6.5 Contracts — `packages/core/src/contracts/`

- `cron.ts` gains `cronNotifyResponseSchema` (§4.9), strict, doc block naming the 200-even-on-failures semantics and the log line as the observability channel.
- `notifications.ts` gains `pushNudgePayloadSchema = z.strictObject({ title: z.string().min(1), body: z.string().min(1) })` — parsed by the dispatcher before stringify (Zod at the boundary; `sw.js` reads exactly these two keys). Its doc block also **corrects the falsified forward reference** at the top of `pushSubscribeSchema`'s comment ("will make" → "makes", §10).

### 6.6 The route — `apps/api/app/cron/notify/route.ts`

```
POST: isAuthorized? → 401 | isPushConfigured? → 503 (before any DB read)
      { today, hour } = readTickInstant(getDb())
      result = runNotifyTick(db, { today, hour, send: sendWebPush })
      console.log(JSON.stringify({ event: "cron-notify", today, hour, ...result }))
      Response.json(cronNotifyResponseSchema.parse(result), { status: 200 })
```

No CORS/OPTIONS; no `dynamic` export (comment per §4.1); no body parsing (POST with empty body, the publish register).

### 6.7 `apps/api/src/cron/auth.ts` + publish route edit

Extraction per §4.2. The publish route's diff is import-only.

### 6.8 `.github/workflows/streak-notify.yml` — new

```yaml
# The hourly streak-at-risk tick (#146, ADR-0064 decision 8): Vercel Hobby
# cannot tick hourly, so GitHub Actions curls the CRON_SECRET-guarded route.
# Zero marketplace actions on purpose — nothing to SHA-pin (#41 satisfied by
# construction); curl is preinstalled. -fsS: an HTTP error fails the job, and
# a red scheduled run is itself the alert (503 = push misconfigured in prod).
# Send timing is decided by the ROUTE against the DB clock's SP hour, never
# by this schedule's nominal fire time — Actions jitter is absorbed there.
name: Streak notify
permissions: {}
on:
  schedule:
    - cron: "0 * * * *"
  workflow_dispatch: {}
env:
  API_ORIGIN: https://api.miolos.app
jobs:
  tick:
    runs-on: ubuntu-latest
    steps:
      - name: Tick the notify dispatcher
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
        run: |
          body="$(curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$API_ORIGIN/cron/notify")"
          echo "cron-notify response: $body"
```

`permissions: {}` (least privilege — buffer-alert needs `issues: write`; this needs nothing). No `GITHUB_ENV` persistence, so the line-injection hygiene is moot — noted, not implemented. Scheduled workflows run from the **default branch**, so the tick activates at merge, never on branch pushes. Accepted residual (already priced by ADR-0064 d8's granularity decision, restated in 0067): a tick GitHub skips or delays past the hour loses that hour's cohort's nudge for the day — the route matches equality on the current SP hour, deliberately, and no catch-up pass exists.

### 6.9 `apps/api/vercel.json`

`functions` gains the notify entry (§4.10); `crons` untouched.

## 7. Test plan and the exact reservation

**Reservation is posted as a comment on issue #146 BEFORE step 5** (the twice-earned mitigation in `docs/agents/test-ids.md`), and the spends + frontier are recorded in that document at commit time. Frontier as re-derived at step 4 (2026-08-20, post-review): **#158 (PR #166, commit 80f030a) merged after this plan was first drafted and already reconciled the table** — the `T-WEB` row now reads next free `S297` / highest in use `S294` (`S293`/`S294` spent, `S295`/`S296` burned); #160's `S291`/`S292` ride its PR #167 (open at revision time). There is no stale row left to correct — an earlier draft's duty to fix a stale `S290` row is dropped, because writing that "correction" now would itself be a false record. The reservation below is unchanged and still right. Re-derive every area by the documented grep immediately before minting, and again after the pre-gate `git merge origin/main` — parallel agent worktrees are live and a collision is expected; resolve by moving the **unlanded** id. The same re-derive covers the doc numbers: plan **063** and ADR **0067** are free as of this revision and are re-checked by the same grep-the-tree habit after the pre-gate merge, before committing.

**Reserved:** `T-CORE S107–S109` · `T-DB S77–S84` · `T-API S142–S154` · `T-WEB S297–S298` · `T-LINT none`. The tails of each range are review-round headroom (the #145 precedent; unspent tails burn at step 8).

Seams: db tests on PGlite with explicit `{today, hour}` and explicit `completed_at` fixtures (no real clock, §4.3); api tick tests via `runNotifyTick` with a fake `send` recording calls (no `vi.mock` needed — injected dependency); route tests via route-as-function on `createTestDb` (`@miolos/db/testing`, the `cron-publish.test.ts` harness). Any new PGlite `beforeAll` takes the shared `30_000` budget citing the arithmetic **by symbol** at `createTestDb` (ADR-0055 d1 as amended by ADR-0057).

- **T-CORE-S107** — `cronNotifyResponseSchema`: strict, unknown key rejected, negative counts rejected. **S108** — `pushNudgePayloadSchema`: strict, empty title/body rejected. *(S109 headroom.)*
- **T-DB-S77** — `notification_sends` schema pin: column set, composite PK, FK cascade on user delete, CHECK rejects a third channel value.
- **T-DB-S78** — `claimNudgeSend`: first call true, second false; distinct channels claim independently; the write-once double-block.
- **T-DB-S79** — candidate at-risk conjunction: yesterday won∧on-time + today empty ⇒ candidate; a counted today excludes; a lost or late-only yesterday excludes; an unsubscribed user is never a candidate; an existing push-channel ledger row for today excludes (and an email-channel row does NOT — the arms stay separable).
- **T-DB-S80** — habitual hour: median over per-counted-day earliest instants; the floor semantics (a 21:40 habit matches hour 21, not 22); the 21-day boundary (a day at `today − 22` contributes nothing, `today − 21` does); single-sample cold start; an even sample count takes `percentile_disc`'s lower-middle sample.
- **T-DB-S81** — `readTickInstant`: shape (ISO date string, hour ∈ 0..23) — the one real-clock test, range-only assertions.
- **T-DB-S82** — merge duty: winner gets the loser's ledger rows, PK collision keeps the winner's, loser emptied, re-run a no-op. T-DB-S20's snapshot/fixture widened **in place** (no new id), likewise `T-DB-9e`/`T-DB-S5` (user-entry export count) and `T-DB-S39` (the eleventh table).
- *(S83–S84 headroom.)*
- **T-API-S142** — `/cron/notify` auth: unset `CRON_SECRET` → 401, missing/mismatched bearer → 401 (the T-API-S4 clone); publish's own auth suite stays green untouched — the extraction's no-behavior-change pin.
- **T-API-S143** — dormancy: any VAPID var unset → 503 and **zero DB statements** (assert via a db spy or absence of rows/claims).
- **T-API-S144** — the tick's happy path at the tick seam: one candidate → ledger row written **before** the fake transport is invoked (call-order assertion), payload parses and carries `computeStreak`'s exact number (seed a multi-day streak; this is the §4.14 divergence pin), pt-BR body matches §4.8 for n=1 and n≥2.
- **T-API-S145** — idempotence: two ticks, same `{today, hour}` → one send total.
- **T-API-S146** — a counted today sends nothing (route-level shape: candidate SQL already excludes; assert at the tick seam that no claim and no send happen).
- **T-API-S147** — pruning: a 404 and a 410 each delete exactly that endpoint row, sibling rows survive and are still sent to; `pruned` counts them.
- **T-API-S148** — a non-404/410 failure: row stays, claim stands, `failed` counts it, a second tick does NOT retry (the priced d7 residual, pinned as behavior).
- **T-API-S149** — response contract: strict parse of the real route body, counters consistent with the seeded scenario; per-line `cron-notify` log emitted.
- **T-API-S150** — multi-subscription user: one claim, one send per row, serial.
- **T-API-S151** — the ceiling: the 11th distinct endpoint → 429, nothing stored; a same-user re-subscribe of an existing endpoint at the cap → 200, keys updated, `created_at` CASE behavior preserved (T-API-S132's claim untouched); a cross-user repoint at the cap (endpoint held by another user, posting user full) → 429, ownership unchanged; the 10th → 200.
- *(S152–S154 headroom.)*
- **T-WEB-S297** — `streak-notify.yml` scan in `apps/web/test/fanout-cap.test.ts`'s register (the T-WEB-S226/S233 precedent — repo-root config scans live there): the schedule is hourly, the curl carries the secret bearer, `-fsS` **and `-X POST`** (the method is a §4.1 decision; the scan is where the workflow's decided tokens get pinned), and the file contains **no `uses:`** (zero marketplace actions — the #41 convention pinned, not assumed). *(S298 headroom.)*
- **T-LINT** — none: no new `apps/web/src` module, the walls don't move.

## 8. Gate and evidence

`pnpm typecheck --force`, `pnpm lint` (bare eslint — no `--force`, silence IS the pass), `pnpm test --force`, real output pasted (turbo cache hits are replays — napkin §Execution 8). `npx impeccable detect`: **N/A — no UI change** (no `apps/web/src` or route change; a workflow file and a test are not UI); state that in the PR body rather than skipping silently. No bundle-marker duty (no new web route). Pre-commit stays on, never `--no-verify`. PR body: tier named (Tier 2), what changed, evidence inline, and **"nothing needs Fernando"** — explicitly.

## 9. ADR-0067 sketch (`Proposed`; flipped to `Accepted` in this PR's own diff, merge-dated, citing the PR)

Title: *"The dispatcher's operating decisions: write-side subscription ceiling, ledger merge duty, one-snapshot tick instant."* Decisions: (1) ceiling 10, folded guard, 429, overshoot bound stated; (2) merge union+empty for `notification_sends` (consumes ADR-0049 d6's extension point); (3) `readTickInstant` one-snapshot parameterisation — the testability seam that keeps "DB clock only" true; (4) POST + 503-when-unconfigured + 200-with-failures semantics; (5) serial sends, TTL 3600, the ~150-candidates revisit trigger; (6) `pushsubscriptionchange` deferred to #36; noted: the candidate SQL's counted-day prefilter vs ADR-0048's single streak authority, with the T-API-S144 pin — including the deliberate narrowing of d1's "earliest on-time completion" to won∧on-time rows (§6.1); the skipped-tick residual (rides ADR-0064 d8's granularity decision) and, beside it, the 60 s unclaimed-tail residual (§4.10). Rejected: dispatch-side cap (bounds nothing real), claim-after-send (re-rejected by reference), catch-up matching (`habitual_hour <= hour` — changes d6's closed equality). `docs/README.md` rows for ADR-0067 **and** plan 063 ship in this PR.

## 10. Falsified-record sweep (same round, napkin §5)

- ADR-0064: consequence (d) annotation (Q1 answered), decision 3 annotation (Q2 confirmed), decision 10 annotation (the #36 deferral) — §4.13.
- `packages/core/src/contracts/notifications.ts:43` — "which **will make** a server-side HTTP request per row" → makes (§6.5).
- `apps/web/public/sw.js:21` — "The payload is slice B's (#146)" → cite the shipped `pushNudgePayloadSchema` (comment-only edit; T-WEB-S261's source pin tolerates comment text — verify against the `code()` stripper rule before assuming, napkin §Execution 3).
- `packages/db/src/schema.ts` `push_subscriptions` doc block — "410-pruning in #146" reads fine post-ship (future-tense check at implement time; correct if stale).
- `docs/pending-fernando.md` — move the SOON `#146` row's substance to done-by-agent state at merge (it is not a Fernando item; the phone smoke test already sits in ANY TIME and gains "and the hourly tick is live"). **This plan creates no new Fernando item, and discharges none.**
- `docs/agents/test-ids.md` — this ticket's spend paragraph + frontier rows, re-derived by grep at commit time (§7; no pre-existing stale row to correct — #158 already reconciled the table).
- After any step-7 fix: re-sweep the committed plan 063 itself and append a deviations entry (#30's rejection precedent).

## 11. Deployment and activation order (the dispatcher is live at merge)

1. **Before the branch's first push:** apply migration 0010 to Neon (§3). Verify with a select; paste output in the PR.
2. Branch, implement, gate. Preview deploys expose `/cron/notify` against the shared prod DB — safe: fail-closed on `CRON_SECRET` (unset or unmatched in preview → 401 before any read).
3. Merge → prod api deploy carries the route; the workflow lands on `main` and its **first top-of-hour tick sends real notifications to any real subscriptions** (VAPID live since 2026-08-20). Expected first-tick reality: `candidates` ≈ 0 (opt-in shipped yesterday; the threshold gates the ask).
4. Post-merge watch (agent, same session): the first Actions run green, its echoed response body, and Vercel's `cron-notify` log line. `workflow_dispatch` allows an immediate manual drill without waiting for the hour.
5. The human verification is already ledgered — pending-fernando ANY TIME's phone ritual. Do not re-ask; do not add an activation checklist item for `CRON_SECRET` (Done table, rule 2).

Safe because: schema precedes code; the route fails closed twice (secret, VAPID); the ledger makes even a double-fired workflow single-send; and a rollback is "revert the merge" — the workflow file reverts with it, and the table is append-only inert without the route.

## 12. Exit criteria

Green gate with pasted evidence (§8); all §7 tests landed under their reserved ids, reservation reconciled in `docs/agents/test-ids.md` against a fresh grep (§7); ADR-0067 Accepted in the same diff that ships its code; ADR-0064's three annotations committed; the §10 sweep clean; `docs/README.md` rows for 063 and 0067; the #36 comment posted (§4.7); PR merged, #146 closed. Process-weight check (ADR-0058 rule 2): the code diff here (migration, reader, dispatcher, route, workflow, ~13 test blocks) comfortably outweighs the records — the tier holds.
