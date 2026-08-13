# Implementation plan — Issue #19: Hoje hub, streak, and PWA manifest

**Issue:** [#19](https://github.com/fernandolisboa/miolos/issues/19) — M1's remainder, run after M2 closed. Blocked by #18 (closed).
**Governing ADRs:** [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md) (streak semantics), [ADR-0009](../adr/0009-account-merge-recomputes-from-the-union-of-completions.md) (pure function over completion rows, in `packages/core`), [ADR-0026](../adr/0026-completions-are-write-once-rows-on-time-is-derived.md) (`on_time` derived in SQL), [ADR-0031](../adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) (server truth arrives with #19), [ADR-0014](../adr/0014-apps-web-reads-the-database-directly-for-public-pages.md) (streak reads go through `apps/api`), [ADR-0022](../adr/0022-opaque-session-tokens-in-a-sessions-table.md) (the cookie the read authenticates with), [ADR-0046](../adr/0046-free-play-routes-levels-and-the-ephemeral-session.md) (the wall a streak reader must not cross), [ADR-0047](../adr/0047-bundle-markers-are-route-scoped.md) (new routes are daily-strict by default), [ADR-0023](../adr/0023-proved-not-sampled-property-testing.md) (property-test run counts).
**Proposed ADR:** ADR-0048 — full draft in Appendix A, created as a real file at implementation time.
**Snapshot:** written against `main` at `0331185`. Point-in-time; where a later ADR disagrees, the ADR wins.

The hard part of this ticket is not the streak arithmetic — it is a ~20-line pure function. The hard part is the **delivery path**: the streak is the repo's first authenticated *read*, on a hub that is a synchronous server component with no session access, under an ADR that forbids `apps/web` from touching the rows. §3 D1 settles that path; everything else follows from it.

---

## Table of contents

- §0. Acceptance criteria → plan mapping
- §1. Scope boundary
- §2. Read first
- §3. Fixed decisions (D1–D15)
- §4. What already exists — the seams, verified
- §5. `packages/core` — the pure function
- §6. `packages/db` — the reader and the tripwire
- §7. `apps/api` — `GET /streak`
- §8. `apps/web` — the hub's live stamp
- §9. `apps/web` — the conclusion's streak card
- §10. PWA — manifest, icons, metadata
- §11. The free-play wall extension
- §12. Gates, rituals and the baseline shift
- §13. Test plan and reserved ids
- §14. What cannot be verified in this environment
- §15. What is deliberately NOT in this slice
- §16. Deviation / risk register
- §17. Commit and PR plan
- §18. Exit criteria
- Appendix A. Draft ADR-0048

---

## 0. Acceptance criteria → plan mapping

| AC | Claim | Where the plan discharges it |
|---|---|---|
| 1 | Streak derivation is a pure function in `packages/core` with unit/property tests: on-time completions only; late completions and played (lost-Termo) rows never count | §5 (function + edge semantics), §13 T-CORE table; the **#27-transferred obligation** ([issue comment 5159949996](https://github.com/fernandolisboa/miolos/issues/19#issuecomment-5159949996)) is discharged **by name at the `apps/api` seam** by T-API-S48 |
| 2 | Hub shows date, per-game done/pending, "X de 4", and the server-computed streak; matches the Hoje reference frames as amended; passes `npx impeccable detect` | §8; date/done-pending/"X de 4" already ship (`apps/web/app/page.tsx:91-94`, verified §4) — the streak value is the only hub gap; §12 for the detect runs. "As amended" = label "sequência", never "dias seguidos" (§4, three shipped regression tests) |
| 3 | `<AdSlot>` renders nothing and reserves its final dimensions per placement | **Already shipped and pinned** — §3 D14 verifies rather than rebuilds |
| 4 | Installable (manifest + icon); no service worker yet | §10; the service-worker deferral is deliberate and stated (§3 D13, §15) |
| 5 | Completing today's Binairo on consecutive days shows the streak incrementing | T-API-S49 (two consecutive Binairo days at the real-route seam → 1 then 2) + T-CORE-S32's constructive k-run oracle; the calendar-time residue is named in §14 |
| + | "The conclusion screen now shows streak status too" (issue body) | §9 — fills the deliberate gap at `apps/web/src/play/conclusion-view.tsx:61-66` |
| + | "Coming-soon tiles" (issue body) | **Moot** — all four games are live; `playRoutes` is total (`Readonly<Record<Game, Route>>` since #75) and no coming-soon branch exists. Stated in the PR, not silently dropped |

---

## 1. Scope boundary

**In scope**

- `computeStreak` in a new `packages/core/src/streak.ts`, with unit and fast-check property tests; `fast-check@4.9.0` added to `packages/core` devDependencies (§3 D10, §5).
- A new strict contract `packages/core/src/contracts/streak.ts` (§3 D4/D5).
- A new reader `listCompletionsForStreak` in `packages/db/src/completions.ts`, exported via `@miolos/db/user` with its tripwire widened in the same change (§6).
- A new authenticated `GET /streak` route in `apps/api` — the repo's first authenticated read (§7).
- A client streak module `apps/web/src/streak/` (fetch + hook), a `HubStreak` client component replacing the hub's hardcoded stamp value, and the conclusion's streak card (§8, §9).
- The free-play ESLint wall extended over the new streak modules, with probes (§11).
- PWA: `apps/web/app/manifest.ts`, icon assets (SVG master + rendered PNGs), `viewport`/`appleWebApp` metadata in `layout.tsx`, and the tests that pin them (§10).
- ADR-0048 as a real file; comment updates where shipped code points at #19 (`apps/web/src/play/day-state.ts:14-16`, `conclusion-view.tsx:61-66`, `conclusion-view.module.css:1-8`); the `docs/agents/test-ids.md` frontier re-derived at step 8.

**Out of scope** — §15 carries the full list with reasons and destinations.

**Not touched at all:** `packages/games` (no diff of any kind), `apps/web/src/free-play/` and `app/modo-livre/` (except the wall that *protects* them, which lives in `eslint.config.mjs` and its probe suite), `next.config.ts` (pinned by `apps/web/test/next-config.test.ts`), `.github/workflows/impeccable.yml` (no new scannable page route — §10.4), `completionResponseSchema` and the completion route's response path (§3 D4). A diff in any of these at step 6 is a finding by itself.

---

## 2. Read first (in this order)

1. `CLAUDE.md` — verification gates and project invariants.
2. ADR-0008, ADR-0009, ADR-0026, ADR-0031 — the streak's semantics and its architectural cage. ADR-0031 was written *for* this ticket; its decision 5 is the one thing this plan amends (§3 D4).
3. Issue [#58](https://github.com/fernandolisboa/miolos/issues/58) and Fernando's 2026-08-02 decision on it — binding context for the function's signature (§3 D2), **not** #19 scope.
4. `CONTEXT.md` — this plan uses its verbs exactly: **Completion (on time)**, **Late completion**, **Played**, **Streak / Sequência**, **Rollover**. "Win streak" is a banned term (`CONTEXT.md:45`).
5. `packages/db/src/completions.ts` and `apps/api/app/completions/route.ts` — the row shape, the `on_time` SQL, and the auth pattern the new route copies.
6. `apps/web/src/session/bootstrap.ts:166-206` — the shipped shape of a client call to `apps/api` (env guard, `credentials: "include"`, parse-never-cast).
7. `docs/design/006-handoff-design-winner-atelie/f1-hoje-desktop.dc.html` (:22-25) and `f5-conclusao-desktop.dc.html` (:53-56) — the streak stamp and the conclusion streak card, as visual specs **as amended** (label copy: §4).

---

## 3. Fixed decisions

Settled here so step 5 implements rather than re-litigates. D8's copy and D12's artwork are product-visible; Fernando can override either in the PR without blocking.

### D1 — The streak reaches the hub by a client fetch to a new authenticated `GET /streak` on `apps/api`

The constraints, each with its source:

- `apps/web` may not read the rows: ADR-0014 — "Everything else through `apps/api`: anything authenticated or user-specific (**streaks**, completions, stats, consents)" — enforced mechanically by the `@miolos/db/user` subpath (ADR-0026 decision 5) and the ESLint db wall.
- The session cookie is minted **client-side** (`apps/web/src/session/bootstrap.ts:180-183`, `POST ${apiUrl}/session` with `credentials:"include"`). Under `COOKIE_DOMAIN=miolos.app` it is shared across subdomains; when `COOKIE_DOMAIN` is unset the cookie is **host-only on the API host** (`apps/api/src/session/cookie.ts:9-12`, 22-26). On localhost that still reaches `apps/web`'s server ("shared across localhost:3000/3001 because cookies ignore ports", `cookie.ts:9-11`). On `*.vercel.app` previews **no path is authenticated at all**: the cookie is `SameSite=Lax` (`cookie.ts:22`) and `vercel.app` is on the Public Suffix List, so preview web→api is **cross-site** — a Lax cookie is neither sent on nor set by a cross-site fetch, and the origin guard already denies `Sec-Fetch-Site: cross-site` writes (`origin-guard.ts:23`). On previews *every* credentialed call — the shipped sync and Termo guess included — is anonymous; the streak fetch degrades to the zero state there exactly as any alternative would.
- There is **no precedent** for `apps/web` server code fetching `apps/api` — every server page reads the DB directly through the wall, and every API call in the tree is a browser fetch (verified: the only three callers are `session/bootstrap.ts:180`, `play/sync.ts`, `termo/guess-client.ts`).

**Decision:** a browser fetch with `credentials: "include"` to a new `GET /streak`, mirroring `bootstrap.ts`'s shape. Chosen on its real discriminators — preview parity is **not** one of them (previews are anonymous on every path, above): the hub stays synchronous (the smoke-suite constraint, D7), a browser fetch is the only shipped precedent for calling `apps/api` (the three callers listed above), and the failure mode everywhere is the honest zero state. The hub server-renders the zero state; the value hydrates in (D7).

**Rejected:**
- *Server-side fetch from the hub's server component* — no better on previews (both paths are anonymous there, above) and structurally worse: it makes the hub `async`, breaking the 16 `render(<HojePage/>)` calls in `hoje.smoke.test.tsx` plus the T-WEB-S17 `renderToStaticMarkup` first-paint contract (RTL cannot render an async server component). `route-ssr.test.tsx` is *not* the constraint — that suite already renders async server pages via `renderToStaticMarkup(await page.default())` (all four game routes are async).
- *Widening `completionResponseSchema` to carry the streak* — it is `z.strictObject` (`packages/core/src/contracts/completion.ts:218-228`), parsed on both ends (`sync.ts` `acceptResponse`; `completionResponse` at `apps/api/app/completions/route.ts:56-64`), so a widened response 500s deployed clients and vice versa; and the hub needs the streak *without* a completion having just happened.
- *`apps/web` reading completions from Neon* — vetoed outright by ADR-0014 + ADR-0026 decision 5 + the db wall; not a candidate, listed only so no reviewer wonders.

### D2 — `computeStreak(rows, today)`: rows plus a caller-supplied `today`; on-time is a field of the row, never recomputed

Signature (full spec in §5):

```ts
computeStreak(rows: readonly StreakRow[], today: string): StreakStatus
// StreakRow    = { date: string; outcome: CompletionOutcome; onTime: boolean }
// StreakStatus = { streak: number; todayCounts: boolean }
```

- **`today` is a parameter.** `packages/core` has no clock and no timezone helper (verified: no date arithmetic exists in the package; the only date primitives are the Zod shapes in `contracts/daily.ts:41` ff.), and CLAUDE.md forbids a client clock in streak arithmetic. The caller supplies the DB clock's SP date via `todaySaoPaulo(db)` (`packages/db/src/buffer.ts:19-28`) — ADR-0010's single authority, already how `POST /completions` bounds its dates (ADR-0026 decision 6).
- **`onTime` is consumed, never derived.** Fernando's #58 decision (2026-08-02, on the issue): late-sync credit will eventually be decided **once at write time and stored on the row**, amending ADR-0009/0026, precisely so "the streak stays derivable from completion rows alone". A function that recomputed on-time from a timestamp would have to be rewritten when #58 lands; a function that consumed `onTime` as row data is untouched — the seam #58 changes is the *producer* of the field (today the SQL projection at `packages/db/src/completions.ts:55`; later a stored column). The function therefore takes no timestamp of any kind and consults nothing but the rows and `today`.
- **Anchor semantics: a streak whose last on-time day is *yesterday* is alive until the rollover.** A day counts iff it has ≥1 row with `outcome === "won"` **and** `onTime === true`; the streak is the maximal run of consecutive counted days ending at `today` or at `today − 1 day`. Rationale: ADR-0008 rule 1 defines what *maintains* a streak (an on-time completion on its own day) and never defines when a streak *reads as broken*; CONTEXT.md:14 defines it as "Consecutive days with ≥ 1 on-time completion" — a 12-day run ending yesterday is still 12 consecutive days, and it is not yet broken while today's window is open. The alternative — the hub reading 0 every morning until the first puzzle is solved — would contradict the product's core loop ("The streak is the core mechanic and the reason to return", `PRODUCT.md`): the number you return *for* would be gone at the moment of return. This is a semantic no ADR settles; ADR-0048 records it (Appendix A), and Fernando can veto it in the PR at the cost of one comparison and its tests.
- **Lost rows are excluded as non-completions, categorically** — a `lost` row never counts, on time or not (ADR-0008 rule 3: "played, not completed"; the transferred obligation's exact claim). In the algorithm both exclusions are conjunctive (§5), so no ordering bug is expressible; the tests still pin the lost-and-on-time case explicitly because that is the case #27 transferred.

### D3 — The reader returns raw rows; the pure function is the only filter

`listCompletionsForStreak(db, userId)` selects `{date, outcome, onTime}` for every completion row of the user — **no `where outcome = 'won'`, no `where on_time` in SQL**. Rationale: ADR-0009's consequence makes the `packages/core` function *the* streak authority ("the streak recomputation routine must exist as a pure function over completion rows … merge is just one caller", ADR-0009:26). If SQL pre-filtered, the core function's exclusion of lost/late rows would be unreachable dead logic at the API seam, and the seam test (T-API-S48) would be proving a SQL `WHERE` clause rather than the function AC 1 names. Two filters is two definitions of the streak; there is one.

Cost: the query returns all of a user's rows. Bounded at ≤4 per day (composite PK, ADR-0026 decision 1), covered by the index built for exactly this read — `completions_user_date_idx` with the schema's own comment "the streak recompute and 'the day so far' both read (user_id, date) across games" (`packages/db/src/schema.ts:236-238`). At v1 scale (months of days × ≤4 rows) this is hundreds of rows per request; a windowed read is a later optimisation with a named trigger (§16 risk 6), never a semantic change.

The `onTime` projection **reuses the one SQL definition** — the same expression `getCompletion` ships (`completions.ts:55`), per ADR-0026 decision 2 ("in one place and one language"). `completedAt` stays unexposed (`completions.ts:24-25`).

### D4 — A new minimal strict contract; the day-truth payload of ADR-0031 decision 5 is deferred, on the record

New `packages/core/src/contracts/streak.ts`:

```ts
export const streakResponseSchema = z.strictObject({
  /** The DB clock's SP date the value was computed against. */
  date: isoDateString,
  streak: z.number().int().min(0),
  /** Whether `date` itself is a counted streak day — drives the conclusion card's tail copy (§9). */
  todayCounts: z.boolean(),
});
```

`isoDateString`, not `calendarDateString`: the value is server-derived (the precedent argued at `contracts/completion.ts:212-214`). `streakResponseSchema` and its inferred `StreakResponse` type are exported via the `packages/core/src/index.ts` barrel, like every shipped contract, so the route and the web client both import them from bare `@miolos/core`. Parsed on both ends — `streakResponseSchema.parse(...)` before `Response.json` in the route, and `safeParse`/`parse` in the web client (boundary rule).

**What is deliberately not in this payload: the per-game server day state.** ADR-0031 decision 5 says "#19 replaces `readDayState`'s body and nothing else … the local reader stays as the offline fallback." That sentence was written when #19 was the next ticket; #23–#28 shipped the local reader and its whole consumer surface in the meantime, and the issue's acceptance criteria require the streak only — "per-game done/pending" is served today by the local reader (`apps/web/src/play/day-state.ts:98-105`), shipped and tested. Replacing `readDayState`'s body means a second payload (per-game, per-day server truth), a merge discipline with the local records (server says done, device says pending mid-play — which wins, when?), and a cache/refresh story: a real slice, not a rider. **Decision: defer it.** ADR-0048 amends ADR-0031 decision 5 accordingly (Appendix A), and step 8 files a follow-up issue ("cross-device day state: the server day-truth payload and `readDayState`'s body") so the deferral has an address, not just a paragraph. Because the contract is strict on both ends, the future payload arrives as a **new endpoint and contract** (e.g. `GET /day`), never as fields appended to this one — additive fields on a strict schema break every deployed client's parse; this is stated in the contract's TSDoc.

**`completionResponseSchema` is not widened** — see D1's rejected list.

### D5 — The response carries `todayCounts`, and that is the whole "status" surface

The conclusion card's tail copy — F5's "mantida por hoje." (`f5-conclusao-desktop.dc.html:56`) — is a claim that *today maintained the streak*. It is false on a day whose only terminal is a lost Termo (ADR-0008 rule 3) and false on a morning where yesterday's streak is alive but today is unplayed. The client cannot derive the distinction honestly (its day state is device-local and can understate, ADR-0031 decision 2), so the server says it: `todayCounts` is computed by the same pure function from the same set (§5). One boolean, derived not stored, no second source of truth.

### D6 — No preflight, no OPTIONS handler, `Cache-Control: no-store`

A credentialed `GET` with no custom request headers is a CORS **simple request** — the browser sends it without preflight (Fetch spec; the same reasoning `bootstrap.ts:178-179` records for the body-less POST). So the route ships **no `OPTIONS` handler**, and `preflightResponse()`'s hardcoded `"POST, OPTIONS"` (`apps/api/src/cors.ts:58`) is **not touched** — widening a shared header that `/session` and `/completions` also emit, for a preflight that never occurs, would be change without a caller. If a future revision adds a custom header to this GET, that revision widens `preflightResponse` with its own test.

Response headers: `corsHeaders({ credentials: true })` (required, or the credentialed fetch's response is unreadable to JS — the reasoning at `apps/api/app/completions/route.ts:40-47`), plus **`Cache-Control: no-store`** — new, deliberate, and argued: this is the repo's first authenticated GET, the first response where a shared cache could serve one user's data to another; POSTs were never cacheable, so the discipline has no precedent to inherit and starts here. The origin guard stays write-only (`apps/api/src/session/origin-guard.ts` is consumed by the two write routes): a read mutates nothing, and its confidentiality is carried by the CORS allowlist plus the cookie.

### D7 — The hub stays a synchronous server component; the stamp becomes a client island rendering the zero state first; no `localStorage` cache

- **Synchronous, unchanged:** `HojePage` has no `await` (`apps/web/app/page.tsx:77-150`); making it `async` would break `render(<HojePage/>)` in every `hoje.smoke.test.tsx` case (RTL cannot render an async server component — the constraint `apps/web/app/binairo/page.tsx` records). `route-ssr.test.tsx` copes with async pages (`renderToStaticMarkup(await page.default())`); the smoke suite is the constraint. The streak arrives client-side, so nothing forces async.
- **`<HubStreak/>`**, a `"use client"` component at `apps/web/app/hub-streak.tsx` — beside `page.tsx` for the same reason `hub-day-state.tsx` sits there ("CSS Modules hash per file", `hub-day-state.tsx` precedent): it imports `./page.module.css` and reuses `.streakStamp`/`.streakNumeral`/`.streakLabel` unchanged. It replaces the stamp block at `page.tsx:96-106`; `const streakCount = 0` (`page.tsx:84`) is deleted.
- **Server render and pre-hydration paint show `0`** — the same `useSyncExternalStore`-style agreement `useDayState` establishes (`day-state.ts`, server snapshot `NOTHING_DONE`): here a `useState(undefined)` whose render maps `undefined → 0`, so server markup and first client paint agree byte-for-byte and hydration only ever *raises* the number — the monotone direction ADR-0031 decision 2 names. The stamp's composition is fixed (numeral + label); only the numeral text and the `aria-label` (`messages.hoje.streak.aria(count)`, `messages.ts:113-114`) change when the fetch resolves. The first-paint test (`hoje.smoke.test.tsx:410-427`: server render touches neither storage nor `Date.now`) survives because the module reads no clock and no storage at render; the fetch fires in a mount effect only. T-WEB-S127 extends that assertion to cover the new component explicitly.
- **Offline / unfetched / anonymous shows the zero state, and no last-known value is cached.** Rejected: persisting the last server value in `localStorage`. It would be a *stale server number presented as current* — wrong in both directions (broken on another device; extended on another device) — where the zero state is the honest "unknown" of a value the client can never compute (ADR-0031 decision 6: device state "can never back a streak"). It would also add a persisted surface the free-play keyspace proof (`T-WEB-S117`) has to reason about, and a third state (stale) to every consumer. The cost is a visible `0 → N` settle on each hub load; accepted for v1 and recorded in ADR-0048, with #29 (stats) named as the natural revisit if it grates.
- `impeccable detect` scans a clean profile with no cookie (ADR-0031 consequence (e)), so the gate sees exactly the shipped zero-state composition — already a legitimate design, already pinned (`ink-on-accent.test.ts:192-240`; `hoje.smoke.test.tsx:141-154`).
- Fetch behavior: `fetchStreak()` in `apps/web/src/streak/streak-client.ts` follows `bootstrap.ts:166-206` verbatim in shape — loud `console.error` + no-op when `NEXT_PUBLIC_API_URL` is unset; `credentials: "include"`; `streakResponseSchema` parse; every failure path (non-200, network, parse) returns `undefined` and the UI keeps the zero state. A 401 is a normal answer (cold visitor mid-mint), not an error to surface.

### D8 — The conclusion card: gated on the server holding the day, skeleton-then-value, absent on failure

Full spec in §9. The three-line version: the card renders in the conclusion's `<aside className={styles.side}>` in F5's position (`f5-conclusao-desktop.dc.html:53-56` — first in the side column, above "O dia até agora"); it mounts only once **this game's completion is on the server** (`syncOutcome === "recorded"`, the field `conclusion-view.tsx:135` already reads); while the fetch is in flight it renders at final dimensions with the numeral blanked — the shipped `PlaySkeleton` discipline (reserve the boxes, blank the values) — and if the fetch fails it unmounts to the shipped absence, which is today's state and therefore honest. Offline conclusions (sync pending) never gate it open, so the offline answer is the current one: no card, no fake zero (`conclusion-view.tsx:61-66`'s own reasoning, which this change retires for the fetched case and keeps for the unfetched one).

### D9 — Every new module that can reach the streak goes behind the free-play wall, in the same change

ADR-0046's consequence — "Free play never touches streak, statistics distributions or medals (ADR-0008 rule 5) — enforced by an ESLint wall" — is a claim that stays true only if the ban list grows with the surface, because `no-restricted-imports` bans by **name** and is **non-transitive** (the design stated at `eslint.config.mjs`'s wall-3 header). §11 adds the `**/streak/**` group to `freePlayBannedModuleGroups`, extends the `freePlayDynamicBannedModule` regex, and lands probes T-LINT-S21/S22 beside scope controls, in the same commit that creates the modules.

### D10 — `fast-check@4.9.0` enters `packages/core` as a devDependency

`packages/core` has no fast-check today (`packages/core/package.json` devDeps: `@miolos/games`, `typescript`, `vitest`); AC 1 requires property tests. `4.9.0` is the version already pinned in `packages/db` and `packages/games`, and is the current npm latest (verified `pnpm view fast-check version` → `4.9.0` on 2026-08-12 — no drift between the repo pin and upstream). Run counts ≥100 for the main properties (ADR-0023:34 — "Run counts are a floor, never below 100 for the main [properties]"). §13 names the properties.

### D11 — The manifest is an `app/manifest.ts` route, not a static `public/` file

Next serves `app/manifest.ts` (typed `MetadataRoute.Manifest`) at `/manifest.webmanifest` and injects the `<link rel="manifest">` itself. Chosen over a static `public/manifest.webmanifest` because the manifest carries **product strings** (name, description) and CLAUDE.md requires strings externalised for i18n from the start: a TS route imports `messages` (`messages.meta.description`, `messages.brand.wordmark` — `messages.ts:16,92-95`), where a static JSON file would be the repo's first out-of-module copy of product copy. It is also directly unit-testable: T-WEB-S130 imports the default export and asserts against the same `messages` object, no HTTP needed.

Gate implications, stated rather than discovered: the manifest is a metadata route, not a page — no React tree, so **no row in `route-ssr.test.tsx`'s ROUTES table** (that suite renders page components) and **no `impeccable.yml` path** (nothing visual to scan). If it appears in `route-bundle-stats.json` at all, it carries no first-load client chunks; any chunk attribution it does get folds into daily scope by ADR-0047's fail-closed default ("New routes are daily-strict by default"), which is the correct direction. Verified against the real build at step 8; §16 risk 1 pre-agrees the response if the stats shape surprises.

### D12 — Icons: an authored SVG master in-repo, PNGs rendered by a committed script; Nano Banana artwork is a non-blocking swap

The repo ships zero binary images today (verified: no `.png`/`.svg`/`favicon` under `apps/web`; no `public/` directory). CLAUDE.md:89 sanctions generated (Nano Banana) images for the icon — but generation is Fernando's tool, not something step 5 can invoke. **Decision:** step 5 authors a **code-drawn SVG mark** in the Ateliê language — paper ground, a rotated inner card with a hard single-color offset shadow in sealing-wax `#9E3B2F`, a small grid motif; geometry only, no text (font-dependent text in an SVG icon renders differently per platform) — as the committed master, and renders the PNG set from it with a committed one-shot script:

- `apps/web/app/icon.svg` — the favicon, by Next file convention (auto-linked).
- `apps/web/app/apple-icon.png` — 180×180, by Next file convention (auto-linked as `apple-touch-icon`; iOS ignores manifest icons, so this is what "installable" looks like on an iPhone home screen).
- `apps/web/public/icons/icon-192.png`, `icon-512.png` (`purpose: "any"`), `icon-maskable-512.png` (`purpose: "maskable"`, artwork inset to the ~80% safe zone) — referenced from `app/manifest.ts`. 192 + 512 are Chromium's installability floor; PNG rather than SVG because SVG manifest-icon support is Chromium-only and maskable-SVG behavior is not worth betting the AC on.
- `apps/web/scripts/render-icons.mjs` — reads the SVG master, writes every PNG, using `sharp` (current stable) as an `apps/web` devDependency; hand-run, outputs committed, so the binaries in the repo have a reproducible provenance. Fallback if `sharp`'s native install misbehaves in this environment: `@resvg/resvg-js` (§16 risk 2).

If Fernando prefers a Nano Banana mark, the swap is: replace the SVG master, re-run the script, commit — paths, manifest and tests unchanged. Named as a non-blocking decision in the PR.

### D13 — No service worker, said out loud

Nothing in this ticket registers a service worker, and its absence is a decision, not a gap: the issue itself defers it ("no service worker yet — that ships with push"), and the push ticket (streak-at-risk, the product's single notification type) is where a worker first earns its complexity. Installability does not require one (Chromium dropped the SW requirement from its install criteria; iOS never had it). T-WEB-S131's metadata assertions double as the tripwire that no registration snuck in via the layout.

### D14 — AC 3 is verified, not rebuilt

`<AdSlot>` shipped in M0 and is fully pinned: component at `apps/web/src/components/ad-slot.tsx` (renders an `aria-hidden` div with inline `minHeight`), placement values at `packages/ui/src/ad-slot-placements.ts` (`hub-desktop: 60`, `hub-mobile: 64` — the exact numbers `DESIGN.md:52` specifies from the frames), mounted on the hub (`page.tsx:142-147`), asserted by `packages/ui/test/ad-slot-placements.test.ts` and `hoje.smoke.test.tsx:174-186` (both `minHeight` values checked). **This plan changes none of it.** Step 8's evidence for AC 3 is the green run of those existing tests plus `impeccable detect` on `/`, cited by test id in the PR — the evidence rule satisfied without a redundant rebuild. The placement key set stays exactly two; a third placement belongs to the ticket that has a third surface.

### D15 — ADR-0048 is proposed with this ticket

The delivery path (first authenticated read; client-fetched, server-computed streak; zero-state fallback), the anchor semantics (D2), and the ADR-0031 decision-5 amendment (D4) are each "a technical decision of any weight" (CLAUDE.md "When in doubt"). One ADR carries all three, because they are one design: how the streak travels and what it means when it reads. Draft in Appendix A; created as `docs/adr/0048-the-streak-is-a-client-fetched-server-computed-value.md` at implementation time. An ADR owes no `docs/README.md` row; this plan owes one (added with this document).

---

## 4. What already exists — the seams, verified

Every row re-verified against the working tree at `0331185`.

| Seam | Where | State |
|---|---|---|
| Hub date, "X de 4", done/pending tiles | `apps/web/app/page.tsx:81-94,109-127`; `hub-day-state.tsx` | Shipped (#23–#28). The date is the server's clock on a `force-dynamic` segment (`page.tsx:9-10,51-64`) |
| The hardcoded streak | `page.tsx:84` `const streakCount = 0` | The one hub gap; ADR-0031 decision 3 predicted exactly this handover |
| The stamp's design + copy | `page.module.css:44-79,314-326`; `messages.ts:110-115` (`label: "sequência"`, `aria(count)`) | Shipped; no new hub copy needed. Frames-vs-shipped amendment already recorded: F1/F2 say "dias seguidos"/"dias", three tests assert those strings never render (`hoje.smoke.test.tsx:188-191`, `binairo-screen.test.tsx`, `conclusion-view.test.tsx`) — AC 2's "matches the frames" reads **as amended** |
| The `--accent-app`-on-paper exception for the stamp | `ink-on-accent.test.ts:192-240`; ADR-0041 | Pinned; **allow-list widened by name, in the ADR-0041 idiom** — the conclusion card adds two accent-text declarations to a `SHARED` sheet (§9) |
| `<AdSlot>` | D14's list | Shipped and pinned; verify only |
| The conclusion's deliberate streak gap | `conclusion-view.tsx:61-66`; `conclusion-view.module.css:1-8` | "the streak card (#19/#20, server-computed)" — this plan fills it (§9) and updates both comments |
| `syncOutcome` on the conclusion | `conclusion-view.tsx:128-135,331-338` | The gate D8 reads already exists |
| Row shape + `on_time` SQL | `packages/db/src/completions.ts:27-34,55` | `CompletionRecord.onTime` derived in the projection; the same expression D3 reuses |
| The index for this read | `packages/db/src/schema.ts:236-238` | `completions_user_date_idx`, with the streak named in its comment |
| The auth pattern | `apps/api/app/completions/route.ts:266-272`; `requireUserId` at `apps/api/src/session/service.ts:81-90` | Cookie → hash → `sessions` lookup; never mints |
| The client-call pattern | `session/bootstrap.ts:166-206` | Env guard, `credentials:"include"`, parse-never-cast, swallow-network-errors |
| `todaySaoPaulo(db)` | `packages/db/src/buffer.ts:19-28`, exported via `@miolos/db/publishing` | The `today` the route passes to `computeStreak` |
| The tripwires a new export trips | `packages/db/src/user.ts:9-10` + `test/user.test.ts`; root surface pinned in `test/published.test.ts` | §6 widens `user.ts` and its tripwire together; the root entry is untouched |
| The free-play wall to extend | `eslint.config.mjs` (`freePlayBannedModuleGroups`, `freePlayDynamicBannedModule`); probes in `apps/web/test/eslint-free-play-wall.test.ts` | §11 |
| PWA | nothing — no `public/`, no manifest, no icon, no `viewport`/`themeColor`/`appleWebApp` (`layout.tsx:28-34` is the entire metadata) | §10 is greenfield |
| Prior streak computation | none anywhere (grepped `streak|sequência` across the tree) | The function is written fresh, against ADR-0008/0009 |

---

## 5. `packages/core` — the pure function

New file `packages/core/src/streak.ts`, exported from the barrel (`src/index.ts`).

```ts
import type { CompletionOutcome } from "./completion";

/** One completion row as streak arithmetic sees it (ADR-0009). `onTime` is
 *  a FIELD OF THE ROW — produced today by the SQL derivation (ADR-0026
 *  decision 2), by a stored column if #58 lands — and is never recomputed
 *  here: no timestamp enters this module (#58's decided direction). */
export interface StreakRow {
  readonly date: string; // 'YYYY-MM-DD', the puzzle's own SP day
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
}

export interface StreakStatus {
  readonly streak: number;
  /** Whether `today` itself is a counted day (drives conclusion copy, §9). */
  readonly todayCounts: boolean;
}

export function computeStreak(
  rows: readonly StreakRow[],
  today: string,
): StreakStatus;
```

**Algorithm** (spec, not pseudocode to be improved on):

1. A row **qualifies** iff `outcome === "won" && onTime === true && row.date <= today` (ISO strings compare lexicographically; the date bound makes future-dated rows — which ADR-0026 decision 6 should render impossible — inert rather than load-bearing).
2. Map each qualifying row's date to an epoch-day integer (`Date.UTC(y, m-1, d) / 86_400_000` — timezone-free calendar arithmetic, the same trick `apps/api/src/publishing/dates.ts` uses; the ~8-line helper is private to this module, and consolidating it with `apps/api`'s `addDays` is a named non-goal: core cannot import from an app, and hoisting the app's helper into core is a refactor with its own blast radius that this ticket does not need). Collect into a `Set`.
3. `todayCounts` = the set contains `epochDay(today)`.
4. Anchor = `epochDay(today)` if `todayCounts`, else `epochDay(today) − 1` (D2's alive-until-rollover semantics).
5. Walk the anchor downward while the set contains it, counting. Return `{ streak, todayCounts }`.

Properties this construction gives for free, each pinned by test (§13): permutation invariance and duplicate-collapse (the `Set`), determinism (no clock, no randomness, no I/O), and the categorical exclusion of `lost` and late rows (step 1 is conjunctive — there is no path where a lost row's `onTime` is ever consulted for counting).

**Edge semantics fixed here** (each a named unit test):

| Input | Result | Why |
|---|---|---|
| `rows = []` | `{streak: 0, todayCounts: false}` | nothing counts |
| run ends yesterday, today unplayed | run length, `todayCounts: false` | D2 anchor rule |
| run ends two days ago | `0` | broken at the rollover that passed unplayed |
| today's only row is `lost` (on time) | today not counted; streak anchors at yesterday | ADR-0008 rule 3; the transferred obligation's second half |
| `lost` / `onTime:false` rows interleaved inside a run | ignored entirely | step 1 |
| a day's only rows are late (`onTime:false`) wins | day not counted → gap → run truncates | ADR-0008 rules 1–2 |
| duplicate dates (several games, one day) | day counts once | Set; CONTEXT.md:14 "≥ 1" |
| rows out of order / reversed | identical result | Set construction |
| rows dated after `today` | ignored | step 1's bound |

No Zod inside the function: it is pure arithmetic over an already-typed shape; validation belongs to the boundaries that produce the rows (the DB projection is typed; the API response is parsed). `packages/core` stays dependency-clean (zod only, `package.json` verified) — fast-check enters devDependencies only (D10).

---

## 6. `packages/db` — the reader and the tripwire

In `packages/db/src/completions.ts` (beside `getCompletion`, sharing its style: no JS `Date`, projection-derived `onTime` — file header `:14-17`):

```ts
/** Every completion row of one user, shaped for `computeStreak`
 *  (ADR-0009). Deliberately UNFILTERED: the pure function in
 *  packages/core is the only place lost and late rows are excluded,
 *  so the API seam exercises the authority AC 1 names (plan 027 D3). */
export async function listCompletionsForStreak(
  db: Db,
  userId: string,
): Promise<StreakRow[]>;
```

- Projection: `date`, `outcome`, and the **same** `onTime` SQL expression as `getCompletion` (`completions.ts:55`) — hoisted into a module-local constant/helper so the definition exists once in the file, satisfying ADR-0026 decision 2's "one place and one language" within this module.
- `where eq(completions.userId, userId)`, `orderBy` date descending (an ordering the function does not require — it is permutation-invariant — but which keeps the query planner on `completions_user_date_idx` and makes test fixtures readable). No limit in v1 (D3; §16 risk 6 names the windowing escalation).
- Return type is `@miolos/core`'s `StreakRow` — `packages/db` already imports types from core (`completions.ts:1`), so the row shape has exactly one definition.
- Exported from `packages/db/src/user.ts` **and** the pinned export list in `packages/db/test/user.test.ts` is widened in the same commit — the tripwire's documented contract ("widening this surface fails the suite", `user.ts:9-10`). The root `@miolos/db` entry is untouched: `apps/web` must stay unable to name the table or this reader (ADR-0026 decision 5).
- No migration: the schema and the index already serve this read (§4).

---

## 7. `apps/api` — `GET /streak`

New file `apps/api/app/streak/route.ts`. The repo's first authenticated read; it copies `POST /completions`' machinery minus everything write-shaped:

```
export const dynamic = "force-dynamic";           // every route does (verified)
GET:
  db = getDb();                                    // per-request, apps/api/src/db.ts
  userId = await requireUserId(db, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!userId) return errorResponse(401, "no-session");   // completions route:266-272 verbatim
  today = await todaySaoPaulo(db);                 // @miolos/db/publishing — the DB clock, ADR-0010
  rows = await listCompletionsForStreak(db, userId);      // @miolos/db/user
  status = computeStreak(rows, today);             // @miolos/core — the only filter (D3)
  return Response.json(
    streakResponseSchema.parse({ date: today, ...status }),   // parse, never cast
    { headers: { ...corsHeaders({ credentials: true }), "Cache-Control": "no-store" } },
  );
```

- A route-local `errorResponse` mirroring the completions route's (`route.ts:49-54`) — that file's own comment records that the envelope deliberately stays per-route.
- No `OPTIONS`, no `preflightResponse` change, no origin guard, no content-type check (there is no body) — each a D6 decision, each stated in the route's header comment so a future reviewer finds the reasoning where the absence is.
- No request parameters at all: the user is the cookie, the day is the DB clock. A `?date=` parameter would be an archive-statistics feature (#29/#31), not a streak read.
- `requireUserId` never mints (the comment at `service.ts:71-74` — "minting on a write would create a phantom user"; the function at `:81-90`; equally right for a read: a GET from a cookieless client is 401, and `SessionBootstrap` owns minting).

---

## 8. `apps/web` — the hub's live stamp

File-by-file:

- **New `apps/web/src/streak/streak-client.ts`** — `fetchStreak(): Promise<StreakResponse | undefined>` per D7's spec (env guard with loud `console.error`, `credentials: "include"`, `streakResponseSchema` parse, `undefined` on any failure). The module has no React import — fetch and parse only — so it is testable without rendering.
- **New `apps/web/src/streak/use-streak.ts`** — `useStreak(options?: { enabled?: boolean; refreshKey?: unknown }): StreakResponse | undefined`. Mount effect calls `fetchStreak` when `enabled !== false`; re-runs when `refreshKey` changes identity (the conclusion's gate, §9); a stale-response guard (effect-scoped `cancelled` flag) makes React 19 strict-mode double-effects and out-of-order resolutions harmless — the duplicate GET is idempotent and cheap.
- **New `apps/web/app/hub-streak.tsx`** (`"use client"`) — renders the existing stamp markup (`page.tsx:96-106` moved verbatim: same classes, same `aria-hidden` split, same `messages.hoje.streak.*` keys) with `count = useStreak()?.streak ?? 0`. No new copy, no new CSS.
- **`apps/web/app/page.tsx`** — the stamp block and `const streakCount = 0` replaced by `<HubStreak />`; nothing else changes. The page stays synchronous (D7); `todayInSaoPaulo`/`todaySaoPauloDate` untouched.
- **Comment updates:** `day-state.ts:14-16` ("#19 replaces `readDayState`'s BODY…") is rewritten to point at ADR-0048's amendment and the follow-up issue (D4) — a stale pointer to a plan that deliberately did otherwise is exactly the drift `docs/agents/domain.md` exists to prevent. `hub-day-state.tsx:19-20` ("the streak … is not read here at all (#19)") stays true and gains only the past-tense edit.
- **Existing tests touched:** `hoje.smoke.test.tsx` gains a `beforeEach` **pair** — `vi.stubEnv("NEXT_PUBLIC_API_URL", …)` beside the fetch stub (resolving 401-shaped) — so `HubStreak`'s effect is inert and every existing assertion — including `streak.aria(0)` at `:151-153` — passes unchanged. The pair is mandatory, not stylistic: with only the fetch stub, D7's env guard short-circuits, the stub is dead code and every hub case logs the loud `console.error`; every shipped API-client suite pairs the two (`session-bootstrap.test.tsx:21,33`, `play-sync.test.ts:154,186`, `termo-guess-client.test.ts:65,86`). The T-WEB-S17 first-paint describe additionally spies `fetch` (T-WEB-S127 sits beside it). `route-ssr.test.tsx`'s `/` row needs no change (the page is still synchronous and hands the client tree only serialisable props).

---

## 9. `apps/web` — the conclusion's streak card

The gap this fills is documented at `conclusion-view.tsx:61-66`: the streak card is absent "because rendering … a zero streak would be fake data". The fetched server value is not fake data; the gate below keeps every unfetched state exactly as honest as today's absence.

- **Placement:** first child of `<aside className={styles.side}>` (`conclusion-view.tsx:342`), above the "O dia até agora" card — F5's own order (`f5-conclusao-desktop.dc.html:53-56`). Mount-shift is bounded to the gated case (below); the clean-profile state that `impeccable detect` scans never renders it (no cookie → 401 → no card), so the visual gate sees today's shipped composition (the ADR-0031 consequence-(e) split: jsdom owns the populated state, the file-mode/manual ritual shows it in a browser).
- **Gate:** the card's state machine keys on the record the view already reads (`useRecordSnapshot`, `syncOutcome` at `:128-135`):
  - `syncOutcome !== "recorded"` → **no card** (today's shipped absence). This is the offline answer by construction: a conclusion reached offline has `syncOutcome: "pending"`, and a card claiming a streak the server has not counted would be the client clock backing a streak — the forbidden direction.
  - `syncOutcome === "recorded"` → mount the card at final dimensions with the numeral blank and fire `useStreak({ enabled: true, refreshKey: syncOutcome })` — the `PlaySkeleton` discipline (reserve the boxes, blank the values). Because the gate only opens after the server holds the day, the fetched number **includes today by construction** — no race against the sync queue.
  - fetch resolves → numeral + copy render — **including a fetched zero**. The gate opens for a *late* win (recorded with `onTime: false`, ADR-0026 decision 7's window) and for a lost-Termo-only day, so a user with no prior history can resolve `{streak: 0, todayCounts: false}` on a mounted card. That zero is *real server data*, not the fake zero `conclusion-view.tsx:61-66` refused to invent, and the card **renders it honestly**: "0 dias de sequência", bare value, no tail. Suppressing at `streak === 0 && !todayCounts` is the legitimate alternative; rendering the honest zero is the default, named as Fernando-overridable in §17 and pinned by T-WEB-S128/S129.
  - fetch fails (rare: recorded earlier, reloaded `/concluido` offline) → the card unmounts back to absence.
- **Composition** (from F5:53-56, in the shared stylesheet's idiom): bordered paper card, `1.5px solid var(--accent-app)`-style sealing-wax treatment with the hard 0.25-alpha offset shadow and slight rotation, tape scrap, Fraunces numeral (the ADR-0036-sanctioned non-aligning case, same as the hub stamp), two-line label. New classes in `conclusion-view.module.css`: **`.streakCard`** (the card box), **`.streakCardNumeral`** and **`.streakCardLabel`** (the two accent-text declarations, per F5:55-56 both `color: var(--accent-app)`). The file's header comment (`:1-8`) is updated to remove "streak card" from the omitted set.
- **The ADR-0041 gate is widened by name, never loosened.** `conclusion-view.module.css` is on T-WEB-S73's `SHARED` list (`ink-on-accent.test.ts:181-185`), so both new `color: var(--accent-app)` declarations trip the `var(--accent[a-z-]*)` scan the moment they land. Per ADR-0041 decision 1's exception mechanism, `ALLOWED_ACCENT_TEXT` (`ink-on-accent.test.ts:200-203`) gains exactly two entries — `src/play/conclusion-view.module.css .streakCardNumeral` and `src/play/conclusion-view.module.css .streakCardLabel` — each documented with its measured figure: `--accent-app` #9E3B2F on `--paper-card` #FBF7EF (`packages/ui/tokens.css:5` — the card's own ground, unlike the hub stamp's desk paper) is **6.2980:1**, already recorded in ADR-0041 decision 1. The "keeps the allow-list non-vacuous" control (`ink-on-accent.test.ts:233-247`) is extended over the new entries — each named selector must exist in the conclusion sheet carrying `color: var(--accent-app)` and be present in the set, and the `ALLOWED_ACCENT_TEXT.size` assertion moves 2 → 4. ADR-0041 consequence (h)'s enumeration grows the matching rows via ADR-0048's Amends header (Appendix A) — a pinned enumeration is extended on the record, never silently outgrown.
- **Copy** — new keys under `messages.conclusion.streak` (shared chrome, exactly where runtime-composed conclusion strings must live: `ConclusionCopy` is plain-data-only, a function member is an SSR 500 — `apps/web/src/play/types.ts:73-83`; the client component imports `messages` directly, the `stampAria` precedent at `messages.ts:167-185`). Draft, Fernando owns final wording:

  ```ts
  streak: {
    value: (count: number) => `${count} ${count === 1 ? "dia" : "dias"} de sequência`,
    maintained: "mantida por hoje.",     // F5:56 — rendered only when todayCounts
    aria: (count: number) => `sequência de ${count} ${count === 1 ? "dia" : "dias"}`,
  },
  ```

  The italic tail renders **only when `todayCounts === true`** (D5): after a won on-time completion it is F5's sentence; on a lost-Termo day or a late solve the card shows the bare value — the streak may be alive through yesterday or another game, but *this* day did not maintain it, and the copy must not claim it did (ADR-0008 rules 1–3). "dias de sequência" keeps CONTEXT.md's word; the banned "dias seguidos" appears nowhere (the existing negative test `conclusion-view.test.tsx` keeps guarding it).
- **All four games get the card for free:** it lives in the shared `ConclusionView`, which every conclusion renders — including Termo's (`termo-conclusion.tsx` composes `ConclusionView`), where the lost case exercises the `todayCounts:false` copy path.
- The fetch module is **shared with the hub** — one `src/streak/` module pair, two consumers — which is precisely why §11's wall extension lands in the same commit.

---

## 10. PWA — manifest, icons, metadata

### 10.1 `apps/web/app/manifest.ts` (D11)

```ts
import type { MetadataRoute } from "next";
import { messages } from "../src/i18n";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.brand.wordmark,          // "Miolos" (messages.ts:16)
    short_name: messages.brand.wordmark,
    description: messages.meta.description, // messages.ts:94-95
    lang: "pt-BR",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: /* --paper-desk literal, comment citing packages/ui/tokens.css */,
    theme_color:      /* same token literal */,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

The two color literals are hex duplicated from `packages/ui/tokens.css` by necessity (a webmanifest cannot read CSS custom properties); T-WEB-S130 mechanically ties them back by asserting each literal appears in the tokens file, so a token change that forgets the manifest is a red test, not silent drift.

### 10.2 Icons (D12)

The file set, the render script and the swap path are D12's. The maskable variant insets the artwork to the safe zone; the design elements (paper ground, sealing-wax offset-shadow card, grid motif) come from `DESIGN.md`'s system and use only its recorded colors.

### 10.3 `layout.tsx` metadata additions

```ts
export const viewport: Viewport = { themeColor: /* the same token literal */ };
export const metadata: Metadata = {
  ...(existing three fields, untouched),
  appleWebApp: { capable: true, title: messages.brand.wordmark, statusBarStyle: "default" },
};
```

`app/icon.svg` and `app/apple-icon.png` are auto-linked by file convention — no `icons` metadata config needed. Nothing else in the layout changes; `next.config.ts` is untouched (its pin test stays green by construction).

### 10.4 What the manifest does *not* trigger

No `route-ssr.test.tsx` row, no `impeccable.yml` edit, no `BUDGETED` entry — argued in D11 and re-verified against the real build at step 8 (`route-client-js.mjs` iterates measured routes and budget-checks only its explicit `BUDGETED` list, `"/"` serving as the baseline at `:355`).

### 10.5 Tests

T-WEB-S130 (manifest: field values against `messages`, icon paths exist on disk, PNG IHDR width/height bytes match the declared `sizes`, maskable purpose present, color literals present in `tokens.css`) and T-WEB-S131 (layout exports: `viewport.themeColor` set, `appleWebApp` present, and — the D13 tripwire — no `serviceWorker` registration string anywhere in `app/` or `src/`, with the anti-vacuity control §13 specifies: the scanner first finds a known-present string in `layout.tsx`). PNG dimensions are read from bytes 16–23 of the IHDR chunk — no image dependency in the test.

### 10.6 What "installable" means at step 8

Machine half: the manifest unit tests plus a `curl`ed `/manifest.webmanifest` from `next start` showing the served JSON (evidence rule). Manual half (§14): Chrome DevTools → Application → Manifest showing "installability: passed" against the local production build, screenshot in the PR — the browser's own checker is the authority on its criteria.

---

## 11. The free-play wall extension

`eslint.config.mjs`:

- `freePlayBannedModuleGroups` gains one group:

  ```js
  {
    group: ["**/streak", "**/streak/**", "**/hub-streak"],
    message:
      "free play never touches the streak: the streak client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0048).",
  },
  ```

  `**/streak/**` covers both modules and anything the directory grows; **`**/streak` beside it closes the barrel gap** — minimatch-style `**/streak/**` does not match a bare `../streak` specifier, so without it a future `src/streak/index.ts` barrel would walk through the group; the shipped wall's own discipline lists both shapes (`@miolos/db` **and** `@miolos/db/*`, `eslint.config.mjs:240`). `**/hub-streak` closes the app-dir island (importable by relative path even though nothing should).
- `freePlayDynamicBannedModule`'s regex gains the `streak(\/|$)|hub-streak` alternatives — the dynamic-import residual, same one-regex design as shipped, with the `(\/|$)` anchoring mirroring the regex's own `^@miolos\/db(\/|$)` shape so a bare `import("../streak")` barrel specifier is caught too.
- Probes in `apps/web/test/eslint-free-play-wall.test.ts`, the suite's own discipline (every red probe beside a clean scope control): **T-LINT-S21** — static imports of `src/streak/streak-client`, `src/streak/use-streak`, `app/hub-streak` **and the bare `../streak` barrel form** red from a free-play fake path with the new message, the same specifiers **clean** from a daily path (`apps/web/src/binairo/x.ts`); **T-LINT-S22** — dynamic-import literal forms red from a free-play path, **the bare `import("../streak")` form included**, `import("./local")` clean. The flat-config replacement trap does not re-arise: the change edits the shared constants wall 3 already consumes, and the shipped replacement-regression probes (`T-LINT-S14`/`S15`) keep pinning that the object still repeats the app-wide walls.

The runtime instruments already in place close the non-transitivity residue exactly as before: the free-play zero-fetch sessions (`T-WEB-S115` ff.) would catch any unnamed door that reaches the network, and the keyspace assertion (`T-WEB-S117`) the local half — D7 adds no `localStorage` surface, so that instrument's claim is unchanged.

---

## 12. Gates, rituals and the baseline shift

Per CLAUDE.md, outputs pasted in the PR:

```
rm -rf apps/web/.next && pnpm typecheck   # ALWAYS the rm first (stale .next/types)
pnpm lint
pnpm test                                  # full suite
pnpm build
cd apps/web && pnpm bundle-check           # from apps/web, NOT the root (silent exit-0 trap)
npx impeccable detect "/" --viewport 1440x900          # repo root; each URL beside its
npx impeccable detect "/" --viewport 390x844           #   --no-config positive control
npx impeccable detect "/binairo/concluido" … (×4 concluido routes, both viewports)
```

Every node/pnpm/npx command behind `source ~/.nvm/nvm.sh && nvm use default >/dev/null`. Pre-commit (Husky + lint-staged + typecheck + tests) never bypassed. CI's `gate` job needs no workflow change; `impeccable.yml` is deliberately untouched (§10.4).

**The baseline shift, stated up front:** `/` is not budgeted — it is the **baseline** every other route's delta is measured against (`route-client-js.mjs:355`, `BUDGETED` list). `HubStreak` + the streak module add client JS to `/`, so every measured delta *shrinks* and the instrument gets less sensitive without failing anything. The PR must therefore include the **fresh measured table** (all routes, raw + gzip, delta vs the new baseline) with the before/after of `/`'s own first-load, and must not retune any budget to the new numbers — a budget is calibrated to intended content, and nothing here changes the intended content of any budgeted route. Expected magnitude: low single-digit KB (a fetch wrapper, a hook, one component; `streakResponseSchema` rides the already-shipped core contracts chunk). If measurement says otherwise, §16 risk 5.

`impeccable detect` runs on `/` (hub touched) and the four `/<jogo>/concluido` routes (conclusion touched) at both viewports; the clean profile scans the zero-state hub and the card-less conclusion (§8, §9) — the states these tests already pin as legitimate compositions. Zod validation at the new boundary: the route parses its response, the client parses what it receives, both against the same strict schema (D4). Property-based-test gate: §13's T-CORE properties at ≥100 runs (D10).

---

## 13. Test plan and reserved ids

Frontier at `0331185`, re-derived by grep before allocation and again at step 8 (`docs/agents/test-ids.md:26,34-40`): next free `T-CORE-S25`, `T-DB-S13`, `T-API-S46`, `T-WEB-S125`, `T-LINT-S21`. This plan reserves **T-CORE-S25…S34**, **T-DB-S13…S15**, **T-API-S46…S52**, **T-WEB-S125…S134**, **T-LINT-S21…S23** (contiguous; the tails are review-round headroom, burned if unspent per `test-ids.md:59-61`). `packages/games` gets no ids because it gets no changes. T-WEB ids go on `describe(...)` (the shipped `apps/web` convention, `test-ids.md:5`); T-LINT ids go on `it(...)` per the shipped `eslint-free-play-wall.test.ts` (`:63,89,111`); everywhere else ids go on `it(...)`.

**`packages/core/test/streak.test.ts`** (units) — ids on `it(...)`:

| Id | Assertion |
|---|---|
| T-CORE-S25 | Empty rows → `{streak: 0, todayCounts: false}`; a single on-time win today → `{1, true}` |
| T-CORE-S26 | Anchor semantics: run ending yesterday reads alive at full length with `todayCounts:false`; run ending two days ago reads 0 (D2, ADR-0048) |
| T-CORE-S27 | A `lost` row never counts: lost-on-time today → today not counted; a day whose ONLY row is a lost Termo is not a streak day and truncates the run — the #27-transferred obligation at the unit level (ADR-0008 rule 3) |
| T-CORE-S28 | `onTime:false` rows never count: a day of late wins only is a gap (ADR-0008 rules 1–2) |
| T-CORE-S29 | Robustness set: duplicate dates count once; reversed/shuffled input identical; future-dated rows ignored |

**`packages/core/test/streak-properties.test.ts`** (fast-check, `numRuns: 100` minimum on each — ADR-0023:34):

| Id | Property |
|---|---|
| T-CORE-S30 | Permutation invariance + determinism: any generated row multiset, any `today` — shuffled input and repeated calls agree |
| T-CORE-S31 | Monotone exclusions: inserting a `lost` row or an `onTime:false` row into any input never increases `streak` and never flips `todayCounts` to true; inserting an on-time won row never decreases `streak` |
| T-CORE-S32 | Constructive oracle: k generated consecutive on-time-won days ending at `today` (or at `today−1`) compute exactly `{streak: k, todayCounts: ends-at-today}` — the AC-5 arithmetic proved over the domain, not sampled at two days |
| T-CORE-S33 | Idempotent duplicates: re-inserting any already-present qualifying row changes nothing |
| S34 | Reserved headroom |

**`packages/db/test/completions.test.ts`** (or the file the reader lands beside; PGlite via `createTestDb`):

| Id | Assertion |
|---|---|
| T-DB-S13 | `listCompletionsForStreak` returns every row of the user — lost and late included (D3) — with `onTime` matching the SQL derivation (a row inserted with `completed_at` inside its SP day reads true; outside, false), ordered by date descending |
| T-DB-S14 | User scoping: another user's rows never appear (the first user-scoped read; this is the security assertion) |
| S15 | Reserved headroom. Plus, no id needed: the export-list tripwire in `test/user.test.ts` is edited to the widened surface in the same commit — the suite's own contract |

**`apps/api/test/streak.test.ts`** (seam-4: the real route handler over PGlite, `vi.mock("../src/db")`, the `completions.test.ts:36-90` architecture; history rows are manufactured by direct `db.insert(completions)` with explicit `completedAt` — `T15:00:00Z` = 12:00 SP keeps a row inside its own day — since `recordCompletion` rightly accepts no timestamp):

| Id | Assertion |
|---|---|
| T-API-S46 | No cookie / unknown cookie → 401 `no-session`; no user row is ever created (the never-mints property at the read) |
| T-API-S47 | Authenticated, no rows → 200 `{date: <DB-clock today>, streak: 0, todayCounts: false}`, response passes `streakResponseSchema` strict parse; `Cache-Control: no-store` and the credentialed CORS grant present |
| T-API-S48 | **The #27-transferred obligation, by name** (issue comment 5159949996), both halves at the seam: (a) *does not extend / day not counted* — a completion row with `outcome:'lost'` (written through the REAL `POST /completions` route with a six-guess losing Termo, the T-API-S39 shape) does not extend a streak, and a day whose only completion is a lost Termo does not count as a streak day — asserted via `GET /streak` before and after the loss, with a won-yesterday row proving the anchor skipped the lost day rather than the whole history; (b) *does not maintain* — `won` on D−2, on-time `lost` on D−1, nothing on D → `GET /streak` reads **0**, not 2: the run dies at the rollover only a lost row spans, proven at this seam rather than only at T-CORE-S27's unit level |
| T-API-S49 | **AC 5 at the seam:** an on-time Binairo completion on day D−1 then one on day D (manufactured `completed_at`s) reads streak 1 after the first and 2 after the second, `todayCounts: true` |
| T-API-S50 | A late row never counts end-to-end: a win for day D synced with `completed_at` in D+1 leaves D uncounted (ADR-0026 decision 7's window, observed at this seam); and the yesterday-alive case: run through D−1, nothing on D → streak intact, `todayCounts: false` |
| T-API-S51 | GET is the only export: the route module exports `GET` and nothing else (no `POST`, no `OPTIONS`) — pinning D6's no-OPTIONS decision as export-absence, the assertion the seam can actually make (handlers are imported directly there; Next's own 405 wiring never runs) |
| S52 | Reserved headroom |

**`apps/web/test/`** — ids on `describe(...)`:

| Id | File / Assertion |
|---|---|
| T-WEB-S125 | `hub-streak.test.tsx` (its `beforeEach` pairs `vi.stubEnv("NEXT_PUBLIC_API_URL", …)` with the fetch mock — the same mandatory pair as §8's `hoje.smoke` edit, or the env guard short-circuits and the mock is dead code): renders 0 with `aria(0)` before the fetch resolves; with `fetch` mocked to a valid `{streak: 12, …}` response, the numeral and `aria(12)` appear; a 401 or invalid body keeps the zero state; the request carries `credentials: "include"` |
| T-WEB-S126 | `streak-client.test.ts`: unset `NEXT_PUBLIC_API_URL` → loud `console.error`, no fetch call, `undefined` (the `bootstrap.ts` guard parity — this suite deliberately keeps the unset-env case); malformed 200 body → `undefined`, never a throw into the UI |
| T-WEB-S127 | `hoje.smoke.test.tsx`, beside T-WEB-S17: `renderToStaticMarkup(<HojePage/>)` calls neither storage, nor `Date.now`, **nor `fetch`** — the first-paint contract extended over the new island. Positive control in the same describe (the #28 convention): a client `render(<HubStreak/>)` with env + fetch stubbed asserts the same `fetch` spy **does** fire on mount, so the negative cannot go vacuously green |
| T-WEB-S128 | `conclusion-view.test.tsx` (or sibling): the streak card state machine — absent while `syncOutcome` is pending/rejected (offline answer); on recorded, the skeleton box renders at final dimensions then the value; a fetched `{streak: 0, todayCounts: false}` **renders the honest zero** (§9's default), never unmounts; fetch failure unmounts to absence; the fetch fires only after the gate opens (mock call-order assertion) |
| T-WEB-S129 | Conclusion copy honesty: `todayCounts:true` renders `messages.conclusion.streak.maintained`; `todayCounts:false` (the lost-Termo day) renders the bare value and never the tail; the fetched-zero card renders "0 dias de sequência" with no tail (§9); "dias seguidos" appears nowhere (the shipped negative, re-asserted over the new card) |
| T-WEB-S130 | `pwa-manifest.test.ts`: §10.5's manifest assertions |
| T-WEB-S131 | `pwa-manifest.test.ts`: §10.5's layout/metadata assertions + the no-service-worker tripwire. Anti-vacuity control: the scanner first finds a known-present string in `layout.tsx` (e.g. `metadataBase`, `layout.tsx:29`) before asserting the `serviceWorker` string's absence over `app/` and `src/`, so an empty or mis-globbed file walk cannot go silently green |
| S132–S134 | Reserved headroom |

**`apps/web/test/eslint-free-play-wall.test.ts`:** T-LINT-S21, T-LINT-S22 as specified in §11; S23 headroom.

**Existing tests knowingly edited (regression net, no new ids):** `hoje.smoke.test.tsx` `beforeEach` `stubEnv` + fetch-stub pair (§8); `ink-on-accent.test.ts` — `ALLOWED_ACCENT_TEXT` widened by name for the conclusion card's two declarations and the non-vacuity control extended over them, per §9's ADR-0041 idiom; `test/user.test.ts` export tripwire (§6); the comment blocks named in §1. Anything else red at step 5 is investigated as a finding, not silenced.

---

## 14. What cannot be verified in this environment

Stated per the evidence rule, with the honest substitute; the PR repeats this table.

| Cannot do here | Substitute, and who does the real thing |
|---|---|
| Real consecutive calendar days (AC 5's literal reading) | T-API-S49 manufactures the two days at the DB level against the real route and the real SQL derivation; T-CORE-S32 proves the arithmetic over the domain. The live two-day observation is Fernando's, after deploy, stated as such |
| A real browser install prompt / home-screen icon on iOS + Android | §10.6's DevTools installability screenshot against `next start`; store-grade verification happens on real devices post-merge |
| The production cookie topology (`COOKIE_DOMAIN=miolos.app`) | jsdom + seam tests exercise the cookie path; the D1 analysis of dev/preview/prod topologies is from `cookie.ts` source. Post-deploy smoke: load the production hub logged-streak state once, per the evidence rule |
| `impeccable detect` against the real Vercel preview | Local scans against `next start` with `--no-config` controls at step 8; CI's detect job runs on the preview after push |
| The streak card's populated visual state under the real gate | jsdom owns the populated state (T-WEB-S128/S129); the step-8 browser ritual plays a daily, watches the card arrive, screenshots it for the PR — the ADR-0031 consequence-(e) split |

---

## 15. What is deliberately NOT in this slice

- **The server day-truth payload / `readDayState` body replacement** — deferred with an ADR-0048 amendment to ADR-0031 decision 5 and a follow-up issue filed at step 8 (D4). The local reader remains the day-state source, exactly as shipped.
- **#58 implementation** — decided by Fernando (2026-08-02), not started, needs its own plan and ADR amendments. #19 is forward-compatible by construction (D2); the PR states this rather than re-asking.
- **Dia Perfeito** — #29's (CONTEXT.md:15; the issue's own scoping).
- **Statistics, histograms, best/average, the closing italic line** — #29. **Share** — #34. Their conclusion gaps stay documented in the updated `conclusion-view.tsx` comment.
- **Service worker, offline caching, push** — the push ticket's (D13).
- **The attach prompt at streak ≥ 5** (ADR-0003) — the first product *consumer* of the streak value beyond display; its own ticket. This slice makes it buildable, nothing more.
- **Archive (`/arquivo`) and stats (`/estatisticas`) routes** — their hub anchors stay href-less (`page.tsx:129-137`).
- **Medals** — do not exist in any form; no vacuous claims about them.
- **Widening `AdSlotPlacement` or any AdSlot change** — D14.
- **A `?date=` or history-returning streak endpoint** — #29/#31 territory; this endpoint answers exactly one question.

---

## 16. Deviation / risk register

Pre-agreed responses to what could force a change at step 5:

1. **`route-bundle-stats.json` grows a manifest-route entry with an unexpected shape** and `route-client-js.mjs` chokes or attributes oddly. Response: read the actual stats keys on the first build; the script's fail-closed attribution (unattributed → daily scope) and exit-2 sanity checks make a mismatch loud; adjust the script's route *reading*, never a marker's scope. Any such edit is to a **gate**: it preserves the fail-closed attribution and the exit-2 sanity checks intact — an accommodation of a new stats shape, never a loosened default.
2. **`sharp` fails to install** in this environment (native binary). Response: `@resvg/resvg-js`; same script contract, same committed outputs. If both fail, hand-render once via any local tool and commit, with the script left as the documented re-render path — the committed PNGs are the deliverable, the script is provenance.
3. **The conclusion card's mount shift** proves visually harsh in the browser ritual. Response: tune within the gate design (e.g. reserve the card's box from gate-open rather than fetch-start — the skeleton earlier, never a fake value); moving the card below the day card is the named fallback, recorded as a deviation from F5's order.
4. **React 19 strict-mode double effects** produce double GETs that trip a test's call-count assertion. Response: assert on rendered outcome, not call counts, except where the call itself is the subject (T-WEB-S128's ordering) — and there, tolerate ≤2 identical calls with a comment.
5. **`/`'s first-load grows more than low-single-digit KB** (something heavy rode into the island). Response: investigate the import graph before accepting — the streak island should touch `@miolos/core` contracts and nothing else new; a `@miolos/db` or games import in the client graph is a defect, not a budget question.
6. **A user with a very long history makes the unfiltered read heavy.** Not a v1 risk (bounded ≤4 rows/day), but the named escalation is a windowed read (`date >= today − N` with N safely above any plausible streak, e.g. 400 — chosen to keep the pure function the only *semantic* filter, the window being purely an optimisation with its own test proving window-vs-full equivalence). Trigger: measured latency, never speculation.
7. **The zero-state settle (`0 → N`) reads as broken** to Fernando in the PR. Response: it is D7's recorded trade; the alternatives (cached value; server-side read) are written down with their costs, and switching is a product call he can make with the ADR in front of him — non-blocking either way.

---

## 17. Commit and PR plan

One branch: **`feat/19-hoje-hub-streak-and-pwa-manifest`**. Commit sequence (each green under pre-commit):

1. `feat(core): computeStreak — the pure streak derivation with unit and property tests` — §5, D10's fast-check devDep, tests T-CORE-S25…S33.
2. `feat(db): listCompletionsForStreak on the user surface, tripwire widened` — §6, tests T-DB-S13/S14.
3. `feat(api): GET /streak — the first authenticated read` — §7 + the contract (§3 D4), tests T-API-S46…S51.
4. `feat(web): the hub streak goes live — client fetch, zero-state island` — §8, the wall extension §11 (the modules and their bans land together), tests T-WEB-S125…S127, T-LINT-S21/S22.
5. `feat(web): the conclusion streak card` — §9, new `messages.conclusion.streak` keys, the `ALLOWED_ACCENT_TEXT` widening + non-vacuity extension in `ink-on-accent.test.ts` (§9's ADR-0041 idiom, same commit as the declarations that need it), tests T-WEB-S128/S129.
6. `feat(web): PWA manifest, icons and install metadata` — §10, tests T-WEB-S130/S131.
7. `docs: ADR-0048, comment updates, test-id frontier` — Appendix A as a real file; the §1 comment updates; `docs/agents/test-ids.md` frontier re-derived by grep; the follow-up issue for the day-truth payload filed and cross-linked from ADR-0048.

**PR description** (per CLAUDE.md): what changed; every gate's real output inline (§12's list, including the fresh bundle table with the shifted `/` baseline called out); the §14 cannot-verify table with the manual-ritual screenshots; the step-8 `curl`ed manifest and installability evidence; AC 3's verification by citation of the existing green tests (D14). **#58's status stated in one sentence: decided by Fernando on 2026-08-02, not implemented, and #19 is forward-compatible with it by construction (the function consumes `onTime` as row data).** Closes #19.

Step 6 runs the standard parallel lenses (correctness, security — the first authenticated read deserves that lens's full attention, quality, performance, ADR/CONTEXT adherence, issue adherence); reviewers default to rejecting; dismissals in writing. Step 8 merges only on all-green with output shown.

### Decisions Fernando needs

**None blocking.** For the record:
- **#58:** already decided (2026-08-02); #19 implements nothing of it and is forward-compatible; its own plan and ADR amendments remain queued.
- Overridable in the PR without blocking: the anchor semantics (D2 — ADR-0048 records it; reversal is one comparison plus tests), the zero-state-over-cache choice (D7 / §16 risk 7), the conclusion card copy (§9 draft), **the fetched-zero conclusion card rendering the honest zero rather than suppressing at `streak === 0 && !todayCounts`** (§9; flipping is one condition plus the T-WEB-S128/S129 cases), **the manifest `name` copy** (§10.1 ships `messages.brand.wordmark` "Miolos" in both `name` and `short_name`; the fuller `messages.meta.title` "Miolos — quatro jogos por dia" in `name` is the conventional install-surface copy, with `short_name` staying "Miolos" — a one-line swap), and the icon artwork (D12 — a Nano Banana swap is a re-render away).

---

## 18. Exit criteria

| Claim | Discharged by |
|---|---|
| All five ACs met with machine-checkable evidence, plus the issue-body conclusion clause | §0's mapping; §13's suites; §12's gate outputs in the PR |
| The #27-transferred obligation discharged at the `apps/api` seam, by name | T-API-S48, cited against issue comment 5159949996 in the PR |
| `pnpm typecheck` / `lint` / `test` / `build` / `bundle-check` green, outputs pasted; fresh bundle table with the `/` baseline shift stated | §12 |
| `impeccable detect` green on `/` and the four conclusion routes, both viewports, `--no-config` control beside each | §12 |
| ADR-0048 exists; ADR-0031 decision 5's amendment is recorded reciprocally; the day-truth follow-up issue exists | §17 commit 7 |
| The free-play wall provably covers the streak surface | T-LINT-S21/S22 red-beside-control |
| `test-ids.md` frontier re-derived by grep at step 8 | §17 commit 7 |
| Step-6 review closes on an empty blocking pass, dismissals written down | §17 |

---

## Appendix A — Draft ADR-0048 (to be created as `docs/adr/0048-the-streak-is-a-client-fetched-server-computed-value.md`)

Status convention: every ADR in `docs/adr/` ships as "Accepted — date". The draft below says "Proposed" because the plan predates acceptance; the real file created at step 5 carries **"Accepted — \<merge date\>"** per the directory's convention — Fernando's merge of the PR is the acceptance.

```markdown
# ADR-0048 — The streak is a client-fetched, server-computed value, alive until the rollover

**Status:** Proposed — 2026-08-12 (issue #19)
**Depends on:** ADR-0008, ADR-0009, ADR-0014, ADR-0022, ADR-0026, ADR-0031
**Amends:** [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) —
decision 5's *"#19 replaces `readDayState`'s body and nothing else"* is narrowed:
#19 ships the streak (the value that decision 3 deferred) and does NOT replace
`readDayState`'s body; the server day-truth payload and the local reader's
body-replacement move to a dedicated follow-up issue. The local reader, its
callers and the offline-fallback rule are unchanged.
Also amends [ADR-0041](./0041-accents-colour-shapes-never-words.md)
consequence (h) — its enumeration of surviving accent-text declarations
("thirteen … this table is the thing to recompute rather than trust") grows
by two rows for the conclusion streak card, and `ink-on-accent.test.ts`'s
`ALLOWED_ACCENT_TEXT` widens by the same two names (decision 1's exception
mechanism, exercised rather than bypassed):

| # | site | value | on | ratio |
|---|---|---|---|---|
| 14 | `play/conclusion-view.module.css` `.streakCardNumeral` | `--accent-app` | `--paper-card` | **6.2980:1** |
| 15 | `play/conclusion-view.module.css` `.streakCardLabel` | `--accent-app` | `--paper-card` | **6.2980:1** |

Both figures are ADR-0041 decision 1's own recorded measurement of
`--accent-app` #9E3B2F on `--paper-card` #FBF7EF.

## Context

ADR-0009 mandates the streak be a pure function over completion rows in
`packages/core`; ADR-0014 routes every user-specific read through `apps/api`;
ADR-0031 deferred the value to #19. Three things remained open: how the value
reaches a hub that is a synchronous server component with a client-minted,
host-only-outside-production session cookie; what the pure function's inputs
are, given #58's decided-but-unimplemented direction (on-time judged once at
write time, stored on the row); and what a streak reads on a morning where
yesterday's run is intact but today is unplayed — a case ADR-0008 defines no
display semantics for.

## Decision

1. **`computeStreak(rows, today)` in `packages/core`:** rows carry
   `{date, outcome, onTime}`; `today` is the DB clock's SP date supplied by
   the caller. The function consumes `onTime` as row data and never
   recomputes it from a timestamp — forward-compatible with #58, whose only
   effect here is changing the field's producer. A day counts iff it has ≥1
   row with `outcome = 'won'` and `onTime = true`; a `lost` row never counts,
   on time or not (ADR-0008 rule 3).
2. **Alive until the rollover:** the streak is the maximal run of consecutive
   counted days ending at `today` or `today − 1`. A run ending yesterday
   reads at full length until today's rollover passes unplayed. The function
   also answers `todayCounts`, so copy can distinguish "maintained today"
   from "alive from yesterday" honestly. CONTEXT.md's Streak row is
   **unchanged** by this reading — it defines the counted set (consecutive
   days with ≥ 1 on-time completion); this ADR defines the read anchor.
3. **`GET /streak` on `apps/api` is the delivery path** — the repo's first
   authenticated read: cookie → `requireUserId` (never mints), rows via an
   unfiltered `@miolos/db/user` reader (the pure function is the only
   filter, so the seam exercises the authority), `today` via
   `todaySaoPaulo(db)`. Strict contract `{date, streak, todayCounts}`,
   parsed on both ends; `Cache-Control: no-store`; no OPTIONS handler — a
   credentialed GET without custom headers never preflights. Future payload
   growth is a NEW endpoint/contract, never fields appended to a strict
   schema deployed clients parse.
4. **The client fetches it with `credentials: "include"` from client
   components**; the server renders the zero state and hydration only ever
   raises the number. No `localStorage` cache: a stale server number
   presented as current is wrong in both directions, while zero is the
   honest unknown of a value the client can never compute (ADR-0031
   decision 6). The conclusion's card additionally gates on the day being
   on the server (`syncOutcome === "recorded"`), so its number includes the
   day it decorates; unfetched and offline states render the card absent,
   as shipped, while a fetched zero (a late win or lost-only day with no
   prior history) renders honestly — it is real server data, not the fake
   zero the pre-#19 conclusion refused to invent.

## Rejected

- **A server-side cookie read + fetch in `apps/web`:** not for preview
  parity — on `*.vercel.app` previews EVERY credentialed call is anonymous
  either way (the cookie is `SameSite=Lax` and `vercel.app` is on the
  Public Suffix List, so preview web→api is cross-site and the Lax cookie
  neither travels nor sets; both paths degrade to the honest zero state
  there). Rejected on the real discriminators: it forces the hub async
  (the smoke-suite constraint), and a browser fetch is the only shipped
  precedent for calling `apps/api`.
- **Widening `completionResponseSchema`:** strict on both ends; and the hub
  needs the streak without a completion in flight.
- **Streak reads as 0 until today's first completion:** matches ADR-0008's
  letter and breaks the product every morning — the number the player
  returns for would be gone at the moment of return.
- **Caching the last-known value on the device:** see decision 4.
- **SQL-filtering the reader to won/on-time rows:** leaves the core
  function's exclusions untestable at the seam and creates a second streak
  definition.

## Consequences

- The merge (ADR-0009), nightly checks and support tooling reuse
  `computeStreak` unchanged — the route is just its first caller.
- #58, when implemented, changes the producer of `onTime` and nothing in
  this ADR.
- Free play's wall extends over the streak modules (ADR-0046's consequence,
  kept true by growth).
- The attach prompt (streak ≥ 5, ADR-0003) has a real value to read; its
  ticket owns the prompt.
- The morning hub shows yesterday's live run with `todayCounts: false` —
  the streak-at-risk push, when it ships, warns about exactly the state
  this ADR makes representable.
```
