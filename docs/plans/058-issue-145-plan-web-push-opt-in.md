# Plan 058 — Issue #145: Web Push opt-in — service worker, subscription storage, streak-threshold prompt

**Status:** point-in-time snapshot, written 2026-08-20 at step 2. Tier 2.
**Inputs:** issue #145; the #32 fog-clearing comment (the settled shape — this plan implements slice A as decided, nothing re-litigated); ADR-0050/0061 (the templates); ADR-0048 (streak, threshold-never-ships, preview-anonymity); ADR-0025 (remote config); ADR-0004 (discharged by construction); ADR-0049 (merge extension point); ADR-0012 (two channels, two consents).
**Test-id reservation (on issue #145):** T-CORE S100–S102 · T-DB S66–S70 · T-API S124–S132 · T-WEB S261–S272 · T-LINT S50–S51. Unspent tails burn.

Fernando's open questions Q1/Q2 on #32 gate slices B/C only. Nothing here waits on them, and neither is re-asked.

## 1. Migration `0007` — one migration, applied to Neon FIRST

`packages/db/src/schema.ts` gains, in one `pnpm db:generate` migration (`packages/db/migrations/0007_*.sql`):

- **`push_subscriptions`** — `endpoint text PRIMARY KEY` (the capability URL, stored raw), `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `p256dh text NOT NULL`, `auth text NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()` (the consent evidence, ADR-0022 idiom — no separate consent column), plus `push_subscriptions_user_id_idx` on `user_id`. Several rows per user (phone + desktop) is the design.
- **`users.push_prompt_dismissed_at timestamptz`** (nullable) — the `attachPromptDismissedAt` doc block cloned: one prompt lifecycle per account; NOT in the tombstone SET; folded earliest-wins on merge (§4).

**Deploy trap (schema.ts documents it on `attachPromptDismissedAt`):** adding ANY `users` column changes the INSERT column list drizzle emits for every writer, `mintSession` included, and preview deploys share the production DB — so 0007 reaches Neon **before the branch's first push**, via the napkin §Deploy ritual (temp script over `@neondatabase/serverless`, statements split on `--> statement-breakpoint`; no `psql` on this box; never `db:migrate` against Neon). Work fully local until the apply is confirmed.
**Sequencing note (landing-order assumption, not a fact this plan controls):** if this slice lands first, #58's stored-`on_time` migration becomes `0008`. As with the test ids, re-derive after the pre-gate `git merge origin/main`: if anything else has taken `0007` by then, regenerate this slice's migration under the next free number and repeat the Neon-first apply against the new file. merge.ts's repoint-column-list note about #58 is unaffected either way.

## 2. The caching-free service worker

- **File:** `apps/web/public/sw.js` — plain JS, served by Next.js at `/sw.js`, root scope. Not a route: no `route-client-js.mjs` classification, no bundle marker.
- **Handlers:** exactly two. `push` → `event.waitUntil(self.registration.showNotification(title, {body}))` from the event's JSON payload with pt-BR fallback strings baked in (the payload itself is slice B's; it carries zero puzzle content). `notificationclick` → close the notification, focus an existing client or `clients.openWindow("/")` — the deep link is the hub.
- **Recorded i18n exception:** the sw fallback strings are the one place pt-BR copy lives outside `messages.ts` — a plain unbundled worker cannot import it, so the duplication is forced, and this sentence is the recorded decision rather than a drift. They are also invisible to T-WEB-S270's externalisation scan, which reads `messages.push.*` only.
- **No `fetch` handler, no Cache API, ever** — a worker that never caches cannot cache a future-dated payload, so ADR-0004 holds by construction. **Source test T-WEB-S261** reads `apps/web/public/sw.js` and asserts the tokens `fetch` and `caches` are absent **after comment-stripping through the `code()` helper** (napkin: doc blocks quoting forbidden tokens are the norm — so the sw's own comments must not name them either, and the test strips anyway).
- **Registration point:** inside the card's accept handler only — `await navigator.serviceWorker.register("/sw.js")`, then `const registration = await navigator.serviceWorker.ready`, then `registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey})`, all inside the user gesture (transient activation is time-based and survives the awaits; the sw is tiny and activates in milliseconds). The `ready` wait is load-bearing: `register()` resolves while the worker is still installing, and the Push API spec rejects `subscribe()` with `InvalidStateError` when the registration has no active worker — without it, the first click ever fails silently. No layout-level registration: the worker has no job until a subscription exists, registration persists browser-side once made, and no other route gains a byte of client JS.
- **Lint:** root `eslint .` reaches `public/`; add a flat-config entry for `apps/web/public/sw.js` with service-worker globals (`self`, `clients`) rather than an ignore — an ignored file is an unscanned file.

## 3. API surface — three routes, one config predicate

**Contracts** in `packages/core/src/contracts/notifications.ts` (all `z.strictObject`, the onboarding.ts template):
- `notificationsStateResponseSchema = { eligible: z.boolean(), vapidPublicKey: z.string().nullable() }` — the key is non-null iff configured (public by design; one source of truth, api env — no `NEXT_PUBLIC_` twin to drift), `eligible` is the prompt gate. The threshold itself never ships (ADR-0048's rule).
- `pushSubscribeSchema = { endpoint: z.url(), keys: z.strictObject({ p256dh: z.string().min(1), auth: z.string().min(1) }) }`; response `{ subscribed: true }`. (`z.url()` is the zod-4 top-level form; `z.string().url()` is the deprecated zod-3 idiom — the repo is on zod 4.)
- `pushUnsubscribeSchema = { endpoint: z.url() }`; response `{ removed: true }` (idempotent).
- `notificationsDismissSchema` = the strict empty object (the `onboardingSeenSchema` shape); response `{ dismissed: true }`.

**Remote config:** `packages/core/src/remote-config.ts` gains `pushOptInStreakThreshold: z.number().int().min(1).max(365).default(3)` — the `attachStreakThreshold` row cloned, same clamp discipline.

**Dormancy predicate:** `isPushConfigured()` in new `apps/api/src/push/config.ts` — `Boolean` over all three of `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, read at call time (the `isAttachConfigured` posture verbatim). Fail-closed over the triple even though slice A uses only the public key: a half-configured environment must not collect subscriptions the dispatcher can never serve.

