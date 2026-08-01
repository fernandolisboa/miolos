# Implementation plan — Issue #18: Play the daily Binairo

Step 2 (Plan) of the eight-step flow, reviewed at step 3 and amended at step 4 (dispositions at the bottom, §20). Point-in-time snapshot, planned against `origin/main` = 93b1a85; all paths are working-tree paths. Branch `feat/18-play-the-daily-binairo` is already checked out and correct.

---

## 0. Acceptance criteria → plan mapping

| # | AC (quoted from issue #18) | Build step (§17) | Where satisfied | Tests (§15) |
|---|---|---|---|---|
| 1 | "Today's puzzle is fetched only through the published-predicate helper; no future puzzle content in any response, RSC payload or prefetch" | 5A | §5 (data flow + the six-vector leak audit), §4 D4/D5/D32 | T-WEB-1..4b, T-WEB-23, T-API-1, T-API-8, T-API-9, T-API-12, T-DB-10 |
| 2 | "Completion recorded exactly once (a replay never reopens it); on-time vs late derivation covered at the `apps/api` seam with faked time" | 2, 3, 4 | §7 route + §6.2 DDL (composite PK + `ON CONFLICT DO NOTHING`), §7.3 step 4 idempotent short-circuit, §7.4 derivation | T-CORE-1..3, T-API-2..T-API-16, T-DB-11..T-DB-15 |
| 3 | "Mid-puzzle offline play keeps working; the completion syncs on reconnect" | 5B, 6 | §9 (record-is-the-queue, incl. the persisted solved `grid`), §8 (all play state client-side, engine bundled), D26 (the conclusion renders in place — no navigation, so no network), D28 | T-WEB-9b..9d, T-WEB-12..T-WEB-16b |
| 4 | "One free hint works; the day-scoped hint-grant schema exists, dormant, expiring at `America/Sao_Paulo` rollover" | 3, 5B, 6 | §10 (client-computed hint, `hints_used` on the completion), §11 (`hint_grants` DDL + dormant day-scoped reader) | T-WEB-9, T-WEB-10, T-WEB-11, T-DB-16..T-DB-21 |
| 5 | "Binairo and Conclusao screens match the reference frames and pass `npx impeccable detect`; rules blurb present; timer is count-up and discreet" | 0, 6 | §12 (component trees + token mapping + the recorded frame deviations), §12.7 (impeccable), §16 E-steps | T-WEB-5..T-WEB-9c, T-WEB-14, T-WEB-17..T-WEB-21 |
| 6 | "All strings pt-BR and externalized" | 5B | §13 (the complete `messages` diff) | every web test asserts through `messages.*`, never a literal: T-WEB-5..T-WEB-22 |
| — | Issue comment (ADR-0024 amendment): the two-part apps/web ESLint duty | 5C | §14 (both rules verbatim, with the source/test split the amendment's own wording requires) | T-LINT-1..T-LINT-8 |

Every AC maps to at least one numbered build step in §17 and at least one named test in §15.

---

## 1. Scope boundary, stated once

**In:** the `/binairo` play screen, the `/binairo/concluido` conclusion screen, the completion write at the `apps/api` seam, the `completions` + `hint_grants` tables and migration, one free hint, offline-tolerant play with deferred sync, the Hoje CTA wired to the real route, the apps/web ESLint wall, three ADRs.

**Out, explicitly, each with the issue that owns it:**

| Out of scope | Owner |
|---|---|
| Streak display and arithmetic | **#19** (Hoje hub, streak, PWA manifest) + **#20** (account-merge recompute) |
| PWA manifest and installability (ADR-0001 puts it in M1) | **#19** |
| Service worker / offline shell | **M3** (ADR-0001 pairs it with push, **#32**) |
| Personal best, 30-day average, solved count, 6-bucket histogram, closing italic line | **#29** (Stats, calendar, Dia Perfeito) |
| Share card / "Compartilhar resultado" | **#34** (Sharing) |
| Archive route (`/arquivo/…`, ADR-0013) | **#31** (Archive of past dailies) |
| Free play | **#28** (Free play on the grid games) |
| Rewarded-ad hint grants (schema ships dormant here) | a future monetization ticket; no issue exists yet — ADR-0027 names the seam |
| `nextBinairoDeduction` in `packages/games` | surfaced and deferred, §10.4; follow-up issue filed in step 8 |
| Undo (§8.5), dark mode, telemetry (**#33**), any ads SDK or new `AdSlot` placement | — |

**Never:** on-demand puzzle generation, a client-supplied completion instant, a stored `on_time` authority, a hint balance.

---

## 2. Read first (in this order)

1. `docs/adr/0004`, `0006`, `0008`, `0013`, `0014`, `0018`, `0019`, `0020`, `0022`, `0024` (including its 2026-07-31 amendment).
2. `packages/db/src/published.ts` — the whole wall, 100 lines.
3. `packages/core/src/contracts/daily.ts` — the strip table TSDoc is the contract this plan extends.
4. `apps/api/app/session/route.ts` + `apps/api/src/session/service.ts` — the auth idiom copied in §7.
5. `apps/web/app/page.tsx` + `app/page.module.css` + `src/i18n/messages.ts` — the shipped house style every new screen imitates.
6. `docs/design/006-handoff-design-winner-atelie/f3..f6*.dc.html` — open in a browser with `support.js` beside them. Visual specs, **never shipped**.

---

## 3. Fixed orchestrator conventions (recorded, not re-litigable here)

- Shell preamble on every command: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …`.
- `packages/games` stays pure: zero Node, zero React, no `vitest.config.ts` (ADR-0017/0023). **This ticket adds nothing to `packages/games`.**
- `packages/ui` holds tokens and values only — no JSX (ADR-0002). Every component in this ticket lives in `apps/web`.
- **No new fast-check anywhere.** ADR-0017 scopes fast-check to `packages/games`; this ticket introduces no property test and no new test dependency (§15, T-WEB-11 is table-driven).
- Turbo evidence is always `--force`; captured exit codes, never prose.
- Plan number **017**, ADR numbers **0026/0027/0028** reserved (§18). The `docs/README.md` "Current" row ships in the same commit as this file.

---

## 4. Fixed decisions (with rationale, one line each)

- **D1 — Play route is `/binairo`; conclusion is `/binairo/concluido`.** Game names are proper product nouns (`CONTEXT.md` keeps them untranslated); `concluido` is the pt-BR segment (ADR-0013). The conclusion is a real sub-route as well as an in-place state (D26): a route is reloadable, bookmarkable, back-button-honest, and the only shape `impeccable detect` (which takes URLs) can scan at all. → **ADR-0028**.
- **D2 — Slugs and paths are externalized.** `routeSlugs` gains `binairo`/`conclusion`; a new `routes` object composes literal path strings so Next 16 typed routes accept them (§13.2). Both are re-exported from the `src/i18n` barrel (ADR-0018's single import surface).
- **D3 — apps/web reads the database directly** through `getTodayDaily` from the `@miolos/db` **root** entry, in an async server component. This is a **deliberate widening of ADR-0014**, not its literal scope: ADR-0014 sanctions "public, unauthenticated, **cacheable** server-rendered reads", and `/binairo` is public, unauthenticated and non-user-specific but `force-dynamic` and interactive. The widening is one hop instead of two on the ritual's critical path, and it keeps ADR-0004's guarantee at one enforcement point (the helper) rather than two. Recorded as an explicit ADR-0014 scope extension in **ADR-0028**, together with the fact that `apps/web` now holds a `DATABASE_URL` — served by a **distinct least-privilege Neon role** (§5.3, E1). The old justification "it triggers the ADR-0024 ESLint duty as designed" is withdrawn: engineering a dependency to justify a lint rule is not a technical argument, and ADR-0024 names the duty for `apps/web` regardless.
- **D4 — The RSC boundary carries only `DailyPuzzleResponse`.** The server component passes `{ game, date, size, givens }` and nothing else into the client tree. The wall already stripped inside itself, so the page physically cannot serialize a solution (ADR-0024 §3). Enforced by a leak-scan test on the rendered payload.
- **D5 — `export const dynamic = "force-dynamic"` on both route segments**, no `revalidate`, no `generateStaticParams`, no `fetch` (hence no fetch cache). Both `page.tsx` files are **server components**; the route-segment export is only meaningful on a server segment. §5.2 enumerates all six leak vectors and closes each.
- **D6 — The gameplay client is one reducer over one immutable state value.** Pure reducer in `src/binairo/state.ts`, no React; the hook is a thin `useReducer` wrapper. Most of the gameplay test surface is therefore plain unit tests, no jsdom.
- **D7 — Cell cycle is `empty → 0 → 1 → empty`** (the frames' README, verbatim). Givens never cycle.
- **D8 — `0`/`1`/`apagar` set a sticky paint mode**, toggling back to cycle mode when re-pressed. In paint mode a tap sets the value (and clears it if the cell already holds it); a pointer drag paints. In cycle mode a drag does nothing — cycling on drag is chaos.
- **D9 — No undo.** Not in the ACs, not in the frames; tap-to-cycle plus `apagar` already reaches every state. Recorded as out of scope rather than silently missing.
- **D10 — Timer starts on mount, pauses on `visibilitychange → hidden` and `pagehide`, resumes on `visible` and on `pageshow`.** Value is `accumulatedMs + (runningSince === null ? 0 : now - runningSince)` so no tick can drift. `pause` and `resume` are **idempotent** (§8.3). Elapsed time is a *statistic*, never a date: it never enters streak arithmetic, which stays server-side (CLAUDE.md invariant).
- **D11 — Local validation is `findBinairoViolations` on every entry change** (measured 10–22 µs — no debounce), rendered as a cell state. It never blocks entry and never decides anything server-side (ADR-0004: "a responsiveness affordance, never a source of truth").
- **D12 — Local completion detection is exact, not approximate**: `isSolvedGrid(merged) && isValidBinairoSolution(merged)`, where `isSolvedGrid` is a local type guard narrowing `BinairoGrid → BinairoSolvedGrid` (§8.1). The daily is uniquely solvable by construction (ADR-0020/0023), so a complete rule-valid grid *is* the solution. The server still re-judges against the stored solution — the client's belief only decides what the UI shows.
- **D13 — In-progress state persists to `localStorage`, one record per (game, date), keyed by the *server's* date string.** Zod-parsed on read (user-editable input is untrusted). Never a source of truth: streaks, statistics and the completion instant all come from the server. ADR-0001's follow-up already places in-flight state here.
- **D14 — Completion is `POST /completions` on `apps/api`** — game-generic so #23/#25/#27 reuse it — authenticated by the existing opaque session cookie, judged against `getPublishedDailyWithSolution` **only** (the second named ADR-0024 duty).
- **D15 — Exactly-once is the composite primary key `(user_id, game, date)` plus `ON CONFLICT DO NOTHING`.** Never `DO UPDATE`: an upsert would bump `completed_at` and silently convert an on-time completion into a late one. The route short-circuits on an existing row **before** it reads the wall or judges the grid (§7.3 step 4), so a replay returns **200** with `recorded: false` and the **stored** row's values — an idempotent retry must look like success to the offline queue, so 409 is wrong.
- **D16 — `on_time` is derived in SQL, never stored**: `(completed_at at time zone 'America/Sao_Paulo')::date = date`. ADR-0009 recomputes streaks from these rows, so the derivation must stay the definition. No JS tz math exists anywhere in the path.
- **D17 — User-scoped tables live on a new `@miolos/db/user` subpath.** Root `@miolos/db` stays exactly as it is (T-DB-9b and T-DB-9d untouched), so apps/web — which now holds the db dependency — cannot even *name* `completions` or `hint_grants` through the entry it is allowed to import. The lesson from PR #54's blocking finding applied to the new write surface: make it mechanical, not conventional. → **ADR-0026**.
- **D18 — The local play record *is* the sync queue.** There is exactly one pending item per (game, date), and its natural key is the same key that makes the POST idempotent. No second store. The record carries the solved merged `grid`, so the flush needs no givens and no mounted play screen (§9.1).
- **D19 — A completion synced after the SP rollover derives as late.** `completed_at` is the server write instant; letting the client assert its finish time would put the client clock into streak arithmetic, which CLAUDE.md forbids outright. **This contradicts issue #18's "a connection drop mid-puzzle never costs the day" and is escalated to Fernando as a real decision (§16 "Decisions needed from Fernando"), not accepted silently.** The plan implements D19 as written pending his call.
- **D20 — The hint is computed on the client** with `solveBinairo(givens)` from `@miolos/games/binairo`. The published puzzle's solution is recoverable from its givens in ~0.1 ms because it is uniquely solvable — withholding `solution` protects *unpublished* content (ADR-0004's actual scope) and casual devtools reads, and can never protect today's published board. Server-side computation would buy no confidentiality and would break the hint offline, which AC 3 makes a requirement. → **ADR-0027**.
- **D21 — The free hint is not a grant.** It is per-puzzle, tracked in the local record and recorded server-side as `completions.hints_used`. Modelling it as "a grant of 1" would reintroduce exactly the balance ADR-0006 forbids.
- **D22 — `hint_grants` is append-only and day-scoped**, with a surrogate id: `grantedHintsToday` = `sum(hints) where user_id = ? and date = (now() at time zone 'America/Sao_Paulo')::date`. Nothing decrements, nothing carries over — the date key *is* the expiry, so no job and no TTL column. Dormant: no v1 writer exists (no ads SDK ships in v1). **Consumption of a *granted* hint is deliberately unrepresented in v1** (§11) — the reader is named for what it computes, and ADR-0027 names the seam the rewarded-ad ticket must add.
- **D23 — No `AdSlot` on either screen.** The frames draw none; `packages/ui/src/ad-slot-placements.ts` and its exactly-two-keys test stay untouched. Adding a game-screen placement is a design decision nobody has made.
- **D24 — `packages/ui` is unchanged**, and `apps/web/src/types/css.d.ts` is unchanged (no new inline custom property is needed; media queries and CSS grid areas own the geometry).
- **D25 — `isCrossSiteMint` is renamed to `isCrossSiteWrite`**, and `warnIfGuardDegraded` moves out of `app/session/route.ts` into `src/session/origin-guard.ts` and is **exported**. The completion POST reuses the same positive-evidence guard, and ADR-0022 requires the loud once-per-instance misconfiguration signal from every route that depends on it — a degraded guard on `/completions` means a forged, unreopenable write, which is strictly worse than a degraded `/session`.

### New decisions taken at step 4

- **D26 — The conclusion renders in place on `/binairo` when `status === "solved"`; `/binairo/concluido` is the bookmarkable, scannable equivalent.** `BinairoScreen` swaps its body from `<PlayView/>` to `<ConclusionView/>` — no `router.push`, no RSC fetch, so **finishing while offline works with no service worker** (AC 3). `/binairo/concluido` is a separate async server component that resolves the same SP day from the wall and renders the same `<ConclusionView/>`; it is what a bookmark, a reload and `impeccable detect` reach. This closes the transition question, the offline-navigation question and the hydration question in one shape.
- **D27 — Both `page.tsx` files are async server components; the SP day always comes from the DB clock.** `/binairo/concluido` calls `getTodayDaily(db, "binairo")` and passes `daily.date` into the `"use client"` `<ConclusionView date={…}/>`. The client clock never selects which record is read (CONTEXT.md **Rollover**). When `getTodayDaily` returns `undefined` (no puzzle, or killed), the conclusion route renders `<DailyUnavailable/>` — the same pt-BR screen `/binairo` uses — because with no server day there is no record to look up.
- **D28 — Nothing reads `localStorage` or `Date.now()` during render.** `PlayState` carries `hydrated: boolean`, false in the server snapshot. First paint is deterministic: givens-only grid, `00:00`, no record-derived content, and on `/binairo/concluido` a skeleton card — never the "ainda não concluído" card, which would flash and then swap. A mount `useEffect` dispatches `{ type: "restore", record }` and starts the clock. `now` lives in state, updated by the `tick` interval, never read during render.
- **D29 — The route bounds the accepted date to SP-today or SP-yesterday.** `getPublishedDailyWithSolution` has no lower bound, so without this any client could write a `won` completion for every past daily — permanently, since D15 never reopens a row — and a stale `localStorage` record would flush as a completion the player never played. One day of slack preserves D19's post-rollover flush. **EXTENSION POINT:** #31 (archive) widens this deliberately, with its own tests and its own `late` semantics (ADR-0008).
- **D30 — `POST /completions` requires `Content-Type: application/json` (415 otherwise), before the body is read.** That forces a CORS preflight on every cross-origin attempt, so the `WEB_ORIGIN` grant becomes load-bearing rather than the origin guard alone. Under `COOKIE_DOMAIN=miolos.app` a sibling subdomain sends `Sec-Fetch-Site: same-site`, which the guard deliberately allows (ADR-0022); a `text/plain` simple request would otherwise reach an unreopenable write.
- **D31 — Every response from `/completions` carries `corsHeaders({ credentials: true })`**, including 403/401/400/404/415/422. For a credentialed cross-origin fetch a response without those headers is unreadable to JS — the promise rejects with a `TypeError` indistinguishable from being offline — and on this route **the status *is* the queue's control flow** (§9.2). `/session` gets away with it because an unreadable error there is harmless.
- **D32 — `apps/web/src/db.ts` carries `import "server-only";` as its first line.** Three ESLint bans and four export tripwires are compile-time walls; a `"use client"` module importing `../db` would walk around all of them. `server-only` turns that into a build error. Pinned by a source tripwire (T-WEB-23) that reads the file as text rather than executing it.
- **D33 — No PGlite in `apps/web`.** `apps/web/vitest.config.ts` forces `environment: "jsdom"` for every file and `createTestDb()` needs Node (`node:url` + a disk migration replay). Re-proving the wall from `apps/web` also proves nothing about `apps/web`: the wall's behaviour is already pinned by `packages/db/test/published.test.ts` and by T-API-8/T-API-9. T-WEB-3/T-WEB-4 use `vi.mock("@miolos/db")`. Consequence: apps/web tests never need `@miolos/db/publishing`, `sql`/`eq` or a `daily_puzzles` literal, so §14's import bans stay **absolute** across `apps/web/**`.

---

## 5. Data flow for today's puzzle, and the ADR-0004 audit

### 5.1 The path

```
apps/web/app/binairo/page.tsx        (server component, force-dynamic)
  └ getDb()                          apps/web/src/db.ts — the mock seam, twin of apps/api/src/db.ts
  └ getTodayDaily(db, "binairo")     @miolos/db ROOT entry — the published-predicate helper (AC 1)
       ├ undefined  → <DailyUnavailable />        (the pt-BR 404 copy #18 owns, plan 014 D13)
       └ daily      → <BinairoScreen daily={daily} />   ("use client")

apps/web/app/binairo/concluido/page.tsx   (server component, force-dynamic)   [D27]
  └ getTodayDaily(db, "binairo")
       ├ undefined  → <DailyUnavailable />
       └ daily      → <ConclusionView date={daily.date} />   ("use client")
```

`apps/web/src/db.ts`, verbatim twin of `apps/api/src/db.ts` (ADR-0002 forbids a shared home for these) plus the `server-only` guard (D32):

```ts
// ADR-0014 (as extended by ADR-0028): this module holds the web app's
// database credential. It must never be reachable from a client bundle —
// `server-only` makes that a build error rather than a review duty.
import "server-only";

import { createDb, type Db } from "@miolos/db";

/** Per-request client, deliberately uncached — and the single mock seam for tests. */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createDb(url);
}
```

If `pnpm typecheck` cannot resolve `server-only` (it ships no `.d.ts`), add `declare module "server-only";` to `apps/web/src/types/server-only.d.ts` — a one-line, named fallback, not an implementer's choice.

**What apps/web may import from `@miolos/db`:** `createDb`, `type Db`, `getTodayDaily`, `SAO_PAULO_TIME_ZONE`, `type DailyPuzzleResponse`. Nothing else on that barrel has a use here; `sql` and `eq` are additionally banned by name (§14 rule 3) because they are the raw-SQL residual the ADR-0024 amendment names.

### 5.2 Every vector a future-dated puzzle could leak, and how each is closed

| Vector | Closed by |
|---|---|
| **RSC payload** — Flight serializes every prop crossing into a client component, including values never rendered | D4: the only value that crosses is `DailyPuzzleResponse`, already stripped **inside** the wall by `stripDailyContent` (allowlist pick, strict Zod). The page never holds a row. Test T-WEB-3 scans the rendered markup for `FORBIDDEN_DAILY_KEYS` |
| **Route prefetch** — `<Link>` prefetches RSC payloads, not just shells | There is no date-parameterized route in this ticket. `/binairo` and `/binairo/concluido` are today-only; a prefetch can only ever fetch today's published content, which ADR-0004 permits explicitly. The archive route arrives with #31 and inherits `getPublishedDaily`'s predicate |
| **`generateStaticParams`** | Not used; no dynamic segment exists. A future archive ticket must never enumerate future dates — recorded in ADR-0028 |
| **ISR / `revalidate` / static caching** | D5: `dynamic = "force-dynamic"` on both route segments, asserted as data by T-WEB-1/T-WEB-2 (the `daily-binairo.test.ts` precedent) |
| **`fetch` cache** | No `fetch` exists on the server path at all (D3 reads the db directly) |
| **Client bundle** | `@miolos/games/binairo` ships the **solver**, never a solution. `solveBinairo(givens)` recovers today's board client-side in ~0.1 ms — stated plainly in ADR-0027 so no future reviewer builds a confidentiality argument on the payload strip. Unpublished boards are unreachable: the client never receives their givens |
| **The db handle itself** | Root `createDb` is narrowed to `{users, sessions}` (T-DB-9d), the root barrel exports no table object and no `…WithSolution` (T-DB-9b), §14's ESLint rules ban `@miolos/db/publishing`, `@miolos/db/user`, `@miolos/db/testing`, the `sql`/`eq` re-exports and the table-name string literals inside `apps/web`, `server-only` keeps `src/db.ts` off the client graph (D32), and the web role's Neon grants are `SELECT` on `daily_puzzles` only (§5.3) |

### 5.3 Wiring cost of D3 (all of it)

- `apps/web/package.json` → `dependencies`: `"@miolos/db": "workspace:*"`, `"@miolos/games": "workspace:*"`, `"server-only": "0.0.1"`, `"zod": "4.4.3"` (byte-identical to `packages/core`'s pin so exactly one zod is installed; `playRecordSchema` in §9.1 needs it and pnpm's isolated linker will not resolve it transitively through `@miolos/core`); `devDependencies`: `"eslint": "10.8.0"` and `"typescript-eslint": "<root pin>"` (both for T-LINT — the ESLint Node API and `tseslint.configs.disableTypeChecked` are both imported by the probe test, and the isolated linker will not resolve a root devDep from a workspace).
- `apps/web/next.config.ts` → `transpilePackages: ["@miolos/ui", "@miolos/core", "@miolos/db", "@miolos/games"]`. `apps/web/test/next-config.test.ts` pins only the headers — **verified, no update needed**.
- `apps/web/.env.example` → `DATABASE_URL=postgresql://...` with the ADR-0014/ADR-0028 comment ("public published reads only, least-privilege role; anything user-specific goes through apps/api").
- `turbo.json` → `tasks.build.env` already lists `DATABASE_URL`. **No change.** (turbo runs in `envMode: strict`; verify with `turbo run build --dry=json` if anything new appears.)
- **Neon: a distinct least-privilege role for the web app — DEFERRED TO A FOLLOW-UP ISSUE** (amended at step 5; see §20's orchestrator-amendments subsection for the reasoning and the audit trail). The rationale and the SQL stand as written and are the follow-up's specification, not this PR's work. The web project should not hold the credential that can `select token_hash from sessions` or write `completions`:
  ```sql
  create role miolos_web login password '<generated>';
  grant usage on schema public to miolos_web;
  grant select on daily_puzzles to miolos_web;
  -- nothing else: no sessions, no users, no completions, no hint_grants,
  -- no insert/update/delete anywhere.
  ```
  Its pooled connection string would be what `miolos-web` gets as `DATABASE_URL`. **What this PR ships is one enforcement point, not two:** the module-graph wall (the narrowed root `@miolos/db` entry, the §14 ESLint bans, `server-only` in `src/db.ts`). The database grant is the *second*, independent one, and until the follow-up lands **ADR-0026 must not claim it exists** — a defence-in-depth claim that reads as true while being false is worse than no claim. `DATABASE_URL` is already present on `miolos-web` across Production, Preview and Development (it arrived with the Neon–Vercel integration alongside `POSTGRES_*`/`PG*`/`NEON_*`), so nothing here blocks `/binairo` from rendering on the preview.
- A second app now holds Neon connections (ADR-0014 flags this); both use the serverless HTTP driver, so the budget impact is per-request, not pooled sockets.

---

## 6. `packages/db` changes

### 6.1 New entry `src/user.ts` (D17) and `package.json#exports`

```json
"exports": {
  ".":           "./src/index.ts",
  "./publishing":"./src/publishing.ts",
  "./testing":   "./src/testing.ts",
  "./user":      "./src/user.ts"
}
```

```ts
/**
 * User-scoped surface (ADR-0026, plan 017 D17). Completions and hint
 * grants carry no puzzle content, so they are not behind the ADR-0004
 * wall — but every write and every user-specific read belongs to
 * apps/api without exception (ADR-0007/ADR-0014). Keeping them off the
 * root entry makes that mechanical: apps/web imports `@miolos/db` and
 * therefore cannot name these tables at all.
 *
 * The export list below is pinned exactly by the tripwire in
 * test/user.test.ts — widening this surface fails the suite.
 */
export {
  getCompletion,
  grantedHintsToday,        // DORMANT (D22) — no v1 writer; see ADR-0027
  grantHints,               // DORMANT (D22)
  recordCompletion,
  type CompletionRecord,
} from "./completions";
export { completions, hintGrants } from "./schema";
```

### 6.2 `src/schema.ts` — two new tables (house TSDoc style, citing the ADRs and this plan)

```ts
/**
 * Completion rows (ADR-0008, ADR-0026). One row per (user, puzzle),
 * written ONCE — a loss followed by an archive replay does not reopen the
 * daily, and the composite PK is what makes "exactly once" mechanical
 * rather than a code convention (plan 017 D15).
 *
 * - `date` is the PUZZLE's America/Sao_Paulo calendar day, string mode so
 *   no JS Date mangles it through a timezone. Never the completion
 *   instant's day.
 * - `completed_at` is the DB clock at insert (`defaultNow()`); no
 *   JS-constructed date ever appears in an insert, and no client-supplied
 *   instant is accepted anywhere in the path (plan 017 D16/D19).
 * - "On time" is DERIVED, never stored:
 *     (completed_at at time zone 'America/Sao_Paulo')::date = date
 *   ADR-0009 recomputes streaks from these rows on merge, so the
 *   derivation must stay the definition. A denormalized column would be a
 *   cache; there is no cache.
 * - `outcome` accommodates 'lost' from day one so #27 (Termo) attaches
 *   rather than migrates. Binairo only ever writes 'won'.
 * - `elapsed_ms` and `hints_used` are player statistics, not authority:
 *   they come from the client and are range-checked at the contract
 *   boundary. `hints_used` is where the ADR-0006 free hint is recorded —
 *   there is no balance anywhere (plan 017 D21) — and it is SELF-REPORTED,
 *   so it can never back a "solved without hints" medal (ADR-0027).
 * - ADR-0009 merge duty: the PK makes re-pointing rows a CONFLICT
 *   operation. The merge re-points with
 *   `ON CONFLICT (user_id, game, date) DO NOTHING` after ordering the
 *   source rows by `completed_at`, so the surviving row is the EARLIEST
 *   completion and a merge can never downgrade on-time to late.
 *
 * EXTENSION POINT: #23/#25/#27 write through the same table and route;
 * no schema change is expected.
 */
export const completions = pgTable(
  "completions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    game: text("game", { enum: GAMES }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    completedAt: timestamptz("completed_at").notNull().defaultNow(),
    outcome: text("outcome", { enum: COMPLETION_OUTCOMES }).notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.game, t.date] }),
    check(
      "completions_game_check",
      sql`${t.game} in ('binairo', 'sudoku', 'nonogram', 'termo')`,
    ),
    check("completions_outcome_check", sql`${t.outcome} in ('won', 'lost')`),
    check("completions_elapsed_ms_check", sql`${t.elapsedMs} >= 0`),
    check("completions_hints_used_check", sql`${t.hintsUsed} >= 0`),
    // The PK covers (user_id) and (user_id, game); the streak recompute and
    // "the day so far" both read (user_id, date) across games.
    index("completions_user_date_idx").on(t.userId, t.date),
  ],
);

/**
 * Day-scoped hint grants (ADR-0006, ADR-0027) — DORMANT in v1: no ads SDK
 * ships, so nothing writes a row. The GRANT-EVENT schema exists now so the
 * rewarded-ad ticket attaches rather than migrates; that ticket still adds
 * its own CONSUMPTION record, which v1 deliberately does not model (§11).
 *
 * This is deliberately NOT a wallet, balance or ledger:
 * - rows are APPEND-ONLY records of a grant event; nothing ever decrements;
 * - `grantedHintsToday` is `sum(hints) where date = SP-today`, so a grant
 *   EXPIRES structurally when the day key falls behind — no expiry job, no
 *   TTL column, no carry-over across days;
 * - the v1 free hint is per-puzzle and writes no row at all (D21); it is
 *   recorded on `completions.hints_used`.
 * A future column named like a balance (`hints_remaining`, `credits`, …)
 * would violate ADR-0006; test/user.test.ts pins this table's column set
 * exactly so such a column fails the suite.
 */
export const hintGrants = pgTable(
  "hint_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(), // the SP day it is valid for
    source: text("source", { enum: HINT_GRANT_SOURCES }).notNull(),
    hints: integer("hints").notNull(),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
  },
  (t) => [
    check("hint_grants_source_check", sql`${t.source} in ('rewarded-ad')`),
    check("hint_grants_hints_check", sql`${t.hints} > 0 and ${t.hints} <= 10`),
    index("hint_grants_user_date_idx").on(t.userId, t.date),
  ],
);
```

`COMPLETION_OUTCOMES` and `HINT_GRANT_SOURCES` are `as const` tuples exported from `packages/core` (§6.4) so the drizzle enum, the Zod schema and the CHECK constraint all read from one list.

**`clientSchema` in `src/client.ts` is NOT widened.** `completions`/`hintGrants` stay out of the root relational map, so `Object.keys(db.query)` remains `["sessions","users"]` and **T-DB-9d is untouched**. The query builder does not need the relational map, so `db.insert(completions)` works fine from `apps/api`.

### 6.3 `src/completions.ts` (new, reachable only via `@miolos/db/user`)

```ts
export interface CompletionRecord {
  readonly game: Game;
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  readonly elapsedMs: number;
  readonly hintsUsed: number;
}

/**
 * Write-once completion (D15). Returns the stored record and whether THIS
 * call wrote it. Never ON CONFLICT DO UPDATE: an upsert would bump
 * completed_at and silently reclassify an on-time completion as late.
 */
export async function recordCompletion(
  db: Db,
  input: {
    userId: string;
    game: Game;
    date: string;
    outcome: CompletionOutcome;
    elapsedMs: number;
    hintsUsed: number;
  },
): Promise<{ record: CompletionRecord; recorded: boolean }>;

/** Read-back with the SQL-derived on_time; undefined when absent. */
export async function getCompletion(
  db: Db,
  userId: string,
  game: Game,
  date: string,
): Promise<CompletionRecord | undefined>;

/**
 * DORMANT (D22). Hints GRANTED for the DB clock's SP today; 0 when none.
 * Named for what it computes: v1 records no consumption of granted hints,
 * so this is not "available" (ADR-0027 names the seam the rewarded-ad
 * ticket must add).
 */
export async function grantedHintsToday(db: Db, userId: string): Promise<number>;

/** DORMANT (D22). EXTENSION POINT: the rewarded-ad ticket is the first caller. */
export async function grantHints(
  db: Db,
  input: { userId: string; date: string; source: HintGrantSource; hints: number },
): Promise<void>;
```

Implementation notes, all load-bearing:

- `recordCompletion` = `insert(...).onConflictDoNothing({ target: [completions.userId, completions.game, completions.date] }).returning()` — **bare `.returning()`**, never `.returning({col})`: on the union `Db` type only the no-argument overload survives TS's union-signature collapse (the landed comments in `session/service.ts:56-58` and `buffer.ts:56-57`). `recorded = inserted.length > 0`; then **always** call `getCompletion` for the returned record, because `on_time` has to come from SQL.
- `getCompletion` uses a **projected `.select({...})`**, which is proven to work on the union `Db` by `resolveSession`:
  ```ts
  const rows = await db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
      onTime: sql<boolean>`(${completions.completedAt} at time zone ${SAO_PAULO_TIME_ZONE})::date = ${completions.date}`,
    })
    .from(completions)
    .where(and(eq(completions.userId, userId), eq(completions.game, game), eq(completions.date, date)))
    .limit(1);
  ```
- `grantedHintsToday` day-scopes in SQL, never in JS:
  ```sql
  select coalesce(sum(hints), 0) from hint_grants
   where user_id = $1 and date = (now() at time zone 'America/Sao_Paulo')::date
  ```
- No JS `Date` appears in any statement in this file. `completed_at` and `granted_at` are column defaults only.

### 6.4 `packages/core` additions

`src/completion.ts` (new):
```ts
export const COMPLETION_OUTCOMES = ["won", "lost"] as const;
export type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number];
export const completionOutcomeSchema = z.enum(COMPLETION_OUTCOMES);

export const HINT_GRANT_SOURCES = ["rewarded-ad"] as const;
export type HintGrantSource = (typeof HINT_GRANT_SOURCES)[number];
export const hintGrantSourceSchema = z.enum(HINT_GRANT_SOURCES);
```

`src/contracts/completion.ts` (new) — the first **request**-body contract in the repo:
```ts
/**
 * A calendar-VALID 'YYYY-MM-DD'. `isoDateString` checks shape only, which
 * is right for server-derived values but not for a client-supplied one:
 * "2026-02-30" passes the regex, reaches `eq(dailyPuzzles.date, date)`
 * against a Postgres `date` column, and raises 22008 — a 500 from a
 * two-character body edit. Round-tripping through UTC is the check.
 */
export const calendarDateString = isoDateString.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}, "not a calendar date");

/**
 * Completion submission (ADR-0008, ADR-0026). Deliberately carries NO
 * timestamp: `completed_at` is the DB clock at insert, and accepting a
 * client instant would put the client clock into streak arithmetic
 * (CLAUDE.md invariant). `elapsedMs`/`hintsUsed` are statistics,
 * range-checked here so an untrusted body can never widen a column — the
 * CLIENT clamps before posting (§9.2), so a legitimate long session is
 * never rejected by this bound.
 *
 * `hintsUsed` maxes at 1 because v1 grants exactly one free hint per
 * puzzle (D21). The rewarded-ad ticket widens it together with the
 * consumption record ADR-0027 names.
 *
 * EXTENSION POINT: #23/#25/#27 add their variants to the union; the
 * discriminator is `game`.
 */
export const binairoCompletionRequestSchema = z.strictObject({
  game: z.literal("binairo"),
  date: calendarDateString,
  grid: z.array(z.union([z.literal(0), z.literal(1)])).length(64),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
]);

export const completionResponseSchema = z.strictObject({
  game: gameSchema,
  date: isoDateString,
  outcome: completionOutcomeSchema,
  /** Derived server-side from the completion instant vs the puzzle's SP day. */
  onTime: z.boolean(),
  /** false = the row already existed; the body carries the STORED values. */
  recorded: z.boolean(),
  elapsedMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
});

/** Minimal error envelope — the repo's first; keep it this small. */
export const apiErrorResponseSchema = z.strictObject({ error: z.string() });
```

Also: **export `isoDateString` and `calendarDateString` from `packages/core/src/index.ts`** (apps/web needs `isoDateString` for the local play record). `packages/core` has no export-list tripwire, so this is additive only.

### 6.5 Migration `0002`

`pnpm -F @miolos/db db:generate` → commit `migrations/0002_*.sql` + `meta/0002_snapshot.json` + the `_journal.json` entry, **untouched by hand**. `createTestDb()` replays the committed artifact, so every PGlite suite fails until this is committed. Production application is a manual step (§16 E3) — nothing automates migrations.

---

## 7. `apps/api` changes

### 7.1 `src/session/service.ts` — one new helper

```ts
/**
 * Resolve the caller's user id for a WRITE. Deliberately never mints:
 * minting on a write would create phantom users from any stray POST, and
 * identity is minted exactly once, by POST /session (ADR-0022).
 */
export async function requireUserId(
  db: Db,
  token: string | undefined,
): Promise<string | undefined> {
  if (!token) return undefined;
  const resolved = await resolveSession(db, await hashSessionToken(token));
  return resolved?.userId;
}
```
(The route reads `request.cookies.get(SESSION_COOKIE_NAME)?.value` and passes it in, keeping the service `NextRequest`-free like the rest of the module.)

### 7.2 `src/session/origin-guard.ts` — rename + the shared degradation warning (D25)

- `isCrossSiteMint` → `isCrossSiteWrite`, TSDoc generalized from "mint" to "state-changing write". Behaviour unchanged (deny on positive evidence only).
- `warnIfGuardDegraded` moves here from `app/session/route.ts` and is **exported** (module-level `warnedMissingWebOrigin` flag preserved verbatim — once per instance). Both routes call it first.
- Call sites: `apps/api/app/session/route.ts` (import + drop the local copy) and the new `app/completions/route.ts`.
- Test file is **`apps/api/test/session-origin-guard.test.ts`** (not `origin-guard.test.ts`): its `describe("isCrossSiteMint")` title and all seven `isCrossSiteMint(...)` call sites rename with it, and it gains the degradation-warning cases.

### 7.3 `app/completions/route.ts` (new)

```ts
export const dynamic = "force-dynamic";

export function OPTIONS(): Response;          // preflightResponse() — a JSON POST always preflights
export async function POST(request: NextRequest): Promise<Response>;
```

**Every** `return` in this file is constructed with `headers: corsHeaders({ credentials: true })` (D31) — 403 included. Flow, in order:

0. `warnIfGuardDegraded()`.
1. `isCrossSiteWrite({secFetchSite, origin}, process.env.WEB_ORIGIN)` → `403 { error: "cross-site" }`, no DB touch.
2. **`Content-Type` must be `application/json`** (parameters allowed, e.g. `; charset=utf-8`) → otherwise `415 { error: "unsupported-media-type" }`, before the body is read (D30).
3. `requireUserId(db, cookie)` → `undefined` ⇒ **401** `{ error: "no-session" }`.
4. `completionRequestSchema.safeParse(await request.json())` → failure ⇒ **400** `{ error: "invalid-body" }` (a malformed JSON body is caught by a `try` around `request.json()` and takes the same branch).
5. **Idempotent short-circuit (D15):** `getCompletion(db, userId, body.game, body.date)` — if a row exists, return **200** with `recorded: false` and the stored values **immediately**, before any wall read and before any grid comparison. An honest replay must never be re-judged: after a `killed_at`, step 6 would 404 a completion the server actually holds, and a replay whose grid differs (a partially-restored record, a second device) would 422 instead of returning the stored row.
6. `getPublishedDailyWithSolution(db, body.game, body.date)` from **`@miolos/db/publishing`** — the ADR-0024 named duty — **plus the D29 date bound**: the wall read is `and`-ed with `date >= (now() at time zone 'America/Sao_Paulo')::date - 1`. `undefined` ⇒ **404** `{ error: "no-puzzle" }`. The wall predicate is what rejects a future date or a killed row; the bound is what rejects an arbitrary past one.
7. `binairoDailyContentSchema.parse(row.content).solution` — parsed, never cast — compared with `body.grid` **without early exit** (accumulate a mismatch count over all 64 cells). Binairo has no secret worth a timing channel, but §6.4's TSDoc makes this route and union the extension point for #27 Termo, where the answer word *is* the product's one secret; this repo has already engineered timing-sensitive comparisons out twice (`cron/publish/route.ts`, `session/token.ts`) and does not reintroduce one here. Mismatch ⇒ **422** `{ error: "grid-mismatch" }`, **no row written**. For Binairo a wrong grid is not a game outcome (ADR-0008: `lost` is Termo-only); it is a client bug or tampering.
8. `recordCompletion(db, { userId, game, date, outcome: "won", elapsedMs, hintsUsed })` from **`@miolos/db/user`**.
9. **200** `completionResponseSchema.parse({ ...record, recorded })`.

CORS: `preflightResponse()` already advertises `POST, OPTIONS` and `Content-Type` — sufficient, no custom header is introduced (the idempotency key is the natural key, D15).

`getDb()` returns the wall-narrowed root client, and both `getPublishedDailyWithSolution` and the completion writers use the query builder rather than `db.query`, so **no new client factory is needed**.

**Abuse posture, recorded rather than assumed (ADR-0026):** the composite PK caps rows at one per (user, game, date) and D29 caps the date axis at two days, so the only uncapped axis is minted-users × 2 days; each request costs one wall read of a jsonb row plus one insert. **Accepted for v1: no application-level rate limit**, with Vercel's platform firewall as the backstop — the same posture ADR-0024 recorded for the public reads, now extended to a write. This ticket **falsifies ADR-0022's "flood-minted rows are unreferenced and harmless"**, which ADR-0026 amends explicitly; the revisit trigger is the first abuse signal or the rewarded-ad ticket, whichever comes first.

### 7.4 On-time vs late, end to end

`completed_at` = DB `now()` at insert. `on_time` = `(completed_at at time zone 'America/Sao_Paulo')::date = date`, computed in the read-back select (§6.3). Three consequences, all tested:

- Today's puzzle completed today ⇒ `onTime: true` (T-API-4).
- **Yesterday's published puzzle completed today ⇒ `onTime: false`** (T-API-13) — a *seam-level* late derivation that needs no clock fake at all, and the shape #31 (archive) inherits.
- A completion flushed after the SP rollover ⇒ `onTime: false` (D19), proven at the seam under a faked clock (T-API-14).

### 7.5 Not touched in apps/api

`GET /daily/binairo` keeps its shape and its 404-with-`{}` body. #18 owns the **client** copy for that 404 (`messages.binairo.unavailable.*`, §13.1), not the route.

---

## 8. Client state model (exact types)

`apps/web/src/binairo/state.ts` — pure, no React, no DOM.

```ts
import type { BinairoCell, BinairoGrid, BinairoSolvedGrid } from "@miolos/games/binairo";

/** What a player may put in a cell. Mirrors BinairoCell; `null` = empty. */
export type CellValue = BinairoCell;

/** Sticky input mode. `cycle` is the default; the 0/1/apagar buttons toggle. */
export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 }
  | { readonly kind: "erase" };

/** Count-up timer. Elapsed is DERIVED, never accumulated by a tick (D10). */
export interface TimerState {
  readonly accumulatedMs: number;
  /** Client epoch ms of the current running segment, or null while paused. */
  readonly runningSince: number | null;
}

export interface HintState {
  readonly free: 1;                       // one free hint per puzzle (D21)
  readonly used: number;                  // 0 | 1 in v1
  readonly lastIndex: number | null;      // the cell the hint filled, for the highlight
}

export interface PlayState {
  readonly date: string;                  // the SERVER's date for this puzzle
  readonly givens: BinairoGrid;           // 64, immutable
  readonly entries: readonly CellValue[]; // 64; always null at a given's index
  readonly paint: PaintMode;
  readonly timer: TimerState;
  readonly hint: HintState;
  readonly violating: ReadonlySet<number>;// recomputed on every entry change (D11)
  readonly status: "playing" | "solved";
  readonly pendingSync: boolean;
  /** false until the mount effect has run. Gates every record-derived render (D28). */
  readonly hydrated: boolean;
}

export type PlayAction =
  | { readonly type: "restore"; readonly record: PlayRecord | undefined; readonly now: number }
  | { readonly type: "tap"; readonly index: number }
  | { readonly type: "paint-over"; readonly index: number }   // drag, paint/erase modes only
  | { readonly type: "set-mode"; readonly mode: PaintMode }
  | { readonly type: "use-hint"; readonly solution: BinairoSolvedGrid }
  | { readonly type: "tick"; readonly now: number }
  | { readonly type: "pause"; readonly now: number }
  | { readonly type: "resume"; readonly now: number }
  | { readonly type: "mark-synced" };

/** The deterministic server snapshot: givens only, 00:00, hydrated: false (D28). */
export function initPlayState(daily: DailyPuzzleResponse): PlayState;

export function playReducer(state: PlayState, action: PlayAction): PlayState;

/** givens[i] ?? entries[i] — the grid the engine sees. */
export function mergedGrid(state: PlayState): BinairoGrid;

/**
 * Narrows a partial grid to a solved one. The engine's own `toSolvedGrid`
 * lives in internal.ts and is deliberately unexported (ADR-0019 keeps
 * `src/binairo/index.ts` the public API), so the guard lives here rather
 * than being invented as a cast at the call site.
 */
export function isSolvedGrid(grid: BinairoGrid): grid is BinairoSolvedGrid;

/** accumulatedMs + (runningSince === null ? 0 : now - runningSince). */
export function elapsedMs(timer: TimerState, now: number): number;
```

### 8.1 Cell state machine

Per cell index `i`:

- `givens[i] !== null` ⇒ **given**, immutable. `tap` and `paint-over` are no-ops.
- Otherwise the cell is `entries[i]`, and **`tap` in `cycle` mode advances `null → 0 → 1 → null`** (D7).
- `tap` in `paint` mode: `entries[i] === mode.value ? null : mode.value` (re-tapping clears, so a stroke is undoable without leaving the mode).
- `tap` in `erase` mode: `null`.
- `paint-over` applies only in `paint`/`erase` mode and is a plain set (never a toggle) — a drag must be idempotent over the cells it crosses. In `cycle` mode it is a no-op.

Every entry change recomputes `violating` from `findBinairoViolations(mergedGrid(next))`, flattening `violation.cells` into a `Set<number>`, and recomputes `status`: `solved` iff `isSolvedGrid(merged) && isValidBinairoSolution(merged)` (D12 — the guard subsumes the separate "every non-given cell filled" check, since a merged grid with no nulls is exactly that). Entering `solved` freezes the timer (`pause`) and sets `pendingSync: true`.

### 8.2 Paint mode: pointer semantics for touch and mouse

One handler set on the grid container, using **Pointer Events** (unified mouse/touch/pen):

- `.grid { touch-action: none; }` — scoped to the grid only, so the rest of the page still scrolls.
- `onPointerDown` on the container: `container.setPointerCapture(e.pointerId)`, dispatch `tap` for the cell under the pointer, set `painting = paint.kind !== "cycle"`.
- `onPointerMove` while `painting`: resolve the cell with `document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-cell-index]")` — **required**, because with pointer capture (and on touch generally) `pointerenter` does not fire on the cells being crossed. Dispatch `paint-over` when the resolved index differs from the last one.
- `onPointerUp` / `onPointerCancel`: `painting = false`, release capture.
- Keyboard: each cell is a real `<button>`; `Enter`/`Space` are `tap`. Arrow-key roving focus is **not** in this ticket (64 tab stops is acceptable; a roving tabindex is a follow-up if review asks).

### 8.3 Timer (D10) — exact lifecycle

`pause` and `resume` are **idempotent**, and this is load-bearing, not a nicety:

- `resume` is a **no-op when `runningSince !== null`**. Without it a second `resume` overwrites `runningSince` with the current `now` and silently discards every millisecond since the previous resume — exactly the drift D10 exists to prevent. Double resumes are ordinary: React StrictMode double-invokes the mount effect in dev, `visibilitychange → visible` can arrive without a preceding `hidden`, and a bfcache restore fires both `pageshow` and `visibilitychange`.
- `pause` is a **no-op when `runningSince === null`**. `visibilitychange → hidden` followed by `pagehide` fires twice on a real navigation away.

Mount effect, in `use-binairo-play.ts`:

- dispatch `{ type: "restore", record: readPlayRecord(daily.date), now: Date.now() }` — the single place `localStorage` is read (D28);
- derive the initial running state from `document.visibilityState` rather than resuming unconditionally;
- register `visibilitychange` (hidden → `pause`, visible → `resume`), `pagehide` (→ `pause` + persist) **and `pageshow` (→ `resume`)`. `pagehide` without a paired `pageshow` is the bfcache bug: on the common iOS/Safari back-navigation the page resumes from the frozen DOM, and if the browser delivers `pageshow` without a `visibilitychange`, an unpaired timer stays paused for the rest of the session and `elapsedMs` under-reports by the whole remaining play time;
- start `setInterval(() => dispatch({type:"tick", now: Date.now()}), 1000)`. `tick` only nudges a re-render; the displayed value always comes from `elapsedMs(timer, state.now)`, so a throttled background tab cannot drift the clock.

`restore` maps a `PlayRecord` into `PlayState` explicitly: `entries ← record.entries`, `timer.accumulatedMs ← record.elapsedMs`, `timer.runningSince ← null`, `hint.used ← record.hintsUsed`, `hint.lastIndex ← null`, `pendingSync ← record.pendingSync`, `status` recomputed from the restored entries, `hydrated ← true`. With `record === undefined` only `hydrated` flips.

"Discreet" per the frames: desktop = a labelled row inside the side stats card (`Tempo` + Fraunces 30px tabular); mobile = a 20px Fraunces tabular readout in the top bar. No progress bar, no colour change, no urgency.

### 8.4 Local validation (D11)

`findBinairoViolations` runs synchronously on every entry change (10–22 µs measured — no debounce, no worker). It never blocks input and its result is presentation only. `isValidBinairoSolution` decides `status` locally; the server re-judges in §7.3 step 7.

### 8.5 Undo (D9)

Not shipped. `apagar` + tap-to-cycle reach every state, the frames draw no undo affordance, and no AC asks for it.

---

## 9. Persistence and offline sync

### 9.1 The record (D13)

`apps/web/src/binairo/play-record.ts`:

```ts
const STORAGE_PREFIX = "miolos:play:";
export const playRecordKey = (game: "binairo", date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

export const playRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("binairo"),
  date: isoDateString,
  entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(64),
  /**
   * The SOLVED MERGED grid, written the moment `status` flips to `solved`.
   * The POST body needs `(0|1)[64]`, and the flush runs where the givens do
   * not exist in scope — on /binairo/concluido, on an `online` event, on a
   * cold mount. Reconstructing it from `entries` would need the givens,
   * which live only in /binairo's RSC props; without this field AC 3's
   * "syncs on reconnect" is unimplementable exactly where it matters.
   * Storing a solved PUBLISHED grid is inside ADR-0027's own argument: the
   * client can recompute it with solveBinairo(givens) in ~0.1 ms anyway.
   */
  grid: z.array(z.union([z.literal(0), z.literal(1)])).length(64).optional(),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  /** Terminal disposition of the sync, for the conclusion's discreet line (§9.2). */
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});
export type PlayRecord = z.infer<typeof playRecordSchema>;

export function readPlayRecord(date: string): PlayRecord | undefined;   // safeParse; undefined on garbage
export function writePlayRecord(record: PlayRecord): void;              // swallows QuotaExceededError
export function listPendingRecords(): PlayRecord[];                     // every key under the prefix with pendingSync
export function prunePlayRecords(keepDate: string): void;               // drops synced records older than keepDate
```

- Keyed by the **server's** `date` string — never a client-computed today. Both routes obtain it from `getTodayDaily` (D27), i.e. the DB clock (ADR-0010's single authority), and `prunePlayRecords`'s `keepDate` is that same string. A different date on the payload simply yields a different key, so a rollover mid-session starts a clean record.
- `localStorage`, not IndexedDB: one small record, a synchronous read is available in the mount effect, and no schema/versioning machinery is warranted. ADR-0001's follow-up already places in-flight state here. `v: 1` is the version escape hatch; an unparseable or wrong-version record is discarded, not migrated.
- Parsed with Zod on read — `localStorage` is user-editable, i.e. untrusted input crossing into the app (CLAUDE.md's "parsed, never cast").
- `elapsedMs` is **clamped** (`Math.min(elapsed, 86_400_000)`) before both persisting and posting, so the cap can never reject a record or a body. A rejecting cap would discard a player's in-progress grid on read and 400 forever on the wire.
- **Never a source of truth**: streaks, statistics and the completion instant come from the server; the record carries no timestamp of any kind, only a duration.
- Written on every entry change (a 64-element array, no throttle needed), on `pause`, and on `pagehide`. **Never during render** (D28).

### 9.2 Sync (D18)

`apps/web/src/binairo/sync.ts`:

```ts
let flushing = false;   // module-level, survives re-mounts (session-bootstrap precedent)

/** POST every pending record; terminal statuses clear pendingSync and set syncOutcome. */
export async function flushPendingCompletions(): Promise<void>;
```

- Request: `POST ${process.env.NEXT_PUBLIC_API_URL}/completions`, `credentials: "include"`, `Content-Type: application/json`, body built **from `record.grid` alone** (never from `entries` + givens) plus `game`, `date`, clamped `elapsedMs`, `hintsUsed`. A record with `pendingSync: true` and no `grid` is dropped with a `console.error` — it cannot be built, and retrying cannot help. Response parsed with `completionResponseSchema`. Missing `NEXT_PUBLIC_API_URL` ⇒ one loud `console.error`, never a silent relative fetch (`session-bootstrap.tsx` precedent).
- **Session ordering.** `bootstrapSession` moves out of `session-bootstrap.tsx` into `apps/web/src/session/bootstrap.ts` as `ensureSession(): Promise<void>` — fire-once, returning the shared promise. `SessionBootstrap` calls it in its effect (behaviour identical, existing test kept green); `flushPendingCompletions` **awaits it before its first POST**. Without this, a fast solve on a cold first visit reliably races the in-flight mint and takes the 401 branch.
- **Triggers, five**: on entering `solved`; `window` `online`; `document` `visibilitychange` when visible; on mount of either route; and a **bounded in-page retry** at 2 s / 5 s / 15 s / 60 s while a pending record exists and `document.visibilityState === "visible"`, cancelled on any terminal response. The retry is what makes AC 3's "syncs on reconnect" true for a player who finishes, sees the pending line and closes the tab — the other four triggers all require a new mount or an event that may never come. `flushing` prevents concurrent double-posts; the POST is idempotent, so a duplicate flush is free.
- **Terminal responses clear `pendingSync`** and set `syncOutcome`:
  - `200` → `syncOutcome: "recorded"`. On `recorded: false` the server is reporting the **authoritative stored** `elapsedMs`/`hintsUsed` (a second device, a partial sync); write them back into the record before clearing, so the conclusion never shows a time the server does not hold.
  - `404` (killed puzzle), `422` (grid rejected), `400` (structurally invalid body), `415`, `403` (the origin guard denied this client) → `syncOutcome: "rejected"`, plus one `console.error`. None of these can ever be accepted by a retry.
  - `401` and `5xx` and network failures keep `pendingSync: true` and `syncOutcome: "pending"`. On the first 401 the flush re-runs `ensureSession()` once and retries once, then stops for this page load.
- **UI while unsynced or rejected**: one discreet `--ink-2` 13px line on the conclusion — `messages.conclusao.sync.pending` while pending, `messages.conclusao.sync.rejected` when `syncOutcome === "rejected"`, nothing when recorded. No spinner, no toast, no retry button, nothing that nags (PRODUCT.md principle 4). **The `rejected` line is not cosmetic:** without it a 404/422 would clear the pending line and leave the "Concluído" stamp standing while the server holds no completion — making the client's own `isValidBinairoSolution` verdict the user-visible authority on completion, which is precisely the ADR-0004 invariant this ticket is built around.
- Offline mid-puzzle needs nothing else: the page and the engine are already loaded, the conclusion renders **in place** with no navigation (D26), hints are client-computed (D20), validation is client-side (D11), and the record survives a reload from `localStorage`.

---

## 10. The one free hint

### 10.1 Where it is computed (D20)

Client-side, in `apps/web/src/binairo/hint.ts`, from `solveBinairo(givens)` — memoized once per page (0.04–0.16 ms measured). `solveBinairo` returns `BinairoSolvedGrid | null`; the `null` branch is defined, not assumed away: `status` stays `playing` and the hint button renders its exhausted/unavailable variant (§10.5). For a published daily `null` is unreachable by construction (ADR-0020/0023), which is why it is a UI fallback rather than an error. No hint endpoint exists in this ticket.

The argument, recorded in **ADR-0027** so nobody rebuilds it wrong later: today's board is *published*, its givens are legitimately in the client's hands, and it is uniquely solvable by construction — so the solution is client-recoverable in a fraction of a millisecond no matter where the hint runs. Stripping `solution` from the payload protects **unpublished** content (ADR-0004's actual scope) and blocks casual devtools reads; it is not, and must never be argued to be, a confidentiality boundary for a published puzzle. Server-side computation would buy nothing and would break the hint offline, which AC 3 requires.

### 10.2 What the hint reveals, exactly

```ts
export interface BinairoHint {
  readonly index: number;
  readonly value: 0 | 1;
  readonly kind: "correction" | "fill";
}

/** Deterministic: same state in, same hint out. */
export function nextHint(
  solution: BinairoSolvedGrid,
  givens: BinairoGrid,
  entries: readonly CellValue[],
): BinairoHint | null;
```

1. If any player entry contradicts the solution, reveal the **first contradicting cell in row-major order** and correct it (`kind: "correction"`). This is the maximally useful hint: it unblocks the mistake the player is actually stuck behind.
2. Otherwise reveal the **first empty non-given cell in row-major order** (`kind: "fill"`).
3. `null` when the grid is already complete and correct.

The revealed cell is written into `entries` and marked `hint.lastIndex` for the highlight; a one-line pt-BR explanation under the grid names which case fired (`messages.binairo.hint.explain.correction` / `.fill`).

### 10.3 Accounting

`hint.used` goes 0 → 1, persisted in the play record, and reported as `hintsUsed` on the completion POST — the honest server-side record of it. It is **not** a grant row (D21). Server-side grant accounting exists only for the dormant rewarded-ad path (§11).

**Recorded posture:** the one-free-hint cap lives only in a user-editable `localStorage` record, and `completions.hints_used` is therefore self-reported. This is deliberate and inside ADR-0004's "nothing to cheat for": all content is free (ADR-0005), there is no ranking and no currency, so the only thing a tampered counter buys is a worse game. Two consequences, both written into ADR-0027: **no server enforcement of the free hint is built**, and **`hints_used` can never back a "sem dicas" medal** — that narrows ADR-0006's "Server-side matters if any curated medal ever depends on 'solved without hints'", so a medal ticket must add the server-computed path first.

### 10.4 Surfaced and deferred: `nextBinairoDeduction`

Plan 010 §8 left "engine-level hints (next forced deduction)" as a decision for #18. **#18 decides: not now.** The reasoning-naming hint the frames' README describes ("highlights the reasoning") needs the tier-1/tier-2 techniques to report their *witness cells*, which is a refactor of `packages/games/src/binairo/techniques.ts` with its own hand-verified fixtures and a property test — real engine work for an AC that asks only that one free hint works. Recorded in ADR-0027 with a follow-up issue filed at step 8.

### 10.5 UI affordance (from the frames)

Desktop: full-width solid button in the sidebar's `hint` grid area, pinned to the bottom by the `free` spacer row (§12.2) — `background: var(--accent-binairo)`, `color: var(--paper-desk)`, `padding: 14px 0`, `border-radius: var(--radius)`, `box-shadow: var(--shadow-sm) color-mix(in srgb, var(--accent-binairo) 25%, transparent)`, `font: var(--text-button)` (F3). Mobile: 50px tall, `margin-top: 14px`, same treatment (F4).

**Exhausted / unavailable state (undrawn in the frames — designed here):** `background: var(--paper-card)`, `border: 1.5px solid var(--line)`, `color: var(--ink-2)`, no shadow, `cursor: default`, `aria-disabled="true"`, and the label changes to `messages.binairo.hint.used`. Three carriers (fill, border, label), so it survives grayscale. The same variant renders when `solveBinairo` returns `null` (§10.1).

---

## 11. The dormant hint-grant schema

DDL is §6.2. Why dormant: v1 ships **no ads SDK at all** (ADR-0006 / CLAUDE.md), so the only grant source has no producer; the free hint is per-puzzle and needs no row (D21).

**What ships now, stated precisely.** The **grant-event** schema ships, so the rewarded-ad ticket attaches a writer (`grantHints`) and a reader (`grantedHintsToday`) rather than migrating a table into existence. **Consumption of a granted hint is deliberately unrepresented in v1** — `completions.hints_used` is written only at completion, so a granted hint used mid-puzzle, or in a puzzle never finished, has nowhere to live. The earlier claim that the rewarded-ad ticket "attaches instead of migrating" is therefore qualified here: the grant table attaches; the consumption record is that ticket's own additive work, and ADR-0027 names the seam it must build (a server call that checks `grantedHintsToday` minus consumption and returns the revealed cell — i.e. the *granted* path is server-computed even though the free path is not). Modelling consumption now would ship a second speculative dormant table for a ticket that does not exist; naming the gap costs nothing and keeps `grantedHintsToday`'s name honest.

**The test that proves rollover expiry with no runtime consumer** (`packages/db/test/user.test.ts`, T-DB-16..20): grant rows are inserted for SP-today, SP-yesterday and SP-tomorrow via `todaySaoPaulo(db)` + `addDays`; `grantedHintsToday` returns **only** today's sum; moving a row's date back by one day drops it to 0 with no job, no TTL and no update — which *is* the expiry semantics. Plus a column-set tripwire asserting `hint_grants`' columns are exactly `["id","user_id","date","source","hints","granted_at"]` via `information_schema.columns`, so a future `hints_remaining`/`balance`/`credits` column fails the suite (a mechanical ADR-0006 guard, not a convention).

---

## 12. The two screens

Both are recreations of the frames in plain React + CSS Modules (ADR-0002). Desktop-first, with **two** breakpoints per module (§12.2). Accent-alpha values use `color-mix(in srgb, var(--accent-binairo) N%, transparent)`, never `rgba()` literals. Any px value with no token carries a comment naming the frame it came from — the `page.module.css:87-89` precedent.

### 12.1 File tree

```
apps/web/app/binairo/page.tsx                     server, force-dynamic, reads the wall
apps/web/app/binairo/concluido/page.tsx           server, force-dynamic, reads the wall for the SP day (D27)
apps/web/src/db.ts                                the getDb seam + `server-only` (§5.1, D32)
apps/web/src/session/bootstrap.ts                 ensureSession(): the shared fire-once promise (§9.2)
apps/web/src/binairo/state.ts                     pure reducer + types + isSolvedGrid (§8)
apps/web/src/binairo/hint.ts                      pure hint selection (§10.2)
apps/web/src/binairo/play-record.ts               Zod + localStorage (§9.1)
apps/web/src/binairo/sync.ts                      the flush (§9.2)
apps/web/src/binairo/use-binairo-play.ts          useReducer + effects (timer, persistence, sync)
apps/web/src/binairo/binairo-screen.tsx           "use client" — swaps PlayView ⇄ ConclusionView (D26)
apps/web/src/binairo/binairo-screen.module.css
apps/web/src/binairo/play-view.tsx                the play composition
apps/web/src/binairo/grid.tsx                     64 cell buttons + pointer handlers
apps/web/src/binairo/controls.tsx                 0 / 1 / apagar + affordance line
apps/web/src/binairo/timer-readout.tsx
apps/web/src/binairo/conclusion-view.tsx          "use client" — the conclusion composition
apps/web/src/binairo/conclusion-view.module.css
apps/web/src/components/daily-unavailable.tsx     the pt-BR 404 screen (+ .module.css)
apps/web/src/i18n/format.ts                       formatLongDate / formatShortDate / formatElapsed
```

**Nothing goes into `packages/ui`** (D24): every one of these is JSX, and Binairo is the first and only consumer (ADR-0002's "shared web components only once a second consumer exists").

### 12.2 `/binairo` component tree ← F3 (1440×900) / F4 (390×844)

**The page is one CSS grid with named areas.** This is the decision that makes both compositions come out of one DOM with one node per interactive control — no `display: contents` (which cannot move a node across subtrees; `.sidebar` is a child of `.body`, while `.topBar` is its sibling, so the earlier plan's "the single `<TimerReadout/>` lands in the top-bar row" was physically impossible), and no duplicated `<button>`.

```
<main .page>                       display: grid
  <header .topBar area:bar>        flex, space-between; min-height var(--touch-target-min) ≤1040px
    <Link .back>                   "← Hoje", font var(--text-button), aria-label from messages
    <span .wordmark>               Fraunces italic 24px, rotate(-1deg)        [>1040px only]
    <span .kicker>                 "Lógica" 11px ls .14em uppercase           [≤1040px only]
    <span .topDate>                long date 13px var(--ink-2)                [>1040px only]
    <TimerReadout .timerBar/>      Fraunces 20px tabular                      [≤1040px only]
  <div .titleBlock area:title>
    <p .kicker>                    "Lógica" 11px ls .16em uppercase           [>1040px only]
    <div .titleRow>                flex, space-between, align-items baseline
      <h1 .title>                  var(--text-screen-title) 54px | 34px
      <span .progressBar>          "{filled} de 64"                           [≤1040px only]
    <p .rules>                     15px/1.6 var(--ink-2), text-wrap pretty | 13px/1.5 mobile
  <div .statsCard area:stats>      paper card, tape, rotate(-0.5deg)          [>1040px only]
    <div .tape aria-hidden>
    <div .row><span .label>Tempo</span><TimerReadout .timerCard/></div>
    <div .row><span .label>Progresso</span><span .progressCard/></div>
  <button .hint area:hint>         solid accent; exhausted variant §10.5
  <section .board area:board>
    <div .gridCard>                rotate(0.4deg); shadow var(--shadow-lg) | 5px 5px 0 (F4)
      <Grid/>                      grid-template-columns repeat(8, 52px|38px), gap 4px|3px
    <Controls/>                    0 / 1 / apagar (+ affordance line, >768px only)
    <p .hintExplain>               one line, shown after a hint is used
```

**The `<h1>` is the FIRST element child of `.titleRow`, and the kicker is a sibling of `.titleRow`, never of the `<h1>`.** This is not styling — it is what stands both impeccable slop rules down, verified against `node_modules/impeccable/cli/engine/rules/checks.mjs`:

- `checkHeroEyebrow` (`hero-eyebrow-chip`, checks.mjs:407-456) anchors on `h1.previousElementSibling`; its only carve-out is `[role="tabpanel"|"dialog"|"application"], dialog`. At 1440 the h1 is 54px ≥ 48 and an 11px kicker at 0.16em tracks 1.76px ≥ 1.6 — it would fire, and **no card wrapper, `data-impeccable-allow-kickers`, or meta text can save it**.
- `collectKickerCandidates` (`kicker-above-heading`, checks.mjs:2490+) also reads `heading.previousElementSibling`, never checks visibility (so `display: none` on the desktop kicker would not help at 390), and only exempts a heading whose `closest('article,button,a,li,[role=listitem],[role=option]')` also contains the kicker — which is why Hoje's `<article>` cards pass today and a `<section>` sidebar would not. At 390 the h1 is 34px < 48, so the hero deferral at checks.mjs:2530 does not apply and this rule fires instead.

With `h1.previousElementSibling === null`, both rules return early on the first guard. DOM order stays kicker-first exactly as the frames draw it. A CSS/JSX comment records the reason so nobody "simplifies" the wrapper away.

**Breakpoints, with the arithmetic:**

```css
/* >1040px — F3. 80 + 330 + 72 + (8×52 + 7×4 + 2×16 + 2) + 80 = 1040px is the
   hard minimum this composition needs. Below it the fixed 52px cells cannot
   shrink, so the two-column layout overflows — and neither scanned viewport
   (1440×900, 390×844) is in that band, so CI would never catch it. */
.page {
  display: grid;
  grid-template-columns: 330px 1fr;
  column-gap: 72px;
  grid-template-rows: auto auto auto 1fr auto;
  grid-template-areas:
    "bar   bar"
    "title board"
    "stats board"
    "free  board"
    "hint  board";
  padding: var(--space-11) 80px;
}

@media (max-width: 1040px) {
  /* Single column, desktop type, 52px cells: 8×52 + 7×4 + 32 + 2 = 478px,
     comfortable at any width ≥ 520px. */
  .page { grid-template-columns: 1fr; grid-template-areas: "bar" "title" "board" "hint"; }
  .statsCard, .wordmark, .topDate, .kicker /* the .titleBlock one */ { display: none; }
  .topBar .kicker, .timerBar, .progressBar { display: block; }
}

@media (max-width: 768px) {
  /* F4's type and cell step-down only. Page padding is 20px, not F4's 16px:
     impeccable's body-text-viewport-edge (checks.mjs:3360) fires on a >40-char
     <p> whose rect.left < 16, and the mobile rules paragraph (deviation 2)
     lands exactly on 16.0 — one sub-pixel of layout rounding tips it red.
     Hoje ships 20px for the same reason. */
  .page { padding: var(--space-5) var(--space-5) var(--space-6); }
  .grid { grid-template-columns: repeat(8, 38px); grid-auto-rows: 38px; gap: 3px; }
  .title { font-size: 34px; }
  .rules { font-size: 13px; line-height: 1.5; }
}
```

Two `<TimerReadout/>` nodes (`.timerBar`, `.timerCard`) and two progress nodes (`.progressBar`, `.progressCard`) exist. `display: none` removes an element from the accessibility tree, so exactly one of each pair is exposed in a real browser — the shipped `.ctaLong`/`.ctaShort` precedent in `page.module.css:172-174, 321-327`. jsdom has no media queries, so T-WEB-6 asserts **two** timer nodes carrying the same formatted value, with the media queries named in a comment.

**Cell visual language** (identical in F3/F4 but for `font-size: 23px | 18px`), three carriers per state so it survives grayscale and the "accents carry identity, not meaning alone" rule:

| State | background | border 1.5px | color | weight | extra |
|---|---|---|---|---|---|
| empty | `--paper-desk` | `--line` | `--ink` | 400 | — |
| given | `--paper-tint` | `--line` | `--ink` | 600 | `aria-disabled`, not a button |
| entered | `--paper-desk` | `color-mix(… --accent-binairo 50%, transparent)` | `--accent-binairo` | 500 | — |
| **violating** *(undrawn — designed here)* | `--paper-desk` | `--accent-app` | `--accent-app` | 500 | `box-shadow: inset 0 0 0 1.5px var(--accent-app)` (doubled hairline, blur 0) + `aria-invalid="true"` |
| **hint-filled** *(undrawn)* | `color-mix(in srgb, var(--accent-binairo) 10%, var(--paper-desk))` | `--accent-binairo` (full) | `--accent-binairo` | 600 | settles in over `--duration-fast` |
| **focus** *(undrawn)* | — | — | — | — | `:focus-visible { outline: 2px solid var(--accent-binairo); outline-offset: 2px }` |

**Control buttons, specified at the same rigour as the cells** (F3:49-52, F4:35-37) — these are drawn in the frames and were previously left as one tree line:

| | `0` / `1` | `apagar` |
|---|---|---|
| background | `var(--paper-card)` | `var(--paper-card)` |
| border | `1.5px solid var(--accent-binairo)` | `1.5px solid var(--line)` |
| color | `var(--accent-binairo)` | `var(--ink-2)` |
| font | Fraunces 24px wt 600 (desktop) / 26px (mobile) | Instrument Sans 14px |
| shadow | `var(--shadow-sm) color-mix(in srgb, var(--accent-binairo) 22%, transparent)` | `var(--shadow-sm) color-mix(in srgb, var(--ink) 10%, transparent)` |
| desktop size | 64 × 52px | height 52px, `padding: 0 22px` |
| mobile | `flex: 1.4`, height 60px | `flex: 1`, height 60px |
| **paint-active** *(undrawn)* | inverts: `background: var(--accent-binairo)`, `color: var(--paper-desk)`, wt 600, `aria-pressed="true"` | same inversion using `--ink-2`/`--paper-desk` |

`apagar`'s **ink-tinted** shadow is a recorded exception to DESIGN.md's "hard shadow `rgba(accent, 0.2–0.3)`" — it is the one shadow in the whole frame set that is not accent-tinted, and it is deliberate: `apagar` is a neutral control, not a game-accent one. An implementer following DESIGN.md alone would get it wrong, so it is written here with the frame cited.

**Tape geometry, pinned from the frames** (Hoje's shipped `.tape` is *centred*, so copying it produces a visibly wrong tape): stats card = `width 64px; height 20px; top: -10px; left: 32px; transform: rotate(-3deg)` (F3:27), `border-radius: var(--radius-tape)`, `background: color-mix(in srgb, var(--accent-binairo) 32%, transparent)`.

**Motion** — the repo's first: `.hint`, `.control`, `.cell` get
`transition: transform var(--duration-fast) var(--ease-settle), box-shadow var(--duration-fast) var(--ease-settle);`
and `:active { transform: translate(1px, 1px); box-shadow: <N-1>px <N-1>px 0 …; }` — the element slides 1px toward its shadow and the shadow shrinks by the same 1px (DESIGN.md, verbatim). Wrapped by
`@media (prefers-reduced-motion: reduce) { … { transition: none } }`. Rotations and tape stay static, never animated.

### 12.3 The conclusion ← F5 / F6, with the scope call

**Where it renders (D26).** `BinairoScreen` renders `<ConclusionView/>` in place of `<PlayView/>` once `status === "solved"` — no navigation, so a player who finishes offline sees it, which is what AC 3 requires and what a `force-dynamic` route plus no service worker could never deliver. `/binairo/concluido` is the same `<ConclusionView/>` under its own server segment (D27), reached by a bookmark, a reload, `impeccable detect`, and later by #19's "ver resultado" affordance. **Re-entry is decided:** `/binairo` mounting with a record for the server's date whose `concluded` is true restores straight into `<ConclusionView/>` — the timer never restarts, no second POST is possible, and the player is never invited to replay a completed daily.

```
<main .page>
  <header .topBar>
    <Link .back>            "← Hoje"
    <span .wordmark>        Fraunces italic 24px rotate(-1deg)   [>1040px]   ← F5:18
    <span .kicker>          "Lógica"                             [≤1040px]   ← F6:18
    <span .topDate>         long date | short date
  <article .resultCard>     paper, tape, rotate(-0.5deg), shadow var(--shadow-lg)|5px 5px 0
    <div .titleRow><h1 .title>"Binairo"</h1></div>   Fraunces 52px | 27px   ← h1 first child (§12.2)
    <p .kicker>             "Lógica"                 [>1040px only — F6's card has none]
    <div .stampRow>
      <div .stamp>          150px|108px circle, 3px solid var(--accent-binairo), rotate(-6deg)
        <span .stampLabel>  "Concluído"  11px ls .18em uppercase
        <span .stampTime>   Fraunces 40px|28px tabular   ← REAL DATA
        <span .stampHints>  Fraunces italic 13px|11px    ← REAL DATA ("sem dicas" | "com 1 dica")
    <p .sync>               discreet 13px var(--ink-2): pending | rejected | nothing   (§9.2)
  <aside .side>
    <section .dayCard>      "O dia até agora" + four chips (binairo done; the other three "falta")
    <Link .cta>             "Fechar o dia — voltar para Hoje"
    <a .secondaryLink>      "Ver estatísticas" — href-less (Hoje's shipped precedent)
```

**Top bar per viewport, because the frames differ** — F5 centres the italic wordmark and puts the kicker *inside* the card; F6 centres the kicker in the top bar and its card has **no** kicker. A single "back | kicker | date" bar would lose the wordmark on desktop and render "Lógica" twice. Same two-node + media-query treatment as §12.2.

**Desktop composition.** With four blocks removed (below), F5's main card would read as an empty rectangle at 48px padding, so the desktop composition is **redesigned within the system**: the result card centres the stamp under the kicker + title, and the right column carries the day card, the CTA and the secondary link.

**Mobile composition (390px), written out rather than left to the implementer.** F6's card is a horizontal row — 108px stamp left, title + `melhor`/`média` right — and removing best/média would leave a half-empty row, the exact failure the desktop redesign exists to prevent. So at ≤768px the result card stacks: title row, then the 108px stamp centred with `margin: 18px auto 0`, then the sync line; the day card, CTA and secondary link follow below the card in source order (`.side` is not a column at this width). Recorded as deviation 8.

**Result-card tape** (F5:23 desktop / F6:22 mobile): `78×24px at top:-12px; left:60px; rotate(-4deg)` | `58×19px at top:-10px; left:30px; rotate(-4deg)`.

**Stamp motion — the one celebration this product has.** PRODUCT.md principle 3 and DESIGN.md both name the stamp settling as *the* reward, and the frames' README makes recreating it an explicit instruction; a static circle with a number in it is the template default this system exists to avoid. Exactly one mount keyframe, no repeat:

```css
@keyframes stamp-settle {           /* name avoids /bounce|elastic|wobble|jiggle|spring/i (checks.mjs:484) */
  from { transform: scale(1.06) rotate(-9deg); opacity: 0.6; }
  to   { transform: scale(1) rotate(-6deg);    opacity: 1; }
}
.stamp { animation: stamp-settle var(--duration-slow) var(--ease-settle) both; }
@media (prefers-reduced-motion: reduce) {
  .stamp { animation: none; transform: rotate(-6deg); }
}
```
`--ease-settle` is `cubic-bezier(0.2, 0.8, 0.3, 1.05)`; impeccable's `bounce-easing` fires only outside `[-0.1, 1.1]` (checks.mjs:495-499), so **1.05 is inside the allowed range** — recorded here so a step-6 reviewer does not challenge the token.

**Conclusion scope, decided per element** (the alternative — rendering empty stat rows and a zero streak — is fake data, which this repo does not ship):

| Frame element | #18 | Reason / owner |
|---|---|---|
| Stamp, time, hint line | **ships, real data** | AC 5 |
| "O dia até agora" chips | **ships** — Binairo done with its time, the other three as the dashed `falta` chip | Honest: they genuinely are not done, and no play route exists for them yet |
| Next-daily CTA | **ships**, pointing at `/` (Hoje) with `messages.conclusao.cta` | The named game routes arrive with #23/#25/#27; Hoje is where the pending dailies live, so the CTA plus the `falta` chips together are the "points to the next pending daily" AC |
| "Ver estatísticas" | **ships href-less** | Matches Hoje's shipped href-less `Estatísticas`. Live target: **#29** |
| "Compartilhar resultado" | **omitted** | A dead share button is a broken promise, unlike a dead link. **#34** |
| Streak card | **omitted** | Streaks are server-computed (ADR-0009); a client-computed streak violates the invariant. **#19/#20** |
| Best / average / solved rows | **omitted** | No statistics endpoint or schema exists. **#29** |
| 6-bucket histogram | **omitted** | Same. **#29** |
| Closing italic line | **omitted** | It compares against the average, which does not exist. **#29** |

**Day card** (F5:58): `background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow-md) var(--line); padding: 24px 28px; transform: rotate(-0.6deg)`. The solid `--line` shadow is the only non-accent card shadow in the frames — pinned here so it is not re-derived as an accent shadow.

**CTA colour** (deviation 9): F5 paints its CTA `--accent-nonogram` because it says "jogar Nonogram" — in this system a per-game accent *is* that game's identity (DESIGN.md:22). Our CTA goes to Hoje, so it takes F5's own treatment for its **non-game** button: `background: var(--ink); color: var(--paper-desk); box-shadow: var(--shadow-sm) var(--line)` (F5:66-68). `--accent-nonogram` is reserved for when #25 makes this CTA actually point at Nonogram.

**"Ainda não concluído" state — specified in full, because it is the only thing CI ever sees.** §12.7's residual establishes that the *populated* conclusion cannot be URL-scanned (it renders from a solved local record and Puppeteer launches a clean profile), so this state is the entire evidence AC 5 will ever produce for `/binairo/concluido`. It gets the same detail as the populated card:

```
<main .page>
  <header .topBar>          identical to the populated one
  <article .emptyCard>      background var(--paper-card); border 1px solid var(--line);
                            border-radius var(--radius);
                            box-shadow var(--shadow-lg) color-mix(in srgb, var(--accent-binairo) 22%, transparent);
                            padding 48px | 22px; transform rotate(-0.5deg); max-width 560px; margin-inline auto
    <div .tape aria-hidden> 78×24px at top:-12px; left:60px; rotate(-4deg) | 58×19px, left:30px
    <div .titleRow><h1 .title></h1></div>   messages.conclusao.notYet.title, Fraunces 34px | 27px wt 550
    <p .body>               messages.conclusao.notYet.body, 15px/1.6 var(--ink-2) | 13px/1.5
    <Link .cta>             messages.conclusao.notYet.cta → routes.binairo, accent-binairo solid (F3's hint treatment)
```

A silent `router.replace` was rejected: a bookmark deserves an explanation. **Pre-hydration paint (D28) is a skeleton card, not this one** — flashing "ainda não concluído" and then swapping to a completed stamp is worse than a beat of nothing.

### 12.4 Frame deviations, all recorded

1. **Rules blurb states rule 4 for rows *and* columns** — the frame says "nenhuma linha se repete"; ADR-0020 rule 4 covers both, and its Consequences make stating it #18's duty. Shipped copy: `…e nenhuma linha ou coluna se repete.`
2. **Mobile gains a rules blurb** — F4 draws none, but AC 5 requires one. It ships as a single 13px/1.5 `--ink-2` paragraph under the title row.
3. **`caderno nº 214` dropped from both kickers** — it has no data source and Hoje already dropped the same prefix from its meta line. Kicker is `Lógica`.
4. **F6's 9px/10px functional text raised to 11px** — the legibility floor the detect gate enforces, with the same comment already committed in `page.module.css:298-303`.
5. **Streak wording is `sequência`**, never `dias seguidos` (`CONTEXT.md`; the Hoje smoke test's tripwire is extended to the new screens).
6. **Conclusion scope** — §12.3's table.
7. **Mobile page padding is 20px, not F4's 16px** — §12.2's arithmetic (impeccable `body-text-viewport-edge`), matching Hoje.
8. **The 390px conclusion card stacks** rather than reproducing F6's stamp-left/stats-right row, which loses its right-hand column once best/média are out of scope (§12.3).
9. **The conclusion CTA is solid ink, not `--accent-nonogram`** (§12.3), because its destination changed to Hoje.
10. **The violating-cell state is painted `--accent-app`** — DESIGN.md scopes that red to "streak, promo", so using it as the error colour is a third role and belongs here with its reason: it is the only red in the palette, and it is paired with `aria-invalid` and a doubled hairline so colour is never the sole carrier.

**Not a deviation — 38px mobile cells are the design system.** DESIGN.md:50 specifies "cells 52px desktop / **38px mobile**, gap 4px/3px" verbatim; PRODUCT.md:39's ≥44px rule governs chrome controls, and the `0`/`1`/`apagar` buttons are 60px tall. The arithmetic is supporting evidence, not an argument for an exception: 8×44 + 7×3 + 2×10 padding + 2 border = 395px > the 358px available inside a 390px viewport, so 44px is impossible at eight columns on a phone; the 38px cells with 3px gutters clear WCAG 2.2 AA 2.5.8 (24px + spacing) comfortably. This is cited, not dismissed, and it is **not** in the deviation list. If `impeccable detect` flags it, add a value-level entry to `.impeccable/config.json` carrying DESIGN.md:50 as the reason — never a new wildcard.

### 12.5 Hoje wiring

The binairo card's placeholder anchor becomes `<Link href={routes.binairo}>`; the other three stay href-less with their comment intact. `page.module.css` gains `.cta[href] { cursor: pointer; }` so only the live one gets the pointer.

`globals.css` sets `a:hover { color: var(--accent-app); }` globally. The handoff README wants per-screen hover accents, so each new module writes **`.page a:hover { color: var(--accent-binairo); }`** — anchored on a local class. A bare `a:hover` in a `.module.css` is not scoped: Next compiles CSS Modules in css-loader's `pure` mode, so it either fails the build ("Selector is not pure") or emits a global rule that turns Hoje's hover green. The `.page`-anchored form is what ships, stated here so the bare selector is never copied.

The smoke test's `toHaveLength(4)` assertions still hold and gain a link-target assertion.

### 12.6 The wordmark string

`messages.hoje.wordmark` already exists. Rather than a second and third copy, the wordmark is hoisted to **`messages.brand.wordmark`** and referenced from Hoje, `/binairo` and the conclusion — one product name, one source of truth (§13.1).

### 12.7 impeccable

`.github/workflows/impeccable.yml` gains the two new routes in **both** detect invocations (the tool takes a positional URL list; it does not crawl):

```
"$URL/?<bypass>" "$URL/binairo?<bypass>" "$URL/binairo/concluido?<bypass>" --viewport 1440x900
… --viewport 390x844
```

**The preview must be able to render `/binairo` before detect runs.** The workflow fires on `deployment_status` for `Preview – miolos-web`; without `DATABASE_URL` on that project `getDb()` throws, `/binairo` returns a server error, and detect scans an error page — and the workflow's own preflight comment records that detect "exits 0 on an empty or unreachable URL", so it would pass green while proving nothing. Provisioning the web role and its `DATABASE_URL` is therefore a **step-0** item (§17), not a step-8 one, and the PR evidence includes `curl -o /dev/null -w '%{http_code}' <preview>/binairo` returning 200 before the detect output.

**Residual, disclosed rather than discovered by a reviewer:** the *populated* conclusion composition cannot be URL-scanned. The CI scan covers its "ainda não concluído" state, which §12.3 specifies in full for exactly that reason. Compensating coverage: a file-mode run (`pnpm exec impeccable detect apps/web/app apps/web/src`) pasted in the PR, plus the jsdom smoke tests T-WEB-17..21 asserting the populated composition renders. Also disclosed: `.impeccable/config.json` wildcard-ignores `low-contrast` and `cream-palette` for `localhost` and `miolos-*.vercel.app`, so those two rules are blind on these screens (#51 tracks narrowing).

Invoke `pnpm exec impeccable detect` (pinned `impeccable@3.4.0`), never bare `npx`; one-time `pnpm exec puppeteer browsers install chrome` because `~/.npmrc` sets `ignore-scripts=true`.

---

## 13. i18n — the complete string inventory

### 13.1 `apps/web/src/i18n/messages.ts` — added top-level keys (exact syntax; the module grows by adding keys, nothing is restructured)

```ts
  brand: {
    wordmark: "Miolos",          // hoisted from hoje.wordmark; hoje now references brand
  },
  binairo: {
    back: "← Hoje",
    backAria: "Voltar para Hoje",
    kicker: "Lógica",
    title: "Binairo",
    rules:
      "Preencha a grade com zeros e uns. Cada linha e coluna tem quatro de cada, nunca três iguais seguidos, e nenhuma linha ou coluna se repete.",
    timerLabel: "Tempo",
    timerAria: (elapsed: string) => `tempo decorrido: ${elapsed}`,
    progressLabel: "Progresso",
    progressLong: (filled: number, total: number) =>
      `${filled} de ${total} células`,
    progressShort: (filled: number, total: number) => `${filled} de ${total}`,
    controls: {
      zero: "0",
      one: "1",
      erase: "apagar",
      zeroAria: "pintar zeros",
      oneAria: "pintar uns",
      eraseAria: "apagar células",
      affordance: "ou clique na célula para alternar",
    },
    cellAria: (row: number, column: number, value: 0 | 1 | null) =>
      `linha ${row}, coluna ${column}: ${value === null ? "vazia" : value}`,
    cellGivenAria: (row: number, column: number, value: 0 | 1) =>
      `linha ${row}, coluna ${column}: ${value}, célula fixa`,
    cellInvalidAria: "esta célula quebra uma regra",
    hint: {
      available: "Usar dica — 1 disponível",
      used: "Dica usada",
      explain: {
        correction: "Corrigimos uma célula que não fecha com as regras.",
        fill: "Preenchemos uma célula para você.",
      },
    },
    unavailable: {
      title: "O Binairo de hoje ainda não chegou.",
      body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
      cta: "Voltar para Hoje",
    },
  },
  conclusao: {
    back: "← Hoje",
    backAria: "Voltar para Hoje",
    kicker: "Lógica",
    title: "Binairo",
    stampLabel: "Concluído",
    stampAria: (elapsed: string, hints: number) =>
      `Binairo concluído em ${elapsed}, ${hints === 0 ? "sem dicas" : "com 1 dica"}`,
    hints: (used: number) => (used === 0 ? "sem dicas" : "com 1 dica"),
    sync: {
      pending:
        "Resultado guardado neste aparelho — sincroniza quando a conexão voltar.",
      rejected:
        "Não foi possível registrar este resultado no dia de hoje.",
    },
    dayCard: {
      title: "O dia até agora",
      missing: "falta",
      games: {
        termo: "Termo",
        sudoku: "Sudoku",
        nonogram: "Nonogram",
        nonogramShort: "Nono.",
        binairo: "Binairo",
      },
    },
    cta: "Fechar o dia — voltar para Hoje",
    stats: "Ver estatísticas",
    notYet: {
      title: "Você ainda não concluiu o Binairo de hoje.",
      body: "O resumo aparece assim que a grade fechar.",
      cta: "Jogar o Binairo de hoje",
    },
  },
```

Notes binding on the implementer: the em-dash `—` and the arrow `←` are load-bearing copy, not decoration; `Nono.` is a distinct mobile string, never a runtime truncation; every `aria-*` string is composed **here**, never in a component (the `hoje.streak.aria` precedent); `2 de 4` style interpolation is a plain arrow function returning a template literal — there is no ICU runtime and none is being added. `messages.hoje.wordmark` becomes a reference to `brand.wordmark` (§12.6), and the Hoje smoke test keeps asserting the same rendered string.

### 13.2 `apps/web/src/i18n/routes.ts`

```ts
export const routeSlugs = {
  archive: "arquivo",
  freePlay: "modo-livre",
  stats: "estatisticas",
  binairo: "binairo",
  conclusion: "concluido",
} as const;

/**
 * Composed paths. `as const` keeps these literal types, which Next 16's
 * typed routes require of a `<Link href>` — a function returning `string`
 * would not typecheck.
 */
export const routes = {
  home: "/",
  binairo: `/${routeSlugs.binairo}`,
  binairoConclusion: `/${routeSlugs.binairo}/${routeSlugs.conclusion}`,
} as const;
```

**`apps/web/src/i18n/index.ts` gains both new surfaces**, keeping the barrel the single import surface (ADR-0018). It currently exports only `locale`, `messages`/`Messages` and `routeSlugs`/`RouteSlug`, and every consumer in the repo imports from `../src/i18n`, so an unexported `routes` would break `<Link href={routes.binairo}>` and T-WEB-18:

```ts
export { routeSlugs, routes, type RouteSlug } from "./routes";
export { formatLongDate, formatShortDate, formatElapsed } from "./format";
```

### 13.3 `apps/web/src/i18n/format.ts` (new, exported from the i18n barrel)

```ts
/** "30 de julho de 2026" — formats the PUZZLE's date, never `new Date()`. */
export function formatLongDate(isoDate: string): string;
/** "30 jul" — mobile; composed from formatToParts so no "de" sneaks in. */
export function formatShortDate(isoDate: string): string;
/** "04:32" / "1:04:32" — count-up, tabular; total ms in, no Date involved. */
export function formatElapsed(totalMs: number): string;
```

`formatLongDate`/`formatShortDate` build the instant as `new Date(\`${isoDate}T12:00:00Z\`)` and format with `timeZone: "UTC"`: UTC noon of that calendar day formatted in UTC is exactly that calendar day, with no timezone arithmetic anywhere. `locale` comes from `i18n/locale.ts`, never a literal.

---

## 14. The ESLint duty (ADR-0024 §5 + its 2026-07-31 amendment)

**Two** new objects in the root `eslint.config.mjs`, inserted between the `packages/games/src/**` block and the trailing `prettier`. Flat-config semantics: both globs are disjoint from the games block, so nothing is replaced.

The split is not cosmetic. The **import** bans apply to all of `apps/web/**` — no apps/web file, test included, has any business importing a server-internal db subpath (D33 removes the only argument for a test exemption, since apps/web runs no PGlite). The **table-name literal** selectors apply to `apps/web/{app,src}/**` only, which is literally what ADR-0024's amendment says: "flag `daily_puzzles`/`remote_config` string literals in `apps/web` **source**". Without the split, `pnpm lint` (`eslint --max-warnings 0 .`; `eslint.config.mjs`'s `ignores` do not exclude `apps/web/test`) goes red on `apps/web/test/eslint-db-wall.test.ts`, whose T-LINT-5 probes *must* contain those exact strings. Verified in this repo against `eslint@10.8.0`: the `apps/web/**` glob reports `LIT-FIRED`/`TPL-FIRED` at that test path; the `apps/web/{app,src}/**` glob reports **zero** there and still fires under `apps/web/src/`.

```js
  {
    // (1) IMPORT BANS — all of apps/web, tests included. ADR-0024 §5 and its
    // 2026-07-31 amendment; a named #18 duty, live from the PR that gives
    // apps/web the @miolos/db dependency. apps/web is client-serving, so the
    // only db surface it may hold is the wall-safe root entry:
    //   - /publishing — raw tables, buffer writers, createPublishingDb,
    //     getPublishedDailyWithSolution;
    //   - /user — completions and hint grants; every write and every
    //     user-specific read belongs to apps/api (ADR-0007/0014);
    //   - /testing — createTestDb returns a FULL-schema drizzle client over
    //     daily_puzzles and pulls PGlite; apps/web runs no PGlite (plan 017
    //     D33), so it has no legitimate use for it either.
    // `.mts`/`.cts` included: a `.mts` file slipping a `.ts`-only glob is a
    // proven evasion vector (PR #48 step 6).
    files: ["apps/web/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@miolos/db/publishing",
                "@miolos/db/publishing/*",
                "@miolos/db/user",
                "@miolos/db/user/*",
                "@miolos/db/testing",
                "@miolos/db/testing/*",
              ],
              message:
                "apps/web is client-serving: import the wall-safe root entry `@miolos/db` only. `/publishing` carries the raw tables, the buffer writers and the solution-bearing reader; `/user` carries the completion and hint-grant writers, which belong to apps/api; `/testing` hands out a full-schema client (ADR-0024, ADR-0026).",
            },
          ],
          paths: [
            {
              name: "@miolos/db",
              importNames: ["sql", "eq"],
              message:
                "apps/web must not build queries: read the daily through `getTodayDaily`. Raw SQL via the re-exported `sql` bypasses the published-predicate wall (ADR-0024 amendment).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // no-restricted-imports cannot see dynamic specifiers.
          selector:
            "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
          message:
            "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
        },
      ],
    },
  },
  {
    // (2) TABLE-NAME LITERALS — apps/web SOURCE only, which is the ADR-0024
    // amendment's own wording. The residual it targets is raw SQL through the
    // root entry's re-exported `sql` / `.execute()`, which no import
    // restriction can see. apps/web/test/** is outside this glob on purpose:
    // the probe fixtures in test/eslint-db-wall.test.ts must contain these
    // exact strings to prove the rules fire, a test file ships to nobody, and
    // the import bans above still cover the whole app. T-LINT-7 pins the
    // exemption; T-LINT-8 pins that the rule still fires under src/.
    files: ["apps/web/app/**/*.{ts,tsx,mts,cts}", "apps/web/src/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\b(daily_puzzles|remote_config)\\b/]",
          message:
            "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
        },
        {
          selector:
            "TemplateElement[value.raw=/\\b(daily_puzzles|remote_config)\\b/]",
          message:
            "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
        },
      ],
    },
  },
```

The `TemplateElement` companion is **not** optional: without it, `` sql`select * from daily_puzzles` `` slips straight through the `Literal` selector. `\b` correctly spares `remote_configuration`; numbers and RegExp literals are not flagged.

**Proving each rule fires** — `apps/web/test/eslint-db-wall.test.ts`, using the real root config through the ESLint Node API. The harness is **pinned here, verified working**, because the obvious form throws instead of linting: disabling `projectService`/`project` does *not* remove the type-aware rules the root config enables via `tseslint.configs.recommendedTypeChecked`, and the first of them aborts the whole `lintText` call with `Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which requires type information…`. Spreading `disableTypeChecked` into the same override object is what makes it work (both rules under test are purely syntactic, so this weakens nothing):

```ts
import tseslint from "typescript-eslint";

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: path.join(repoRoot, "eslint.config.mjs"),
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: { parserOptions: { projectService: false, project: false } },
    },
  ],
});
const [result] = await eslint.lintText(probe, {
  filePath: path.join(repoRoot, "apps/web/src/eslint-probe.ts"),
});
```

No file is written to disk, so `pnpm lint` never sees a deliberately-broken *file*; the probe *strings* live in the test source, which the source-only glob above deliberately excludes. `eslint@10.8.0` and `typescript-eslint` are added to `apps/web` devDependencies (exact pins, already in the lockfile) because pnpm's isolated linker will not resolve a root devDep from a workspace.

---

## 15. Test plan (named)

House patterns honoured: one PGlite per **file** via `createTestDb()` in `packages/db` and `apps/api` only (D33 — none in `apps/web`), with `truncate … cascade` between tests; `vi.mock("../src/db", () => ({ getDb: () => ctx.db }))` as the only mock in api; route handlers invoked as plain functions with a `NextRequest`; every web assertion goes through `messages.*`, never a literal; no `as` in tests; no vitest globals (import `describe/it/expect/vi` explicitly).

**PGlite boot timeouts, stated not discovered:** `createTestDb()` measures 1.14 s locally (uncached full suite 37.8 s wall). Vitest's `beforeAll` default is 10 s and CI runners are ~3–4× slower, so `packages/db/test/user.test.ts` and `apps/api/test/completions.test.ts` both carry `beforeAll(async () => { … }, 30_000)` with the `1.2 s × 4 + margin` arithmetic in a comment (the sudoku suite's in-file convention).

**The async-server-component problem, solved once:** `@testing-library/react` cannot render an `async` server component. Both `page.tsx` files are therefore thin async shells whose only job is `getTodayDaily` + branch; **all** composition lives in the synchronous `BinairoScreen` / `ConclusionView` / `DailyUnavailable` components, which tests render directly. The shells are covered by `await BinairoPage()` and asserting on the returned element's props, plus a `renderToStaticMarkup` leak scan.

| ID | File | Proves | AC | Seam / kind |
|---|---|---|---|---|
| T-DB-10 | `packages/db/test/published.test.ts` | the existing wall suite still passes unchanged; **T-DB-9a/9b/9c/9d export lists are byte-identical** after this ticket (nothing was added to the root or publishing surfaces) | 1 | unit, PGlite |
| T-DB-9e | `packages/db/test/user.test.ts` | `@miolos/db/user` exports exactly the audited set (new tripwire, same shape as 9a-9c) | 2,4 | unit |
| T-DB-11 | `…/user.test.ts` | `recordCompletion` writes a row and returns `recorded: true` | 2 | integration, PGlite |
| T-DB-12 | `…/user.test.ts` | a second identical call returns `recorded: false`, **`completed_at` is unchanged**, and the returned record equals the first (a replay never reopens it) | 2 | integration |
| T-DB-13 | `…/user.test.ts` | a completion against a puzzle dated **today** derives `onTime: true`; one against a puzzle dated **yesterday** derives `onTime: false` — no time faking needed, the puzzle's date carries the case | 2 | integration |
| T-DB-14 | `…/user.test.ts` | **boundary, faked time, two distinct users**: with the clock at `2026-08-01T02:59:59Z` (= 23:59:59 SP on 07-31) user A's completion for `2026-07-31` is on time; at `2026-08-01T03:00:01Z` user **B**'s completion for the same date is late. Two identities are mandatory — the same user replaying hits `ON CONFLICT DO NOTHING` and re-reads the *original* `completed_at`, so a single-identity version would assert `true` twice. §19.4 records the verified clock mechanism | 2 | integration, faked clock |
| T-DB-15 | `…/user.test.ts` | the PK rejects a duplicate at the database level even when the writer is bypassed (raw insert → unique violation) | 2 | integration |
| T-DB-16 | `…/user.test.ts` | `grantedHintsToday` sums only rows dated SP-today | 4 | integration |
| T-DB-17 | `…/user.test.ts` | a grant dated SP-yesterday counts 0 — expiry with no job, no TTL, no update | 4 | integration |
| T-DB-18 | `…/user.test.ts` | a grant dated SP-tomorrow counts 0 | 4 | integration |
| T-DB-19 | `…/user.test.ts` | grants never accumulate across days: today 3 + yesterday 3 ⇒ 3 | 4 | integration |
| T-DB-20 | `…/user.test.ts` | **column-set tripwire**: `hint_grants` columns are exactly `id,user_id,date,source,hints,granted_at` (a future `hints_remaining`/`balance` fails the suite — mechanical ADR-0006 guard) | 4 | integration |
| T-DB-21 | `…/user.test.ts` | the CHECK constraints reject `outcome='draw'`, `hints=0`, `hints=11`, `source='shop'` (proves the migration carried them) | 2,4 | integration |
| T-CORE-1 | `packages/core/test/completion-contract.test.ts` | `binairoCompletionRequestSchema` rejects an extra key, a 63-length grid, a `null` cell, a negative `elapsedMs`, `elapsedMs` above one day, `hintsUsed: 2` | 2 | unit |
| T-CORE-1b | `…/completion-contract.test.ts` | `calendarDateString` rejects `2026-02-30`, `2026-13-01`, `0000-00-00` and accepts `2026-02-28`/`2024-02-29` — the shape regex alone would pass all three impossible dates into a Postgres `date` comparison | 2 | unit |
| T-CORE-2 | `…/completion-contract.test.ts` | `completionResponseSchema` round-trips and, run through `collectKeys`, contains no `FORBIDDEN_DAILY_KEYS` | 1,2 | unit |
| T-CORE-3 | `…/completion-contract.test.ts` | the request schema carries **no timestamp field of any kind** (asserted on the schema's key set — the structural D19 guarantee) | 2 | unit |
| T-API-1 | `apps/api/test/completions.test.ts` | route exports `dynamic === "force-dynamic"` and an `OPTIONS` handler | 1 | config-as-data |
| T-API-2 | `…/completions.test.ts` | no session cookie ⇒ 401, **no row written and no user minted** | 2 | integration, PGlite |
| T-API-3 | `…/completions.test.ts` | `Sec-Fetch-Site: cross-site` ⇒ 403, no DB touch | 2 | integration |
| T-API-4 | `…/completions.test.ts` | valid grid for today ⇒ 200, `recorded: true`, `onTime: true`, response parses `completionResponseSchema` | 2 | integration |
| T-API-5 | `…/completions.test.ts` | replaying the identical request ⇒ 200, `recorded: false`, identical body | 2,3 | integration |
| T-API-6 | `…/completions.test.ts` | a **different** grid replay returns 200 with the stored record and **never reaches the judge** (a spy on `getPublishedDailyWithSolution` records zero calls) — the step-4 short-circuit | 2 | integration |
| T-API-6b | `…/completions.test.ts` | replaying an already-recorded completion **after the puzzle is killed** still returns 200 with the stored record, not 404 — the short-circuit precedes the wall read, so a kill cannot make the client discard a completion the server holds | 1,2 | integration |
| T-API-7 | `…/completions.test.ts` | a wrong grid ⇒ 422 `grid-mismatch`, no row | 2 | integration |
| T-API-8 | `…/completions.test.ts` | a **future** date ⇒ 404 (the wall predicate, not an argument check), no row | 1,2 | integration |
| T-API-9 | `…/completions.test.ts` | a **killed** puzzle ⇒ 404, no row | 1,2 | integration |
| T-API-9b | `…/completions.test.ts` | a **published date two days old** ⇒ 404, no row — the D29 bound, so a stale record or a script cannot backfill the archive | 2 | integration |
| T-API-10 | `…/completions.test.ts` | a malformed body, an unknown `game` and `date: "2026-02-30"` each ⇒ 400 `invalid-body` (never a 500) | 2 | integration |
| T-API-10b | `…/completions.test.ts` | `Content-Type: text/plain` with `Sec-Fetch-Site: same-site` and no `Origin` ⇒ 415, no DB touch; a missing `Content-Type` likewise | 2 | integration |
| T-API-13 | `…/completions.test.ts` | **late at the api seam without a clock fake**: the same request against a puzzle published for SP-**yesterday** ⇒ 200, `onTime: false`; against SP-today ⇒ `onTime: true` | 2 | integration |
| T-API-14 | `…/completions.test.ts` | **late at the api seam with faked time** (AC 2's explicit wording): clock at 23:59:59 SP, session A POSTs `2026-07-31` ⇒ `onTime: true`; clock advanced past midnight, session **B** POSTs the same body ⇒ `onTime: false`. Two identities for the T-DB-14 reason | 2 | integration, faked clock |
| T-API-12 | `…/completions.test.ts` | the 200 body run through `collectKeys` contains no `FORBIDDEN_DAILY_KEYS` (a judging route must not leak the solution it just read) | 1 | integration |
| T-API-15 | `…/completions.test.ts` | with `WEB_ORIGIN` set, **every** status — 200, 400, 401, 403, 404, 415, 422 — carries `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` (D31: the status is the queue's control flow, so an unreadable error breaks §9.2 entirely) | 2,3 | integration |
| T-API-16 | `apps/api/test/session-origin-guard.test.ts` (extended) | the renamed `isCrossSiteWrite` keeps all seven behaviours, and `warnIfGuardDegraded` logs **once per instance** under `NODE_ENV=production` with `WEB_ORIGIN` unset | 2 | unit |
| T-WEB-1 | `apps/web/test/binairo-page.test.tsx` | `/binairo` exports `dynamic === "force-dynamic"` | 1 | config-as-data |
| T-WEB-2 | `…/binairo-page.test.tsx` | `/binairo/concluido` exports `dynamic === "force-dynamic"` and is an async **server** component | 1 | config-as-data |
| T-WEB-3 | `…/binairo-page.test.tsx` | with `getTodayDaily` mocked to `undefined`, `await BinairoPage()` renders the unavailable screen; with a daily it passes **only** `{game,date,size,givens}` — the props object's key set is asserted exactly — and `collectKeys` over `renderToStaticMarkup(await BinairoPage())` finds no `FORBIDDEN_DAILY_KEYS` | 1 | integration, `vi.mock("@miolos/db")` |
| T-WEB-4 | `…/binairo-page.test.tsx` | both pages call `getTodayDaily` and **nothing else** on the mocked `@miolos/db` module (every other export is a spy asserted never called) | 1 | integration |
| T-WEB-4b | `…/binairo-page.test.tsx` | `/binairo/concluido` derives its date from `getTodayDaily(...).date` and **not** from the client clock: with the mocked wall returning `2026-07-30` and `Date` faked to `2026-08-05`, the rendered `<ConclusionView>` receives `date === "2026-07-30"`; with `getTodayDaily` ⇒ `undefined` it renders `DailyUnavailable` | 1,3 | integration |
| T-WEB-23 | `…/binairo-page.test.tsx` | `apps/web/src/db.ts` **read as text** begins with `import "server-only";` (D32) — the same tripwire style as the export-list tests, so the guard cannot be removed silently | 1 | unit, source tripwire |
| T-WEB-5 | `apps/web/test/binairo-screen.test.tsx` | the rules blurb renders and contains the row **and column** clause (asserted through `messages.binairo.rules`, plus a literal tripwire that "nenhuma linha se repete." alone never appears) | 5,6 | jsdom smoke |
| T-WEB-6 | `…/binairo-screen.test.tsx` | 64 cells render; givens are non-interactive and carry the given aria; **two** timer nodes render `00:00` (the media-query pair, §12.2) and two progress nodes read the givens count; the `<h1>` is the first element child of its wrapper and `h1.previousElementSibling === null` (the impeccable structural guard, §12.2) | 5,6 | jsdom |
| T-WEB-7 | `…/binairo-screen.test.tsx` | tapping a non-given cell three times cycles `0 → 1 → empty`; tapping a given never changes | 5 | jsdom, `fireEvent` (no new dep) |
| T-WEB-8 | `…/binairo-screen.test.tsx` | pressing `0` sets paint mode (`aria-pressed`), a tap then writes 0 directly, pressing `0` again returns to cycle mode; `apagar` clears | 5 | jsdom |
| T-WEB-8b | `…/binairo-screen.test.tsx` | **the drag path**: `pointerdown` then two `pointermove`s with a stubbed `document.elementFromPoint` paint the crossed cells in paint mode, and paint nothing in cycle mode | 5 | jsdom |
| T-WEB-9 | `…/binairo-screen.test.tsx` | the hint button fills exactly one cell, becomes the exhausted variant with `messages.binairo.hint.used`, and a second press does nothing | 4 | jsdom |
| T-WEB-9b | `…/binairo-screen.test.tsx` | entering `solved` swaps `PlayView` for `ConclusionView` **in place** (the stamp renders, the grid is gone) with **no `next/navigation` call** — the mocked router's `push`/`replace` are asserted never called (D26, the offline guarantee) | 3,5 | jsdom |
| T-WEB-9c | `…/binairo-screen.test.tsx` | mounting `/binairo` with a `concluded: true` record for the server's date restores straight into `ConclusionView`; the timer never starts and no POST is issued | 2,3 | jsdom |
| T-WEB-9d | `…/binairo-screen.test.tsx` | **no hydration mismatch**: the first render (before effects flush) shows the givens-only grid and `00:00` with no record-derived content, and `localStorage`/`Date.now` are asserted untouched during render (spies installed before `render`, checked before `act` flushes) — D28 | 3,5 | jsdom |
| T-WEB-10 | `apps/web/test/binairo-hint.test.ts` | `nextHint` prefers a contradicting entry over an empty cell; is row-major deterministic; returns `null` on a complete correct grid — over all seven weekday puzzles from `generateBinairo` | 4 | unit, pure |
| T-WEB-11 | `…/binairo-hint.test.ts` | **table-driven over 7 weekdays × 20 in-file pinned seeds** (no fast-check — ADR-0017 keeps it in `packages/games` and this ticket adds no test dependency): `nextHint`'s value always equals `solveBinairo(givens)` at that index | 4 | unit, pure |
| T-WEB-12 | `apps/web/test/binairo-state.test.ts` | reducer: violations appear the moment a third identical digit lands and clear when it is removed; a violating grid is never blocked from further entry | 3,5 | unit, pure |
| T-WEB-12b | `…/binairo-state.test.ts` | `paint-over` is a no-op in cycle mode; in paint mode it **sets** and is idempotent over the same cell; in erase mode it clears; givens are untouched in every mode | 5 | unit, pure |
| T-WEB-13 | `…/binairo-state.test.ts` | `status` flips to `solved` only when `isSolvedGrid(merged) && isValidBinairoSolution(merged)`; a full-but-wrong grid stays `playing` | 3 | unit |
| T-WEB-14 | `…/binairo-state.test.ts` | timer: `pause`/`resume` accumulate correctly across a simulated hidden window; **`resume → resume → pause` accumulates the full interval** and **`pause → pause` does not double-count** (idempotency, §8.3); `pagehide` then `pageshow` with no `visibilitychange` leaves the clock running (bfcache); `tick` never changes the elapsed value | 5 | unit |
| T-WEB-14b | `…/binairo-state.test.ts` | `initPlayState` produces `hydrated: false`, empty entries and `00:00`; `restore` maps every field of a record (entries, accumulatedMs, hint.used, pendingSync, recomputed status, `hydrated: true`) and with `undefined` flips only `hydrated` | 3 | unit |
| T-WEB-15 | `apps/web/test/binairo-play-record.test.ts` | a record round-trips including `grid`; a tampered/garbage/wrong-version record parses to `undefined`; the key is derived from the **server's** date; an over-cap `elapsedMs` is clamped before write, never rejected; `prunePlayRecords` drops only older *synced* records | 3 | unit, jsdom localStorage |
| T-WEB-16 | `apps/web/test/binairo-sync.test.ts` | **with no play screen mounted** (import `sync.ts` directly, seed `localStorage`): the POSTed body parses `binairoCompletionRequestSchema` and is built from `record.grid` alone; a failed POST leaves `pendingSync: true`; an `online` event flushes it; a 200 clears it with `syncOutcome: "recorded"`; concurrent triggers post once (the in-flight guard) | 3 | jsdom, `vi.stubGlobal("fetch")` |
| T-WEB-16b | `…/binairo-sync.test.ts` | terminal/non-terminal classification: `404`, `422`, `400`, `415`, `403` ⇒ `pendingSync: false`, `syncOutcome: "rejected"`; `401` and `5xx` ⇒ still pending; a 401 re-runs `ensureSession()` once and retries once, then stops; the bounded in-page retry fires after a 5xx and stops after a 200; on `recorded: false` the server's `elapsedMs`/`hintsUsed` are written back into the record | 3 | jsdom |
| T-WEB-17 | `apps/web/test/conclusion-view.test.tsx` | the stamp renders the elapsed time and the hint line from `messages.conclusao.*`; `sem dicas` vs `com 1 dica` follow `hintsUsed` | 5,6 | jsdom |
| T-WEB-18 | `…/conclusion-view.test.tsx` | the day card renders Binairo as done and the other three as `falta`, and the CTA links to `routes.home` | 5 | jsdom |
| T-WEB-19 | `…/conclusion-view.test.tsx` | the sync line: `pending` renders only while `syncOutcome === "pending"`; **`rejected` renders on the rejected outcome and the pending line does not**; neither renders once recorded | 3 | jsdom |
| T-WEB-20 | `…/conclusion-view.test.tsx` | with no local record, the "ainda não concluído" state renders with a live link back to `routes.binairo`; before hydration it renders the skeleton, never the notYet card (D28) | 5 | jsdom |
| T-WEB-21 | `apps/web/test/hoje.smoke.test.tsx` (extended) | the Binairo card links to `routes.binairo`; the other three stay href-less; the four CTA counts still hold; `messages.brand.wordmark` still renders on Hoje; the `dias seguidos` tripwire is extended to both new screens | 5,6 | jsdom |
| T-WEB-22 | `apps/web/test/i18n-format.test.ts` | `formatLongDate("2026-07-30")` and `formatShortDate` render the **puzzle's** day regardless of the host timezone (run with `TZ` unset and with a UTC+13 offset); `formatElapsed` renders `04:32` and `1:04:32` | 5,6 | unit |
| T-LINT-1..3 | `apps/web/test/eslint-db-wall.test.ts` | importing `@miolos/db/publishing`, `@miolos/db/user`, `@miolos/db/testing`, and `import type` of any, each report `no-restricted-imports` | duty | unit, ESLint API |
| T-LINT-4 | `…/eslint-db-wall.test.ts` | `await import("@miolos/db/publishing")` reports `no-restricted-syntax`; `await import("@miolos/db")` reports nothing | duty | unit |
| T-LINT-5 | `…/eslint-db-wall.test.ts` | at an `apps/web/src/**` path: `"daily_puzzles"`, `` `… remote_config …` `` and an interpolated template each report; `"remote_configuration"` does not | duty | unit |
| T-LINT-6 | `…/eslint-db-wall.test.ts` | a clean apps/web file (importing `getTodayDaily` from `@miolos/db`) reports **zero** — the rules are not blanket bans | duty | unit |
| T-LINT-7 | `…/eslint-db-wall.test.ts` | the same table-literal probe at an `apps/web/test/**` path reports **zero** — the source/test split of §14 is itself pinned, so nobody "fixes" the glob back and reds the lint gate | duty | unit |
| T-LINT-8 | `…/eslint-db-wall.test.ts` | the **import** bans still fire at an `apps/web/test/**` path — the split narrows only the literal rules, never the wall | duty | unit |

Kinds: **unit** = pure functions, no DOM, no DB. **integration** = a real PGlite running the committed migrations, or a route handler invoked as a function. **No property tests are added** (§3).

---

## 16. Branch, commits, PR, rollout

**Branch**: `feat/18-play-the-daily-binairo` (already correct), rebased on freshly pulled `main` before the step-6 gate run.

**Commits** (Conventional, English, each pre-commit-green, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`):

1. `docs: add the play-the-daily-binairo plan (017) for #18`
2. `docs: ADR-0026 (completions), ADR-0027 (hints), ADR-0028 (game routes)` — **before implementation**, per CLAUDE.md
3. `feat(core): completion contracts, outcome vocabulary and the error envelope`
4. `feat(db): completions and hint_grants tables with migration 0002`
5. `feat(db): user-scoped entry with write-once completions and dormant hint grants`
6. `feat(api): POST /completions judged against the stored solution`
7. `feat(web): binairo play screen with tap-to-cycle, paint mode and local validation`
8. `feat(web): binairo conclusion view and offline completion sync`
9. `feat(web): one free hint computed from the published givens`
10. `chore(lint): ban the server-internal @miolos/db subpaths and table literals in apps/web`
11. `ci: scan the binairo and conclusion routes with impeccable`

**Verification (evidence rule — paste real output), from the repo root:**

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
pnpm install                 # lockfile: @miolos/db, @miolos/games, server-only, zod, eslint, typescript-eslint in apps/web
pnpm typecheck --force
pnpm lint
pnpm test --force            # full suite, uncached
pnpm build                   # + the route's First Load JS figure (§19.1)
pnpm exec impeccable detect apps/web/app apps/web/src            # file mode
curl -o /dev/null -w '%{http_code}\n' '<preview>/binairo'        # must be 200 BEFORE detect (§12.7)
pnpm exec impeccable detect <preview>/ <preview>/binairo <preview>/binairo/concluido --viewport 1440x900
pnpm exec impeccable detect <same three URLs> --viewport 390x844
```

Plus a deliberate-violation `pnpm lint` run proving the new rules go red, pasted alongside the clean one.

**PR skeleton**: `Closes #18.` → **What changed** (one bold-package bullet per workspace, plus an explicit "not touched" paragraph naming `packages/games`, `packages/ui`, `adSlotPlacements`, `clientSchema`, the root `@miolos/db` surface and the existing wall suite) → **Verification** (every output above inline) → **Implementation notes** (departures from this plan's letter) → **Frame deviations** (§12.4's ten, each with its reason) → **Step-8 rollout** checkboxes → **Decisions surfaced (FYI)**: D3 web-reads-db as an ADR-0014 widening, D17 the `/user` subpath, D20 client-side hint, D26 the in-place conclusion, D29 the two-day date bound, §7.3's accepted no-rate-limit posture, §12.3's conclusion scope table, §12.7's impeccable residual.

**Decisions needed from Fernando — one, and it must not be merged past silently:**

> **D19 vs issue #18's own text.** The issue states as a requirement: *"A connection drop mid-puzzle never costs the day: the player keeps solving and the completion syncs when connectivity returns."* D19 delivers the opposite in one window: solve offline at 23:58, reconnect at 00:05, and `completed_at` is the server write instant, so the day derives as **late** and the streak breaks. CLAUDE.md requires this contradiction to be surfaced rather than resolved by the agent. Two real options:
>
> 1. **Accept the window.** Amend issue #18's wording and record the window as an ADR-0026 consequence; file the follow-up issue **before** merge, not after. This is what the plan implements today.
> 2. **Close it server-side without the client clock.** Either the POST carries an offline attestation the server clamps into `[now() - bounded_grace, now()]`, or `on_time` derives against `greatest(completed_at, puzzle_day_start)` within a bounded grace defined in the ADR. Both keep the client clock out of streak arithmetic; both change ADR-0008's definition of on-time, which ADR-0009 recomputes streaks from — a decision of weight, not an implementation detail.
>
> Nothing else in the plan blocks on this: the schema, the route and the client are identical under either option, and option 2 is an additive change to the derivation expression plus its tests.

**Step-8 production rollout, in order, evidence pasted into the PR/issue:**

- **E1.** *(amended at step 5 — see §20; the provisioning half is descoped.)* **Verify** that `DATABASE_URL` is present on the **miolos-web** Vercel project in Production, Preview and Development (`vercel env ls`), and leave it alone — it is integration-managed, and hand-overwriting it risks a silent re-sync. Napkin gotcha if you pull it: `vercel env pull` appends `.env*` to `.gitignore` — revert that line afterwards. Then **file the least-privilege-role follow-up issue** carrying §5.3's SQL and its rationale verbatim, and link it from the PR. Provisioning the role and rotating the live credential is that issue's work, not this PR's.
- **E2.** Confirm the preview rendered: `curl -o /dev/null -w '%{http_code}' <preview>/binairo` ⇒ 200.
- **E3.** Apply migration 0002 to production, **unpooled** URL only:
  `source apps/api/.env.local && DATABASE_URL_UNPOOLED=$DATABASE_URL_UNPOOLED pnpm --filter @miolos/db db:migrate` — additive, safe to run before the deploy. Paste the output. **Nothing automates this; skipping it means the deployed code 500s.**
- **E4.** Verify the tables: `psql "$DATABASE_URL_UNPOOLED" -c "\d completions" -c "\d hint_grants"`.
- **E5.** Merge → both projects auto-deploy.
- **E6.** Load `https://miolos.app/binairo` in a real browser; solve it; confirm the conclusion renders in place and that `select * from completions` shows exactly one row with `on_time` deriving true.
- **E7.** Replay the POST with `curl` (same cookie) → 200 `recorded: false`, and `completed_at` unchanged in the database.
- **E8.** Offline drill: load `/binairo`, kill the network, finish the puzzle, confirm the conclusion renders **in place** with the pending sync line, restore the network, confirm the row appears without a reload.
- **E9.** `pnpm exec impeccable detect` against the **production** URLs at both viewports; paste both outputs.
- **E10.** File the follow-ups this plan owes: the D19 decision issue (per Fernando's call), and `nextBinairoDeduction` (§10.4).
- **E11.** Close #18 quoting E2–E10 against the six ACs.

---

## 17. Build order

Steps 1–4 are the critical path; 5A/5B/5C touch disjoint file sets and run in parallel; 6 serializes because it consumes all of them.

| # | Step | Files | Parallel? | TDD |
|---|---|---|---|---|
| 0 | **Already satisfied — verify only** (amended at step 5, §20). `DATABASE_URL` is present on the miolos-web Vercel project across all three environments via the Neon–Vercel integration, so the preview can render `/binairo` and `impeccable detect` scans a real page (§12.7). Confirm it is there; do **not** rotate it. The least-privilege `miolos_web` role (§5.3) is a follow-up issue, not a step here | infra only | — | — |
| 1 | **ADRs 0026 / 0027 / 0028** — written first, because steps 2, 3, 4 and 6 hard-code the decisions they carry (CLAUDE.md: "propose an ADR before implementing") | `docs/adr` | — | — |
| 2 | `packages/core`: `completion.ts`, `contracts/completion.ts` (incl. `calendarDateString`), barrel exports | core | after 1 | **yes** — T-CORE-1..3 first |
| 3 | `packages/db`: schema tables, migration 0002, `src/completions.ts`, `src/user.ts`, `package.json#exports` | db | after 2 | **yes** — T-DB-9e, 11..21 first |
| 4 | `apps/api`: `requireUserId`, the `isCrossSiteWrite` rename + exported `warnIfGuardDegraded`, `app/completions/route.ts` | api | after 2+3 | **yes** — T-API-1..16 first |
| 5A | apps/web **plumbing**: deps, `transpilePackages`, `src/db.ts` (+ `server-only`), `src/session/bootstrap.ts`, `.env.example`, both `page.tsx` shells, `DailyUnavailable` | web (app shell) | ∥ 5B, 5C | yes — T-WEB-1..4b, 23 |
| 5B | apps/web **logic**: `state.ts`, `hint.ts`, `play-record.ts`, `sync.ts`, `i18n/format.ts`, `i18n/messages.ts`, `i18n/routes.ts`, `i18n/index.ts` | web (src/binairo, src/i18n) | ∥ 5A, 5C | **yes, strictly** — these are pure functions; T-WEB-10..16b, T-WEB-22 first |
| 5C | **ESLint duty** (both config objects) + its test + the impeccable workflow edit | `eslint.config.mjs`, `.github/workflows/impeccable.yml`, `apps/web/test/eslint-db-wall.test.ts` | ∥ 5A, 5B | **yes** — write the failing probe first (a rule with no red proof is not a gate) |
| 6 | apps/web **screens**: `binairo-screen.tsx` + module, `play-view.tsx`, `grid.tsx`, `controls.tsx`, `timer-readout.tsx`, `use-binairo-play.ts`, `conclusion-view.tsx` + module, the Hoje `<Link>` | web | after 5A+5B | smoke tests after (T-WEB-5..9d, 17..21) — UI composition is not TDD-shaped |
| 7 | Full gate + both impeccable modes + the deliberate-violation lint run | — | — | — |

The reducer/hint/record/sync split (5B) exists precisely so the gameplay logic is unit-testable without jsdom and the screens (6) are thin. **There is no clock spike:** §19.4 records the verified result.

---

## 18. New ADRs (declared here, written at build step 1)

Three decisions in this plan are technical decisions of weight and get an ADR **before implementation** (CLAUDE.md). `docs/README.md` lists `adr/` as a directory, not per-file rows, so no README row is owed for them — only the plan's own row, which already ships in commit 1.

- **ADR-0026 — "Completions are write-once rows; on time is derived, never stored"** — the `(user_id, game, date)` primary key as the exactly-once mechanism, `ON CONFLICT DO NOTHING` over upsert, the route's idempotent short-circuit *before* the wall read and the judge, the SQL derivation `(completed_at at time zone 'America/Sao_Paulo')::date = date`, idempotent-replay response semantics, the `@miolos/db/user` package surface (D17), the two-day date bound (D29), and the late-by-sync window (D19, pending Fernando's call). **Consequences must include:** (a) the ADR-0009 merge re-points rows with `ON CONFLICT (user_id, game, date) DO NOTHING` after ordering by `completed_at`, so the surviving row is the earliest completion and a merge can never downgrade on-time to late; (b) the module-graph wall and the least-privilege Neon grant are two independent enforcement points; (c) the accepted no-rate-limit posture for the repo's first authenticated write, **amending ADR-0022's "flood-minted rows are unreferenced and harmless"**, which this ticket falsifies — flood-minted users can now write completion rows.
- **ADR-0027 — "The hint is computed on the client; only the accounting is server-side"** — why `solveBinairo(givens)` recovering today's solution client-side is compatible with ADR-0004, why the free hint is not a grant, the append-only day-scoped `hint_grants` shape and why it is not a balance, and the deferral of `nextBinairoDeduction`. **Consequences must include:** (a) `completions.hints_used` is self-reported and therefore can never back a "sem dicas" medal — an explicit narrowing of ADR-0006's "Server-side matters if any curated medal ever depends on 'solved without hints'"; (b) v1 records no consumption of *granted* hints, so the rewarded-ad ticket adds both the consumption record and a **server-computed granted-hint seam** (a call that checks `grantedHintsToday` minus consumption and returns the revealed cell) — the dormant table is activatable, not decorative.
- **ADR-0028 — "Daily play lives at `/<jogo>`, the conclusion at `/<jogo>/concluido`"** — the URL shape for all four games; why the conclusion is **both** an in-place state on the play route (so finishing offline needs no navigation and no service worker) **and** a real route (bookmarkable, reloadable, scannable); that route slugs stay in `i18n/routes.ts` with a literal-typed path map; the standing prohibition on `generateStaticParams` over dates for the future archive route; and the explicit **ADR-0014 scope extension** — the play route is public, unauthenticated and helper-gated, but `force-dynamic` and interactive rather than cacheable-SEO, and `apps/web` now holds a `DATABASE_URL` (least-privilege role, §5.3).

Everything else here is plan-level and recorded in code TSDoc: D6–D13, D18, D23–D25, D28, D30–D33.

---

## 19. Risks and landmines (carry into implementation)

1. **`@miolos/games` in the client bundle — decided, not deferred.** The subpath barrel re-exports `generateBinairo` and `validateBinairo`, which the play screen never calls. `sideEffects: false` is declared and the package is pure, so Turbopack should tree-shake them. **Measure** the route's First Load JS in `pnpm build` and paste it in the PR. If generation code lands, the sanctioned fix is to make the existing barrel tree-shakeable — **not** a `./binairo/play` sub-barrel (ADR-0019 fixes the exports map at one subpath per game, which #23/#25/#27 follow verbatim) and **not** a deep import into `src/binairo/solve` (ADR-0019 makes `src/<game>/index.ts` the public API). If tree-shaking genuinely cannot be fixed, record the measured cost in the PR and file a follow-up; do not violate ADR-0019 in this ticket.
2. **Async server components cannot be rendered by RTL.** The shell/presentational split (§15) is not optional; discovering this at test-writing time is a rewrite.
3. **`.returning()` must be bare** on the union `Db`. Two landed comments already record this trap; the completion insert is the third occurrence.
4. **PGlite's clock — verified, no spike needed.** `vi.useFakeTimers({ toFake: ["Date"] })` **does** move Postgres `now()` under `@electric-sql/pglite@0.5.4`: measured in this repo, `(now() at time zone 'America/Sao_Paulo')::date` returned `2026-07-31` at a faked `2026-08-01T02:59:59Z` and `2026-08-01` at `2026-08-01T03:00:01Z`. Fake **only** `Date` — faking `setTimeout`/`queueMicrotask` risks stalling PGlite's async wasm pump. The dependent tests (T-DB-14, T-API-14) each need **two identities**, not a replay (§15). AC 2's "with faked time" is met directly; T-API-13 additionally proves late derivation at the same seam with no fake at all.
5. **Migration 0002 must be applied to Neon manually** before or with the deploy (E3), through `DATABASE_URL_UNPOOLED` only. Nothing in CI or Vercel runs migrations. `createTestDb` replays the committed artifact, so the whole db suite is red until the generated SQL is committed untouched.
6. **The late-by-sync window (D19)** is a real product harm and is **escalated to Fernando** (§16), not accepted by the agent. Implement D19 as written until he calls it.
7. **CI runners are ~3–4× slower than local.** The two PGlite-backed new files carry explicit `beforeAll` timeouts with the arithmetic in a comment (§15).
8. **The tripwires bite deliberately.** T-DB-9a/9b/9c/9d must come out of this ticket **unchanged** — if any of them needs editing, something was added to the wrong surface. T-DB-9e and T-WEB-23 are the only new tripwires.
9. **`display: contents` is not used anywhere** (§12.2). It cannot move a node across subtrees, which is why the mobile reflow is a CSS grid with named areas and two readout nodes instead.
10. **`impeccable detect` is a policy gate, not a required check** — `gate` is the only required context on `main`. A red `detect` still blocks the merge under CLAUDE.md. New by-design findings get a **value-level** entry in `.impeccable/config.json` with a written reason, never a new wildcard. The two structural traps are already closed in §12.2 (`h1.previousElementSibling === null`) and §12.3 (`stamp-settle`, `--ease-settle` inside the bezier range).
11. **`turbo` runs in `envMode: strict`.** `DATABASE_URL` is already in `tasks.build.env`; anything new must be added there or it is stripped from the build.
12. **The `min-release-age=3` npm cooldown** applies to every new dependency; `save-exact=true` means exact pins. `eslint@10.8.0`, `typescript-eslint` and `zod@4.4.3` are already in the lockfile; `server-only@0.0.1` was published in 2022, so no cooldown applies to any of them.
13. **The plan's `docs/README.md` row ships in commit 1.** A missing row has been a blocking review finding six times in this repo.
14. **Do not ship the `.dc.html` frames.** They are visual specs; `support.js` is a viewer harness with zero production relevance.
15. **CSS Modules are compiled in `pure` mode.** A bare type selector (`a:hover`, `p`, `button`) either fails the build or leaks globally — every rule in the two new modules is anchored on a local class (§12.5).

---

## 20. Review findings and dispositions (step 3 → step 4)

Six adversarial lenses; every blocking and major finding is listed with where it landed. Verified claims were re-checked against the real files before being written in; three findings are **dismissed with evidence**. One item was **descoped at step 5 by the orchestrator** — recorded in the trailing subsection, so the audit trail does not depend on reading the diff.

### adr-adherence

| # | Sev | Disposition |
|---|---|---|
| 1 | B | **Fixed** — §14 split into two config objects; import bans stay on `apps/web/**`, table-name selectors scoped to `apps/web/{app,src}/**` per ADR-0024's own wording. Verified: the wide glob reports `LIT-FIRED`/`TPL-FIRED` at `apps/web/test/eslint-db-wall.test.ts`; the narrow one reports zero there and still fires under `src/`. T-LINT-7/T-LINT-8 pin both halves. |
| 2 | B | **Fixed** — §14 harness pins `...tseslint.configs.disableTypeChecked` in the override object. Verified: the plan's original snippet threw `Error while loading rule '@typescript-eslint/await-thenable'`; the corrected one lints clean. `typescript-eslint` added to apps/web devDeps (§5.3). |
| 3 | B | **Fixed** — D27: `/binairo/concluido` is an async **server** component resolving the SP day from `getTodayDaily(db,"binairo").date`; `undefined` ⇒ `DailyUnavailable`. Same string feeds `prunePlayRecords`. T-WEB-4b asserts a wrong client clock changes nothing. |
| 4 | B | **Fixed** — §9.1 adds `syncOutcome: "pending" \| "recorded" \| "rejected"`; §9.2 sets `rejected` on 400/403/404/415/422; §13.1 adds `conclusao.sync.rejected`. T-WEB-19 extended. |
| 5 | B | **Fixed** — T-WEB-11 is table-driven (7 weekdays × 20 pinned seeds). No fast-check enters apps/web; ADR-0017 untouched. §3 states the rule. |
| 6 | M | **Fixed** — reader renamed `grantedHintsToday`; §11 replaces the unqualified "attaches rather than migrates" with the precise claim (grant table attaches, consumption is the rewarded-ad ticket's own additive work) and ADR-0027 names the server-computed granted seam. |
| 7 | M | **Fixed** — ADRs are build step **1** and commit **2**. |
| 8 | M | **Fixed** — D3 no longer claims ADR-0014's "exact sanctioned case" (verified: ADR-0014 says *cacheable*, `/binairo` is `force-dynamic`); the widening is folded into ADR-0028, the circular "triggers the ESLint duty" reason is withdrawn, and the credential is a least-privilege role (§5.3). |
| 9 | M | **Fixed** — §19.1 decides: keep the single `@miolos/games/binairo` import; no sub-barrel (ADR-0019's one-subpath rule), no deep import (ADR-0019's public-API rule); measure and, if unfixable, record + follow up. |
| 10 | M | **Fixed** — the fallback is gone: the clock mechanism is empirically verified (§19.4). T-API-13 additionally gives seam-level late derivation with no fake. |
| 11 | m | **Fixed** — §12.4 moves the 38px cells out of the deviation list and cites DESIGN.md:50 (verified verbatim) as the authority; the arithmetic stays as supporting evidence. |
| 12 | m | **Fixed** — §1 is a table with issue numbers (verified against `gh issue list`): #19, #20, #29, #34, #31, #28, #32, #33. §12.3's scope table carries the same numbers. |
| 13 | m | **Fixed** — §13.2 states the barrel additions verbatim. |

### issue-ac

| # | Sev | Disposition |
|---|---|---|
| 1 | B | **Fixed** — D26: no navigation exists to specify. `status === "solved"` swaps `PlayView` for `ConclusionView` in place; T-WEB-9b asserts the swap **and** that `next/navigation`'s `push`/`replace` are never called. |
| 2 | B | **Fixed** — same decision, and it is the reason for it: a `force-dynamic` route with no service worker is unreachable offline, so the conclusion never depends on one. `/binairo/concluido` stays `force-dynamic` for the bookmark/scan path only; T-WEB-2 is unchanged and now correct (it is a server segment). E8 drills it. |
| 3 | B | **Fixed** — §16 gains a **Decisions needed from Fernando** block with both options spelled out; the "none" line is deleted; risk 6 restated as escalated, not accepted. |
| 4 | B | Duplicate of adr-1 — **fixed** there. |
| 5 | B | **Fixed** — D28: nothing reads `localStorage`/`Date.now()` during render; `hydrated` gates every record-derived branch; first paint is a givens-only grid / a skeleton card, never the notYet card. Both `page.tsx` files are server components, so `export const dynamic` is legal. T-WEB-9d and T-WEB-20 assert it. |
| 6 | M | **Fixed** — §9.2 adds a fifth trigger: bounded in-page retry 2/5/15/60 s while visible and pending. T-WEB-16b covers it. |
| 7 | M | **Fixed** — T-WEB-12b (reducer, pure) and T-WEB-8b (jsdom drag with a stubbed `elementFromPoint`). |
| 8 | M | Duplicate of adr-10 — **fixed** there. |
| 9 | M | **Fixed** — D33 removes PGlite from apps/web entirely; T-WEB-3/4 use `vi.mock("@miolos/db")` + `renderToStaticMarkup`. |
| 10 | m | **Fixed** — `isSolvedGrid` type guard in §8 (verified: `toSolvedGrid` lives in `internal.ts` and is not exported from the binairo subpath); §10.1 defines `solveBinairo`'s `null` branch. |
| 11 | m | **Fixed** — §12.3 decides re-entry: a `concluded` record for the server's date restores straight into `ConclusionView`. T-WEB-9c. |
| 12 | m | **Fixed** — §12.6 hoists the wordmark to `messages.brand.wordmark`; §10.3 records the client-side-cap posture and ADR-0027 carries it. |

### correctness

| # | Sev | Disposition |
|---|---|---|
| 1 | B | **Fixed** — §9.1 persists the solved merged `grid`; §9.2 builds the body from it alone; T-WEB-16 flushes with **no play screen mounted**. |
| 2 | B | **Fixed**, but by the opposite route to the one proposed: with D33 there are no apps/web PGlite tests, so nothing in apps/web ever needs `@miolos/db/publishing`, `sql`/`eq` or a `daily_puzzles` literal. The import bans therefore stay **absolute** on `apps/web/**` (a carve-out would have been the weakened-wall finding the reviewer warned about), and only the table-literal selectors narrow to source. |
| 3 | B | **Fixed** — §7.3 step 4 is the idempotent short-circuit, before the wall read and the judge. T-API-6 asserts the judge is never reached; T-API-6b covers the killed-puzzle replay. |
| 4 | M | **Fixed** — D31: every return carries `corsHeaders({credentials:true})`; T-API-15 asserts it on all seven statuses. |
| 5 | M | **Fixed** — `calendarDateString` in §6.4 (`isoDateString` stays shape-only for server-derived values); T-CORE-1b and T-API-10. |
| 6 | M | **Fixed** — §8.3 makes `pause`/`resume` idempotent, with the reason; T-WEB-14 asserts both directions. |
| 7 | M | **Fixed** — `pageshow → resume` registered; initial running state derived from `document.visibilityState`; T-WEB-14 covers the bfcache case. |
| 8 | M | Duplicate of issue-ac-5 — **fixed** there (D28). |
| 9 | M | **Fixed** — `initPlayState(daily)` and the `restore` action are specified field by field in §8/§8.3; T-WEB-14b. |
| 10 | M | **Fixed** — 400 (and 403/415) added to the terminal set; `elapsedMs` clamped client-side before persist and post; the `rejected` UI line added. |
| 11 | M | **Fixed** — §19.4 records the verified mechanism, the fallback is deleted, and the `§19.3` cross-references are corrected to §19.4. |
| 12 | M | **Fixed** — D33. |
| 13 | M | **Fixed** — `zod@4.4.3` added to apps/web dependencies in §5.3 (verified: `apps/web/package.json` had none). |
| 14 | m | Duplicate of issue-ac-10 — **fixed** there. |
| 15 | m | **Fixed** — §9.2 writes the server's `elapsedMs`/`hintsUsed` back on `recorded: false`; T-WEB-16b. |
| 16 | m | **Fixed** — `ensureSession()` extracted to `src/session/bootstrap.ts` and awaited by the flush; one re-mint + retry on 401. |
| 17 | m | **Fixed** — the merge `ON CONFLICT … DO NOTHING` ordering rule is in §6.2's TSDoc and is a required ADR-0026 consequence. |

### security

| # | Sev | Disposition |
|---|---|---|
| 1 | B | Duplicate of correctness-1 — **fixed** there, including the TSDoc line explaining why a solved published grid in `localStorage` is inside ADR-0027's argument. |
| 2 | B | Duplicate of correctness-4 — **fixed** there (D31, T-API-15). |
| 3 | M | **Fixed** — D30: `Content-Type: application/json` required, 415 otherwise, before the body is read. T-API-10b covers `text/plain` + `same-site` + no `Origin`. |
| 4 | M | Duplicate of correctness-5 — **fixed** there. |
| 5 | M | **Fixed** — D29 bounds the accepted date to SP-today or SP-yesterday; T-API-9b. #31 widens it deliberately. |
| 6 | M | **Fixed** — §7.3 records the write-endpoint abuse posture and its revisit trigger; ADR-0026 must amend ADR-0022's "unreferenced and harmless" claim (verified verbatim in ADR-0022's Consequences). |
| 7 | M | **Fixed** — §5.3 provisions a distinct `miolos_web` Neon role with `usage on schema public` + `select on daily_puzzles` and nothing else; it is a **step-0** item with its grants verified at E1, and ADR-0026 records the two independent enforcement points. |
| 8 | M | **Fixed** — D32: `import "server-only";` in `apps/web/src/db.ts`, `server-only@0.0.1` added (verified: not currently in the store), T-WEB-23 pins it as a source tripwire. Kept off `page.tsx` deliberately, so `vi.mock("../src/db")`-free tests can still import the shell. |
| 9 | M | **Fixed** — D25 extended: `warnIfGuardDegraded` moves into `src/session/origin-guard.ts` and is exported; both routes call it; T-API-16. |
| 10 | M | **Fixed** — see correctness-10 and issue-ac-6. **Partially dismissed:** no `attempts` field is added to `playRecordSchema`. With 400/403/415 terminal, the in-page retry bounded to four attempts, and the 401 path re-minting once and stopping, the worst case is a handful of POSTs per page load — a counter would add a persisted field and a migration-shaped concern for no additional protection. |
| 11 | M | **Fixed** — §10.3 records the posture, ADR-0027 carries both required consequences, and `hintsUsed` is aligned to `.max(1)` on the wire (§6.4). |
| 12 | m | **Fixed** — §7.3 step 7 compares all 64 cells with no early exit, with the reason and the #27 duty in a comment. |
| 13 | m | **Fixed** — `@miolos/db/testing` added to the banned group (and to the dynamic-import selector); D33 means apps/web has no legitimate use for it. |
| 14 | m | **Fixed** — §7.2 names `apps/api/test/session-origin-guard.test.ts` (verified: no `origin-guard.test.ts` exists) and calls out the `describe` title and the seven call sites. |

### design-fidelity

| # | Sev | Disposition |
|---|---|---|
| 1 | B | **Fixed** — verified against `checks.mjs` (`checkHeroEyebrow`:407-456, `collectKickerCandidates`:2490+, `KICKER_CARD_CONTEXT_SELECTOR`:2413, the h1≥48 deferral:2530). The chosen fix is structural and applies to **both** screens (the reviewer flagged only `/binairo`; the conclusion's 52px `<h1>` would fire `hero-eyebrow-chip` too, and `<article>` does not exempt that rule): the `<h1>` is always the first element child of a `.titleRow` wrapper, so `h1.previousElementSibling === null` and both rules return on their first guard. DOM order stays kicker-first as the frames draw it. T-WEB-6 pins the structure. |
| 2 | B | **Fixed** — `display: contents` is gone (risk 9 rewritten). §12.2 is a CSS grid with named areas plus two `TimerReadout` / two progress nodes on the shipped `.ctaLong`/`.ctaShort` media-query precedent; `.label` spans live in the desktop-only stats card, so nothing needs hiding. |
| 3 | M | **Fixed** — two breakpoints: 1040px (the arithmetic is written out) for the single-column switch, 768px for the cell/type step-down. |
| 4 | M | **Fixed** — §12.3 splits the conclusion top bar per viewport (F5 wordmark + in-card kicker; F6 top-bar kicker, no card kicker) and §12.6 supplies `brand.wordmark`. |
| 5 | M | **Fixed** — §12.3 writes the 390px conclusion composition explicitly (stacked card) and records it as deviation 8. |
| 6 | M | **Fixed** — §12.2 gains a control-button spec table with the frame values, including `apagar`'s ink-tinted shadow as a recorded DESIGN.md exception and the mobile flex ratios. |
| 7 | M | **Fixed** — §12.5 writes `.page a:hover`, with the css-loader `pure`-mode reason; risk 15 added. |
| 8 | M | **Fixed** — deviation 9: solid ink (`--ink` / `--paper-desk` / `--shadow-sm --line`), which is F5's own non-game-button treatment. `--accent-nonogram` reserved for #25. |
| 9 | M | **Fixed** — §12.3 specifies the `stamp-settle` mount keyframe with concrete values, the `prefers-reduced-motion` alternative, and the note that `--ease-settle`'s 1.05 is inside impeccable's `[-0.1, 1.1]` band (verified at checks.mjs:496) and that the keyframe name avoids the `/bounce|elastic|…/` regex (checks.mjs:484). |
| 10 | M | **Fixed** — §12.3 gives the "ainda não concluído" card a full spec (paper, border, radius, shadow, rotation, tape geometry, type scale, CTA). |
| 11 | m | **Fixed** — tape geometry pinned per placement from F3/F5/F6, with the note that Hoje's shipped `.tape` is centred and must not be copied. |
| 12 | m | **Fixed** — the day card's solid `--line` shadow is pinned in §12.3; the `--accent-app` violation colour is deviation 10 with its written reason. |
| 13 | m | **Fixed** — mobile page padding is 20px (deviation 7), with the `body-text-viewport-edge` arithmetic. |

### testability

| # | Sev | Disposition |
|---|---|---|
| 1 | B | **Fixed by a different mechanism, and the proposed one dismissed.** D33 removes PGlite from apps/web, so no seeding surface is needed and `@miolos/db/testing` is *added* to the ban rather than widened. Adding `seedDailyPuzzle`/`truncateDailyPuzzles` to `@miolos/db/testing` would have grown a package surface (and a fifth tripwire) to serve tests that no longer exist. |
| 2 | B | **Fixed** — see adr-2. `typescript-eslint` added to apps/web devDeps as the finding requires. |
| 3 | B | **Fixed** via the source/test glob split (adr-1), not via runtime token composition. The split is what ADR-0024's amendment actually specifies ("in `apps/web` **source**"), it keeps the probe fixtures readable, and T-LINT-7/8 pin both the exemption and the undiminished import ban. Runtime composition would have hidden the fixtures from a reader for no additional safety. |
| 4 | B | **Fixed** — T-API-14 and T-DB-14 both use **two identities**; the reason (a same-user replay re-reads the original `completed_at` through `ON CONFLICT DO NOTHING`) is written into the test table so it is not "simplified" back. |
| 5 | M | **Fixed** — D33. (The reviewer's `// @vitest-environment node` route was rejected: it would leave a PGlite suite in apps/web that duplicates `packages/db/test/published.test.ts` and forbids `@testing-library/react` in that file, for no coverage apps/web does not already have.) |
| 6 | M | **Fixed** — T-WEB-11 is table-driven; no fast-check, no ADR amendment, no new dependency. |
| 7 | M | **Moot, recorded** — with no property test in this ticket the `FC_SEED`/timeout convention has nothing to bind. §3 states plainly that this ticket adds no property test. |
| 8 | M | **Fixed** — the Neon role and `DATABASE_URL` move to **build step 0**; §12.7 and E2 require a 200 from `<preview>/binairo` pasted before the detect output. |
| 9 | m | **Fixed** — all `§19.3` references corrected to §19.4. |
| 10 | m | **Fixed** — the verified result is recorded in §19.4 and the unusable fallback deleted. |
| 11 | m | **Fixed** — §15 states the `beforeAll(…, 30_000)` timeout and its arithmetic for the two PGlite files. |

### Orchestrator amendments (step 5)

Amendments made **after** the step-3 review and step-4 revision, by the orchestrator at implementation time. Recorded here rather than applied silently, because each one weakens something a reviewer already signed off on.

| # | Item | Amendment | Reasoning |
|---|---|---|---|
| A1 | §5.3's `miolos_web` Neon role, §17's build step 0, §16's E1 (all tracing to security finding 7 and testability finding 8) | **Descoped from this PR.** §5.3 keeps the SQL and the rationale, restated as the specification of a **follow-up issue**; §17 step 0 becomes "already satisfied — verify only"; §16 E1 becomes a verification step plus "file the follow-up issue". **ADR-0026 claims exactly one shipped enforcement point (the module-graph wall) and names the Neon grant as a filed follow-up** — it does not assert the grant exists. | `DATABASE_URL` is already present on the `miolos-web` Vercel project across Production, Preview and Development — it arrived with the Neon–Vercel integration, alongside `POSTGRES_*`/`PG*`/`NEON_*`. So nothing blocks the preview from rendering `/binairo`, and build step 0 is already satisfied. Hand-overwriting that integration-managed `DATABASE_URL` with a hand-made role's connection string risks a silent re-sync reverting it, which would make ADR-0026's "two independent enforcement points" claim quietly false while reading as true — worse than not claiming it. Rotating the live web app's database credential is also an outward-facing production mutation with a real chance of breaking https://miolos.app, for a defence-in-depth layer whose primary enforcement (the narrowed root `@miolos/db` entry, the ESLint bans, and `server-only`) ships mechanically in this PR. |

**Stale cross-references left in the body, deliberately** (this document is a point-in-time snapshot; `docs/README.md` forbids rewriting bodies to match later decisions, so they are named here instead of edited away):

- **§4, D3** — "served by a **distinct least-privilege Neon role** (§5.3, E1)". Read as: *specified* by §5.3, deferred by A1.
- **§5.2**, last table row — "and the web role's Neon grants are `SELECT` on `daily_puzzles` only (§5.3)" is the one closer in that cell that does **not** ship with this PR. Every other closer in that row (the narrowed root `createDb`, the root barrel's export list, the §14 ESLint bans, `server-only`) does, and the ADR-0004 vector the row is about is closed by them.
- **§12.7** — "Provisioning the web role and its `DATABASE_URL` is therefore a **step-0** item". The `DATABASE_URL` half is satisfied; the role half is the follow-up. The requirement itself is unchanged: a 200 from `<preview>/binairo` is still pasted before the detect output (E2).
- **§6.4, flow step 6** *(added at step 7, finding `adr-0026-date-bound-not-in-the-wall-read`)* — "the wall read is `and`-ed with `date >= (now() at time zone 'America/Sao_Paulo')::date - 1`". **The D29 bound did not ship inside the wall read and deliberately does not belong there.** `wallPredicate` is shared by `getTodayDaily` and `getPublishedDaily`, which must not inherit a write-side bound, so `getPublishedDailyWithSolution` keeps no lower bound and the route enforces D29 itself: `apps/api/app/completions/route.ts` compares `body.date` against `addDays(await todaySaoPaulo(db), -ACCEPTED_DAYS_BACK)` and 404s **before** the wall read. D29 (§4) states it correctly — "**the route** bounds the accepted date" — and ADR-0026 decision 6 was corrected to match. **#31 widens `ACCEPTED_DAYS_BACK`, not `wallPredicate`.**
- **§16, E1 and E10** *(added at step 7)* — "file the follow-up issue" is done: the least-privilege `miolos_web` role is [#59](https://github.com/fernandolisboa/miolos/issues/59) and the D19 late-by-sync decision is [#58](https://github.com/fernandolisboa/miolos/issues/58), both carrying §5.3's SQL and §16's two options verbatim. `nextBinairoDeduction` (§10.4) stays a plan note, unfiled.
