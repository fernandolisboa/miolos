# Issue #32 — M3: Streak-at-risk notifications — Tier 3 shape

> **Preserved 2026-08-21, unedited.** The Tier 3 fog-clearing pass of 2026-08-19 that produced #145 and #146, both since shipped. Written to a session scratch directory outside the repo and never committed; recovered before that scratch was deleted. It is kept because #32 is still open: the **email-hedge slice** it describes is the remaining work, and as of 2026-08-21 the Resend transport that slice waited on is live.

Date: 2026-08-19. Read-only fog-clearing pass. Nothing filed, nothing changed in the repo.

## What the record already promises (grounding)

- **Founding handoff** (`docs/handoffs/001-handoff-project-foundation.md:43`): exactly one push type — streak at risk, at the user's habitual time, opt-in after streak ≥ 3, no marketing push. The M3 line says "Expo Notifications + cron" — superseded by ADR-0001 (web launch): push means **Web Push** (service worker + Push API + VAPID).
- **Issue #32 body**: the email hedge IS promised there, verbatim — "For players with reminder-email consent, the same nudge also goes by email — the hedge for iOS Safari". Not droppable.
- **ADR-0012**: two channels, two consents, never inferred from each other. Email nudges only to `reminder_consent` holders; web push keeps its own browser opt-in.
- **ADR-0050**: `users.reminder_consent_at` already exists and is written by the attach flow (#21, shipped). Consequence: "The reminder channel remains dormant: #21 stores consent; **only #32 may send**." Decision 7: the first withdrawal surface (settings/M4 = #36) triggers the flag-column revisit. Decision 11 names "#32's send infrastructure" as a rate-limit-composition revisit trigger.
- **ADR-0048**: streak is alive until rollover; `computeStreak` answers `{streak, todayCounts}`. Consequence: "the streak-at-risk push, when it ships, warns about exactly the state this ADR makes representable" — **at risk = streak > 0 with todayCounts = false** (run ended yesterday, today unplayed).
- **ADR-0025 + `packages/core/src/remote-config.ts`**: remote config is a DB table with a Zod schema; `attachStreakThreshold` (default 5) is the precedent for `pushOptInStreakThreshold` (default 3).
- **ADR-0022/0050 idioms to reuse**: timestamps as consent evidence; one-lifecycle prompt stamp (`attach_prompt_dismissed_at` precedent); fail-closed dormancy predicate (`isAttachConfigured`); CRON_SECRET bearer auth with SHA-256-both-sides + `timingSafeEqual` (`apps/api/app/cron/publish/route.ts`); insert-with-`ON CONFLICT DO NOTHING` as race-safe claim over neon-http (no transactions).
- **Infra reality**: Vercel is on the **Hobby plan** (buffer-alert.yml says "Hobby-plan jitter"); Hobby crons are max 2 per account, once-daily, jittered — an hourly tick **cannot** be a Vercel cron. The repo's established second scheduler is a GitHub Actions schedule hitting the public API (`.github/workflows/buffer-alert.yml`). Email transport exists: Resend over plain fetch, `apps/api/src/email/transport.ts`, copy in `copy.ts`.
- **No service worker exists anywhere** in apps/web (only `app/manifest.ts` — good: the PWA manifest iOS needs is already shipped). No web-push dependency anywhere.
- **Schema facts** (`packages/db/src/schema.ts`): `completions.completed_at` is DB-clock truth, projections deliberately omit it; on-time is a SQL derivation; adding any `users` column re-springs the INSERT-column-list deploy trap (migration must reach Neon before the branch is first pushed — documented on `attachPromptDismissedAt`).
- **Plan 054** re-tiered #32 as 3 → 2 after fog-clearing; it soft-unblocks #33 and #36.

## The five settled questions

### 1. The habitual play window — derived at read time, never stored

**Derivation.** The habitual play time is the **median São Paulo minute-of-day of the player's recent on-time completions**: over the last 21 SP days, take each counted day's earliest `completed_at`, extract its SP time-of-day DB-side (`completed_at at time zone 'America/Sao_Paulo'` — the existing no-JS-Date discipline), and take `percentile_disc(0.5)`. Rounded to the hour, because the tick is hourly.

**Schema: none.** No column, no update job. This is ADR-0051's philosophy ("statistics are read-time derivations") and CONTEXT.md's streak row ("any stored value is a cache") applied again: the completions rows already contain the signal, and a stored window is a cache that can drift. `sessions.last_seen_at` was rejected as a source — bumped only when > 1 h stale, and polluted by non-play visits; completion instants are the act itself.

**Cold start: structurally absent on both surfaces.**
- *The opt-in prompt*: it renders on the conclusion screen, i.e. the moment the player has just completed a daily — which **is** their habitual play moment by construction. No derivation is needed to time the ask; the founding rule "at the habitual play window" is satisfied by placement.
- *The send*: a send candidate by definition counted yesterday (see § 3), so ≥ 1 sample always exists; and a push subscriber had streak ≥ 3 at subscribe time. Median over whatever samples exist (min 1). A defensive fallback constant is unnecessary; if the reader ever computes over zero rows the candidate wasn't at risk.

**Midnight wraparound** (a player whose completions straddle 23:00/01:00): the plain median can land on either side. Accepted v1 imperfection, recorded in the ADR — circular statistics buy nothing at hourly granularity for a product this size.

### 2. Web Push end to end

**Subscription storage — per endpoint (per browser install), FK to user.** New table `push_subscriptions`:

```
push_subscriptions
  endpoint    text PRIMARY KEY       -- the capability URL; stored raw (it is what we send to)
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  p256dh      text NOT NULL          -- client public key (RFC 8291)
  auth        text NOT NULL          -- client auth secret
  created_at  timestamptz NOT NULL DEFAULT now()   -- the consent evidence (ADR-0022 style)
  + index on (user_id)
```

A user may hold several rows (phone + desktop). `created_at` is the push-consent timestamp — subscribing is the consent act, deleting the row is withdrawal; no separate consent column (the ADR-0022/0050 timestamp-is-evidence idiom). **Merge duty**: `mergeAccounts` gains one remap statement (the sessions precedent — additive to ADR-0049, and unlike sessions these are NOT revoked by ADR-0050 decision 13, which is about cookie takeover; a device's push channel should follow the merged identity). **Deletion**: FK cascade, already covered.

**VAPID keys**: generated once, stored as Vercel env vars `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (+ `VAPID_SUBJECT`, `mailto:privacidade@miolos.app`). Dormancy is one predicate, `isPushConfigured()`, the `isAttachConfigured` posture: unconfigured → subscribe routes 503 before side effects AND the state endpoint reports ineligible, so no environment renders a prompt whose accept would fail. The **public** key reaches the client inside the state endpoint's response (one source of truth, api env; no `NEXT_PUBLIC_` twin in apps/web to drift).

**Sending library**: take the **`web-push` npm package in `apps/api` only**. This is the one deliberate exception to the hand-rolled-transport posture: VAPID is ES256 JWT signing plus RFC 8291 payload encryption (ECDH/P-256 → HKDF → AES-128-GCM) — hand-rolling ~150 lines of composition crypto is exactly the mistake class "don't roll your own crypto" names, unlike base64url or a fetch call. `packages/games`' zero-Node-deps invariant is untouched (this lives in apps/api). Recorded as an ADR decision with the hand-rolled alternative rejected.

**The service worker ships caching-free.** `apps/web/public/sw.js` (or a built equivalent) registers **only** `push` and `notificationclick` handlers — **no `fetch` handler, no Cache API use at all**. That satisfies the issue's ADR-0004 acceptance criterion by construction: a worker that never caches cannot cache a future-dated payload. A test pins the worker source free of `fetch`/`caches` references. `notificationclick` focuses/opens the hub (`/`).

**Permission UX (the founding rule, one lifecycle).**
1. `GET /notifications/state` (new strict contract, ADR-0048's growth rule — the threshold never ships to the client): `{ eligible: boolean, vapidPublicKey: string | null }`. Eligible = streak ≥ `pushOptInStreakThreshold` (remote config, default 3) AND `push_prompt_dismissed_at IS NULL` AND push configured.
2. The conclusion surface renders a **soft pre-prompt card** (our UI, pt-BR) when eligible and this browser has no subscription and `Notification.permission === "default"`. Accepting triggers `PushManager.subscribe` inside the user gesture → `POST /push/subscriptions` (Zod-parsed endpoint + keys). Declining ("agora não") stamps `users.push_prompt_dismissed_at` — permanent, the attach-prompt lifecycle, same rejection of localStorage (it re-prompts exactly the cleared-data user).
3. **On browser denial**: also stamp `push_prompt_dismissed_at`; never re-ask. The browser remembers denial anyway; our stamp keeps the card from ever rendering again.
4. **iOS Safari not installed to home screen** (`window.Notification` absent): the card never renders — the email hedge is that platform's channel. No "install the app" nagging in v1.

`DELETE /push/subscriptions` (by endpoint, authenticated) exists from the first slice — it is both the settings toggle's future seam (#36) and the pruning path's sibling.

### 3. The scheduler — an hourly GitHub Actions tick into a CRON_SECRET-guarded route

**The decision function** (server-side, DB clock only): a user is sent to **iff all of**
- they hold ≥ 1 push subscription (or reminder consent, for the email arm — § 4),
- **yesterday (SP) has a counted day and today (SP) does not** — ADR-0048's exact at-risk state, computable with one SQL prefilter over `completions_user_date_idx` (a won row on `today − 1` whose on-time derivation holds, and no such row on `today`),
- the current SP hour equals their derived habitual hour (§ 1),
- no `notification_sends` row exists for (user, today, channel).

`computeStreak` runs on the survivors only, for the copy's number ("Sua sequência de N dias termina à meia-noite") — the send condition itself never needs the length. Once opted in, the nudge fires for **any** live streak, not only ≥ 3 — the founding rule gates the *ask*, not the send (flagged to Fernando as a confirmable default, Q2 below).

**The runner**: `.github/workflows/streak-notify.yml`, `schedule: cron: "0 * * * *"`, one curl `POST https://api.miolos.app/cron/notify` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}` — zero marketplace actions, the buffer-alert.yml pattern. **Why not Vercel cron**: Hobby allows 2 once-daily jobs (one already spent on publish) with in-hour jitter; the habitual-window mechanic needs 24 ticks a day. GH Actions schedule jitter (minutes, occasionally tens of minutes) is absorbed by hourly granularity plus the route matching on "current SP hour" from the DB clock at execution time, not on the workflow's nominal fire time. The route reuses the publish cron's fail-closed `isAuthorized` (SHA-256 both sides, `timingSafeEqual`).

**Double-send avoidance — an append-only ledger, claim-by-insert.** New table:

```
notification_sends
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  date     date NOT NULL              -- the SP day the nudge protects
  channel  text NOT NULL CHECK (channel IN ('push','email'))
  sent_at  timestamptz NOT NULL DEFAULT now()
  PRIMARY KEY (user_id, date, channel)
```

The dispatcher claims before sending: `INSERT … ON CONFLICT DO NOTHING RETURNING` — zero rows back means another invocation owns it (the write-once completions / DELETE-RETURNING idiom; race-safe without transactions over neon-http). At most one push and one email per user per SP day, mechanically. A send failure after a claim loses at most that day's nudge for that user — accepted residual, priced in the ADR (the alternative, claim-after-send, risks doubles, which is worse for a never-marketing channel).

**Rollover arithmetic**: entirely DB-side — `todaySaoPaulo(db)` (exists), `today − 1` via SQL date arithmetic, SP hour via `extract(hour from now() at time zone 'America/Sao_Paulo')`. No JS Date enters any statement; midnight SP is fixed for everyone, so "the day is running out" needs no per-user timezone at all.

**Endpoint hygiene**: a push to a gone endpoint (404/410 from the push service) deletes that subscription row in the same pass — the pruning that keeps the table honest and Resend/push quotas unburned.

### 4. The email hedge — promised, kept, and its own ticket

The hedge is promised in three places (issue #32 body, ADR-0012's consequence, ADR-0003's consequence via ADR-0050's "only #32 may send"). **Keep it.** But it is a separate Tier 2 ticket, because it shares the dispatcher and the ledger while adding a distinct transport arm, distinct consent source (`users.reminder_consent_at`, already populated by #21), distinct copy, and one genuine product question:

**Recommended semantics — hedge, not chorus**: a user with reminder consent gets the email **only when they have no push subscription** (push is the primary channel; email exists for iOS Safari where push needs home-screen install). The issue's literal wording ("the same nudge **also** goes by email") reads as both-channels; both-channels double-nudges every dual-consent user every at-risk day, which is marketing-adjacent pressure on a never-marketing channel. This is a product call → Q1 for Fernando. The ledger's `channel` column supports either answer unchanged.

The send rides the existing Resend transport module (`apps/api/src/email/transport.ts` grows a second exported send; copy in `copy.ts`, pt-BR, plain text, no pixels, same 10 s abort). Fail-closed on `RESEND_API_KEY` exactly as attach. ADR-0050 decision 11's revisit trigger ("#32's send infrastructure") is discharged by noting: this channel sends only to verified attached emails of the account itself, chosen by the server on a schedule — no user input reaches the recipient line, so the attach-flow's mail-bombing compositions do not extend here.

### 5. LGPD / consent surface, and the edges to #33 and #36

**What is recorded where:**
- *Push consent* = the browser permission grant (browser-held) + the subscription row (`push_subscriptions.created_at` is the timestamp evidence). Withdrawal = row deletion (settings toggle in #36, or browser-side revocation which surfaces as 410-pruning).
- *Email reminder consent* = `users.reminder_consent_at` (shipped, #21/ADR-0050 decision 7; default off, independent checkbox — ADR-0012).
- *Prompt lifecycle* = `users.push_prompt_dismissed_at`, new nullable column (deploy-trap landmine: migration reaches Neon before first branch push).
- *The privacy page* (`/privacidade`) gains one paragraph: push endpoint + keys stored, purpose-limited to the streak nudge, deleted on unsubscribe or account deletion. Records-weight change inside slice A.

**Edge to #33 (PostHog)** — soft, and only one fifth of it: the `notification_opt_in` event fires at successful `POST /push/subscriptions`. Only that event waits, and it waits on **slice A alone** (the opt-in flow), not the dispatcher. #33's other four events can ship any time.

**Edge to #36 (Settings)** — soft, and only the notification-preferences panel: the push toggle needs slice A's table + `DELETE /push/subscriptions`; the email-reminder toggle needs only the already-shipped `reminder_consent_at` **but is ADR-0050 decision 7's named revisit trigger** — the first withdrawal surface, where the consent flag columns (withdrawal representability, ADR-0012's fuller shape) get added. That revisit belongs to #36, not to #32. Paper-dark, theme persistence and reduced-motion are fully independent.

## The recommended shape, one page

**Schema** (one migration per slice, hand-applied via `psql -f` per repo ritual):
- `push_subscriptions(endpoint PK, user_id FK cascade, p256dh, auth, created_at)` + user_id index — slice A
- `users.push_prompt_dismissed_at timestamptz` (nullable) — slice A
- `notification_sends(user_id, date, channel, sent_at, PK(user_id, date, channel))` — slice B
- remote config gains `pushOptInStreakThreshold: z.number().int().min(1).max(365).default(3)` — slice A

**Derivation**: habitual hour = median SP hour of the earliest on-time completion per counted day over the last 21 SP days; computed in SQL at dispatch time; never stored.

**Opt-in flow**: conclusion surface → `GET /notifications/state` (`{eligible, vapidPublicKey}`) → soft card (eligible ∧ no local subscription ∧ permission "default") → gesture → browser prompt → `PushManager.subscribe` → `POST /push/subscriptions`. Decline or deny → stamp `push_prompt_dismissed_at`, forever. iOS Safari uninstalled → card never renders; email hedges.

**Send path**: GH Actions hourly → `POST /cron/notify` (CRON_SECRET bearer, fail-closed) → SQL candidates (yesterday counted ∧ today not ∧ habitual hour = now's SP hour ∧ subscribed-or-consented) → claim ledger row (`ON CONFLICT DO NOTHING RETURNING`) → `web-push` send (push) / Resend fetch (email) → prune 404/410 endpoints. Payload: pt-BR title/body + hub URL; zero puzzle content, so ADR-0004 is untouched twice over (and the SW caches nothing anyway).

**The only notification code path**: the dispatcher route is the sole caller of both sends; no other trigger exists — pinned by the seam tests (transports and time faked, per the issue's AC).

## Proposed Tier 2 tickets (not filed)

### A. "M3: Web Push opt-in — service worker, subscription storage, and the streak-≥ 3 prompt" — Tier 2, size M/L. Blocked by: nothing (all prerequisites shipped).

> Part of #32 (M3 — Retention; see the shape in the #32 fog-clearing notes). Ship the opt-in half of streak-at-risk notifications, sending nothing yet. A caching-free service worker in `apps/web` (push + notificationclick handlers only — no fetch handler and no Cache API, so ADR-0004 is satisfied by construction, pinned by a source test). New `push_subscriptions` table (endpoint PK, user FK cascade, p256dh/auth, created_at as the consent timestamp) plus `users.push_prompt_dismissed_at` (mind the INSERT-column-list deploy trap: migration reaches Neon first). `GET /notifications/state` (strict contract: `{eligible, vapidPublicKey}`; eligible = streak ≥ `pushOptInStreakThreshold`, a new remote-config key defaulting to 3, AND not dismissed AND `isPushConfigured` — the fail-closed `isAttachConfigured` posture over `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`). `POST /push/subscriptions` and `DELETE /push/subscriptions`, Zod-parsed. The soft pre-prompt card on the conclusion surface (pt-BR; renders only when eligible, permission "default", no local subscription; the conclusion IS the habitual play window by construction); decline or browser denial stamps the dismissal permanently — the attach-prompt lifecycle. iOS Safari without home-screen install never sees the card. `mergeAccounts` gains the subscription remap statement (sessions precedent, additive to ADR-0049). Ships the #32 ADR (Proposed → Accepted in this PR). Seam tests at `apps/api` with time faked; `npx impeccable detect` on the card.

### B. "M3: The streak-at-risk dispatcher — habitual window, send ledger, hourly tick, push send" — Tier 2, size M. Blocked by: A.

> Part of #32. The sending half, push channel only. A `notification_sends` ledger (PK (user_id, date, channel), append-only; claim-by-`INSERT … ON CONFLICT DO NOTHING RETURNING` before any send — at most one nudge per user per SP day per channel, race-safe without transactions). `POST /cron/notify` on `apps/api`, guarded by the publish cron's fail-closed CRON_SECRET idiom, driven by a new `.github/workflows/streak-notify.yml` hourly schedule (curl + secret, zero marketplace actions — the buffer-alert pattern; Vercel Hobby cron cannot tick hourly). Candidates in SQL, DB clock only: yesterday-SP counted, today-SP not (ADR-0048's at-risk state), habitual hour = current SP hour, where habitual hour is the median SP hour of the earliest on-time completion per counted day over the last 21 days — derived at read time, never stored (ADR-0051's philosophy). Send via the `web-push` package (apps/api only; the ADR records why this crypto is not hand-rolled), pt-BR copy, payload carries no puzzle content; 404/410 responses prune the subscription row. `computeStreak` supplies the number for the copy only. Seam tests with time and transport faked: the tick is idempotent, a counted today sends nothing, the ledger blocks doubles, pruning works.

### C. "M3: The email hedge — streak-at-risk by Resend for reminder-consent holders" — Tier 2, size S. Blocked by: B (and Fernando's Q1).

> Part of #32. The second channel of the one nudge: users with `reminder_consent_at` set (#21/ADR-0050 — the column is live, the channel dormant until now) enter the same dispatcher tick and the same ledger under `channel = 'email'`. Recommended semantics pending Fernando's call: hedge-only — email goes only to at-risk users with zero reachable push subscriptions (iOS Safari's channel), not alongside push. Rides the existing Resend transport (`apps/api/src/email/transport.ts` grows a reminder send; pt-BR plain-text copy in `copy.ts`, no pixels, 10 s abort, fail-closed on the key). Discharges ADR-0050 decision 11's "#32's send infrastructure" revisit note: recipients are server-chosen verified own-account emails on a schedule — no user input names a recipient, so the attach-flow abuse compositions do not extend here (recorded as an annotation on ADR-0050 or in the #32 ADR). Seam tests: consent gate, hedge gate, ledger idempotence, never-marketing (the reminder body is the only email this path can emit).

**Sequencing**: A → B → C strictly. #33's `notification_opt_in` unblocks after A. #36's notification panel unblocks after A (push toggle) and C (email toggle meaning).

## ADRs this shape needs

1. **ADR-006x — "Streak-at-risk is a derived decision: read-time habitual window, per-endpoint subscriptions, a claim-first send ledger, and an hourly external tick"** — one ADR in the ADR-0050 mold covering: the no-stored-window derivation; the subscription table + timestamp-as-consent + merge remap; the ledger's claim-before-send idempotence and its priced residual; GH Actions over Vercel Hobby cron; the caching-free service worker as the ADR-0004 discharge; the dispatcher as the product's only notification code path. Ships Proposed with slice A's plan, Accepted in A's PR (with B/C noted as its remaining implementers).
2. **ADR-006x+1 — "Web Push signing and encryption take the `web-push` dependency"** — one-line decision: RFC 8291/8292 composition crypto is the exception to the hand-rolled-transport posture; apps/api only, `packages/games` invariant untouched. (Could fold into ADR 1 as a decision item if a single ADR is preferred — recommend folding; listed separately so the choice is visible.)

## Questions for Fernando (product-level only)

1. **Dual-consent users**: when someone has both a push subscription and reminder-email consent, send (a) push only, email as fallback when no push exists — recommended — or (b) both channels every at-risk day, as the issue's literal wording reads?
2. **Send floor**: once opted in, does the nudge fire for any live streak at risk (recommended — the ≥ 3 rule gates the ask, not the send), or only for streaks ≥ 3?

Everything else (library choice, scheduler, schema, prompt placement, denial handling) is recommended above, not asked.

## Landmines for the implementing sessions

- `users` column addition (`push_prompt_dismissed_at`) re-springs the INSERT-column-list deploy trap — migration to Neon BEFORE the branch is first pushed (documented on `attachPromptDismissedAt` in schema.ts; preview deploys share the production DB).
- `completions.ts` deliberately exports no `completedAt` projection; the habitual-hour reader must stay SQL-side (extract in the statement), never widen `CompletionRecord`.
- No transactions over neon-http — every multi-statement path (claim → send → prune) must be idempotent per statement, the ADR-0049/0050 discipline.
- GH Actions `schedule` needs `CRON_SECRET` as a repo secret — one-time human step; note it in slice B's PR body as the activation checklist (the `vercel env add` posture).
- The publish cron's `isAuthorized` should be extracted/shared rather than copied.
- Vercel Hobby: do NOT add a second entry to `apps/api/vercel.json` crons for this.