**Statements** in new `apps/api/src/push/service.ts` (the `onboarding/service.ts` precedent — single-table statements live api-side; no JS `Date` in any statement):
- `upsertSubscription`: `INSERT … ON CONFLICT (endpoint) DO UPDATE SET user_id, p256dh, auth` — the browser install is the authority for its own endpoint (key rotation, or the endpoint following whoever the cookie now says).
- `deleteSubscription(db, userId, endpoint)`: `DELETE WHERE endpoint = … AND user_id = …` — own rows only.
- `getPushAccountState` / `dismissPushPrompt`: the `getOnboardingState` / `markOnboardingSeen` shapes; the dismiss UPDATE guarded on `push_prompt_dismissed_at IS NULL`, sets `updated_at = now()` (join schema.ts's writer list), idempotent. The `pushSubscriptions` table export rides the same `@miolos/db` entry `users` does; export-count tripwires (T-DB-9e family) widen in place.

**Routes:**
- `GET /notifications/state` — `apps/api/app/notifications/state/route.ts`, cloned from `apps/api/app/attach/state/route.ts` (authenticated READ: no OPTIONS, no origin guard, no-store on every branch, whole body caught, cheap suppressions before the streak read). **Eligibility formula:** `isPushConfigured()` AND `push_prompt_dismissed_at IS NULL` AND `computeStreak(rows, todaySaoPaulo(db)).streak >= config.pushOptInStreakThreshold`. `vapidPublicKey` = the env value when configured, else null.
- `POST /notifications/dismiss` — cloned from `apps/api/app/onboarding/seen/route.ts` (origin guard, 415, strict empty body, 401, whole body caught).
- `POST` + `DELETE /push/subscriptions` — one file `apps/api/app/push/subscriptions/route.ts` with `POST`, `DELETE`, `OPTIONS` (the seen-route write template ×2). Both 503 via `isPushConfigured()` **before any side effect**. Zod-parsed bodies, never cast.

## 4. `mergeAccounts` remap (packages/db/src/merge.ts)

- New statement **1b**, immediately after the sessions remap (the sessions precedent the #32 shape names): `UPDATE push_subscriptions SET user_id = winner WHERE user_id = loser`. No conflict is possible (endpoint is a globally unique PK and the PK doesn't move); trivially idempotent; a device's push channel follows the merged identity. NOT revoked — ADR-0050 decision 13 is about cookie takeover, not this.
- Statement **5d** grows a third column: `push_prompt_dismissed_at` joins the earliest-wins `least()` fold, its `is not null AND <` arm added to the OR-guard. The 5d comment's "the two once-per-account timestamps" becomes "three" — **falsified-record sweep**: fix that comment, the schema.ts writer-list note, and check ADR-0061 for any "two timestamps" sufficiency phrasing (annotate if found).
- **Annotation form (domain.md):** this is the extension point ADR-0049 decision 6 reserves, consumed as reserved — no `**Amended by:**` on ADR-0049; ADR-0062 lists ADR-0049 in `Depends on`, and merge.ts's extension-point comment names #145 beside #30. Only a sentence made *false* would owe an amendment header.

## 5. The prompt card on the conclusion surface

- **Files:** `apps/web/src/push/push-client.ts` (fetch + parse, failures resolve `undefined` — the `onboarding-client.ts` template, including the loud `NEXT_PUBLIC_API_URL` guard; plus the ~6-line base64url→`Uint8Array` helper for `applicationServerKey`, hand-rolled per repo posture), `apps/web/src/push/use-push-state.ts` (the `use-onboarding-state.ts` shape: `ensureSession()` first, three honest states), `apps/web/src/play/push-prompt-card.tsx` + `push-prompt-card.module.css` (own sheet — CSS Modules hash per file).
- **Placement (decided here, per the design system — Fernando is not asked):** in `ConclusionView`'s `<aside className={styles.side}>`, directly below the `StreakCard` slot and above the day card — the streak number sits above the card that asks to protect it, and the conclusion IS the habitual play moment by construction. **Coordination with #142:** its cross-device completed view is a second conclusion-like surface; whether the push card renders there is decided by #142's plan (default: it does not — the card belongs to the genuine post-solve conclusion only). Quiet in-flow paper card, washi tape, `--accent-app` (the streak is app identity, never the game accent), subtle static rotation — the `hub-onboarding` register. Renders `null` until everything says yes, so server markup, first paint and `impeccable detect`'s clean profile are unchanged. Mind `all-caps-body` and `kicker-above-heading`: no uppercase body text, and the heading is a plain `<h2>` inside a `<section aria-labelledby>` (the hub-onboarding a11y shape).
- **Render conditions, all required:** the triple feature detect `"Notification" in window && "serviceWorker" in navigator && "PushManager" in window` — checked before touching any of the three APIs — AND server `eligible === true` AND `Notification.permission === "default"` AND this browser holds no subscription (`navigator.serviceWorker.getRegistration()` → `registration?.pushManager.getSubscription()` resolves null/undefined). Any missing leg → the card never renders and never throws: iOS Safari without home-screen install lacks both `Notification` and `PushManager`; `navigator.serviceWorker` is undefined in non-secure contexts and some private windows; older Safari/WebViews have `Notification` without Web Push. No nagging on any of them (the email hedge is slice C's job).
- **Accept ("Quero o lembrete"):** register → `serviceWorker.ready` → subscribe, in that order, inside the gesture (§2) → `POST /push/subscriptions` with the subscription's endpoint + keys → card leaves the DOM. A *transient* subscribe failure (throw with permission still `"default"`/`"granted"`) stamps nothing — the card simply goes for this visit.
- **Decline ("Agora não") and browser denial both stamp** `POST /notifications/dismiss` — permanent, once per account (the attach-prompt lifecycle; never localStorage — it re-prompts exactly the cleared-data user). Denial detection: after `subscribe()` rejects, `Notification.permission === "denied"` → dismiss. The browser remembers the denial anyway; our stamp keeps every other surface honest. On dismiss/accept, focus moves deliberately (the `hub-onboarding` `moveFocusToFirstGame` lesson — here, to the side column's next control or the CTA).
- **pt-BR strings**, in `apps/web/src/i18n/messages.ts` under `messages.push` (CONTEXT.md vocabulary: *sequência*, *virada*, *lembrete*):
  - `title`: "Quer proteger sua sequência?"
  - `body`: "A gente te avisa antes da virada quando a sua sequência estiver em risco. No máximo um lembrete por dia — e nunca propaganda."
  - `accept`: "Quero o lembrete" · `decline`: "Agora não"
- **Privacy page:** `/privacidade` gains one paragraph — endpoint + keys stored, purpose-limited to the streak nudge, deleted on unsubscribe or account deletion (records-weight, inside this slice per the #32 shape §5).

## 6. ADR-0062

**`docs/adr/0062-streak-at-risk-is-a-derived-decision.md`** — the #32 shape's ADR item, one ADR in the ADR-0050 mold: read-time habitual window (never stored); per-endpoint subscriptions + timestamp-as-consent + merge remap; claim-first send ledger and its priced residual; GH Actions hourly tick over Vercel Hobby cron; the caching-free service worker as the ADR-0004 discharge; the dispatcher as the product's only notification code path; **and the `web-push` dependency decision folded in as a decision item** (RFC 8291/8292 composition crypto is the one exception to the hand-rolled-transport posture; apps/api only; `packages/games` untouched). Ships in this PR, flipped `Proposed → Accepted` in the same diff (`issue #32, shipped in #<PR>`), with slices B (#146) and C named as its remaining implementers — exactly as the #32 comment decided. `Depends on`: ADR-0004, 0012, 0022, 0025, 0048, 0049, 0050, 0061. Amendment sweep at step 5: ADR-0061 "two timestamps" phrasing (§4); nothing else expected — flag anything found.

## 7. Dependencies

**None added in this slice.** `web-push` (current: **3.6.7**, published 2024-01 — outside the `minimumReleaseAge` window) is the *dispatcher's* dependency and lands with #146, its first caller — an installed dependency with no call site is exactly the dormant-surface finding this repo rejects. ADR-0062 records the decision now; the activation checklist uses `npx web-push` without installing. `packages/games` untouched.

## 8. Test plan (reserved ids)

| Id | Seam | Claim |
|---|---|---|
| T-CORE-S100 | contracts | notifications contracts are strict: unknown keys rejected on all four schemas; `vapidPublicKey` nullable; subscribe keys non-empty |
| T-CORE-S101 | remote-config | `pushOptInStreakThreshold` defaults 3, clamps 1..365, parses from rows |
| T-CORE-S102 | — | headroom (burn if unspent) |
| T-DB-S66 | schema | `push_subscriptions` pinned exactly: column set, endpoint PK, FK cascade, user index |
| T-DB-S67 | merge | statement 1b — loser's subscriptions repoint to winner, tombstone holds none, re-run idempotent |
| T-DB-S68 | merge | 5d folds `push_prompt_dismissed_at` earliest-wins, both directions, NULL-safe |
| T-DB-S69/S70 | — | headroom |
| T-API-S124 | state route | eligible + key on the happy path (streak ≥ 3, undismissed, configured) |
| T-API-S125 | dormancy | each VAPID var missing → `{eligible:false, vapidPublicKey:null}`; POST/DELETE 503 before side effects |
| T-API-S126 | eligibility | dismissed → false; streak below threshold → false; remote-config row overrides the default |
| T-API-S127 | subscribe | Zod boundary: 400 unknown key / bad endpoint, 415, 403 cross-site, 401; happy path writes the row |
| T-API-S128 | subscribe | upsert: re-POST same endpoint keeps one row, updates keys; an endpoint follows the current session's user |
| T-API-S129 | unsubscribe | DELETE removes own row only (cross-user isolation), idempotent `{removed:true}` |
| T-API-S130 | dismiss | stamps once; re-post touches zero rows, never re-bumps `updated_at`; state flips ineligible |
| T-API-S131/S132 | — | headroom |
| T-WEB-S261 | sw source | no `fetch`/`caches` token post-`code()`-strip; exactly `push` + `notificationclick` listeners |
| T-WEB-S262 | sw source | `notificationclick` deep-links to `/` (focus-or-open) |
| T-WEB-S263 | push-client | strict parse; every failure resolves `undefined`; write sends explicit JSON content type |
| T-WEB-S264 | hook | awaits `ensureSession` first; three honest states (the S247-family shape) |
| T-WEB-S265 | card | renders only when the triple detect ∧ eligible ∧ permission `"default"` ∧ no local subscription — each conjunct falsified |
| T-WEB-S266 | card | each detect leg absent alone → never renders, no throw: no `Notification` (iOS Safari uninstalled), no `navigator.serviceWorker` (non-secure context), no `PushManager` (old Safari/WebViews) |
| T-WEB-S267 | card | accept: register → `serviceWorker.ready` → subscribe, ordering pinned (subscribe must not fire before `ready` resolves — the jsdom stubs must fail a register→subscribe shortcut), POST carries the subscription, card leaves DOM, nothing stamped |
| T-WEB-S268 | card | decline: dismiss POSTed, card leaves DOM, focus placed deliberately |
| T-WEB-S269 | card | subscribe rejection with permission `"denied"` → dismiss stamped; transient rejection → nothing stamped |
| T-WEB-S270 | i18n | `messages.push.*` reachable, pt-BR, no vocabulary drift |
| T-WEB-S271/S272 | — | headroom |
| T-LINT-S50 | free-play wall | `**/push`, `**/push/**`, `**/play/push-prompt-card` red from free play, both arms (static group + dynamic regex), clean-from-daily control — the T-LINT-S49 shape |
| T-LINT-S51 | — | headroom |

**Widened in place, no new id:** T-WEB-S136's storage scan gains the three push source files; export-count tripwires (T-DB-9e family) if the db entry grows; T-DB-S20's double-run snapshot covers the new statements by construction. jsdom has no `ServiceWorker`/`PushManager`/`Notification` — card tests stub them on `navigator`/`window` (define, not mock-import). `npx impeccable detect` for the card: the preview scan cannot see it (§9), so run `impeccable detect file://…` over the rendered card + its real stylesheet locally (the #31 ritual), both viewports, and pin the shape with a test.

## 9. What can be seen where

A Vercel preview **cannot** show the card: credentialed calls are anonymous on `*.vercel.app` (ADR-0048), so `eligible` is always false there — and VAPID vars are unset anyway (dormant, fail-closed, by design). Evidence strategy = #35's: jsdom tests, the local file:// detect run (both viewports, exit 0), and fixture-driven screenshots pasted in the PR body. The `Impeccable` workflow still scans the conclusion routes and must stay green (the card renders null there — profile unchanged).

## 10. Activation checklist (PR body, verbatim — Fernando's one-time step; dormant and fail-closed until done)

1. On any machine: `npx web-push generate-vapid-keys` — copy the two keys it prints.
2. `cd apps/api && vercel env add VAPID_PUBLIC_KEY production` — paste the public key.
3. `vercel env add VAPID_PRIVATE_KEY production` — paste the private key.
4. `vercel env add VAPID_SUBJECT production` — enter `mailto:privacidade@miolos.app`.
5. Redeploy miolos-api (or wait for the next deploy). The state endpoint starts answering eligible; nothing sends until #146.

## 11. Build order (step 5), landmines, exit criteria

**Order:** (1) schema.ts + migration 0007 → **apply to Neon, verify, only then push the branch**; (2) contracts + remote-config key (packages/core); (3) merge.ts 1b + 5d + db tests; (4) `isPushConfigured` + service + three routes + seam tests (PGlite, transports/time faked); (5) sw.js + eslint globals entry + source tests; push client/hook/card/strings/wall entries; local detect; (6) ADR-0062, privacy paragraph, `docs/README.md` rows (plan 058 + ADR-0062), test-id frontier update, napkin curation.

**Landmines:**
- The INSERT-column-list trap (§1) — the branch's first push is the deadline, not the merge.
- No transactions over neon-http: every statement individually idempotent; the upsert is the race-safety.
- Permission `"denied"` is permanent browser-side — never re-ask, and stamp so no other surface tries.
- Feature-detect all three globals (`Notification`, `navigator.serviceWorker`, `PushManager`) before touching any of them, or the card throws instead of hiding — iOS Safari uninstalled is only one of the three absences (§5).
- Source scans vs doc blocks: run sw.js and any `toContain` subject through `code()` first (napkin item 3).
- `noUncheckedIndexedAccess` on regex groups in the new scans: bind `match[1] ?? ""` (napkin item 8).
- Frontier collisions on parallel nights: the reservation is on issue #145; re-derive by grep after the pre-gate `git merge origin/main` anyway.
- Bundle budgets: only conclusion surfaces gain client JS; run `pnpm build` then `bundle-check` **from `apps/web`** and publish before/after figures if any budget moves.

**Exit criteria:** gate green with pasted output (`pnpm typecheck` / `lint` / `test --force`, bundle-check, detect evidence per §9); migration applied and verified on Neon; ADR-0062 `Accepted` in this diff with the falsified-record sweep done (merge.ts "two timestamps" comment, schema.ts writer list, ADR-0061 check); README rows added; frontier updated; PR body names Tier 2, carries §10's checklist, and states that no decision beyond activation waits on Fernando (Q1/Q2 gate B/C only).
