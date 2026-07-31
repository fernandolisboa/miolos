# Issue #15 — Anonymous identity end-to-end — Implementation plan

Step 2 (Plan) of the eight-step flow. Input: `01-explore.md` (same directory), issue #15, ADR-0003/0007/0009/0012/0013/0014, repo `main` @ 204b607. A fresh implementer must be able to execute this verbatim.

## 0. Fixed orchestrator decisions (recorded, not re-litigable here)

- Session mechanism gets an ADR: `docs/adr/0022-opaque-session-tokens-in-a-sessions-table.md` (number **reserved** — do not renumber). Opaque random token (Web Crypto, ≥128 bits), stored as SHA-256 hash, `sessions` table, cookie `HttpOnly; Secure; SameSite=Lax; Domain=<env>; Path=/`, **no JWT**. This plan found no materially better design — the ADR records exactly this (§8).
- This stream does **not** touch `next.config.ts` `headers()` or `.github/workflows/ci.yml` — issue #41 owns those. (`transpilePackages` in `apps/api/next.config.ts` IS edited here — it is not headers; see risk R6.)
- No email-attach/merge/social-login **logic** — schema columns only. No streak computation. No `Date`-derived identity decisions client-side at all.
- **#15's PR must not merge before #41 merges** (orchestrator sequences this; the PR body states the dependency).

## 1. Decisions this plan settles (with justification)

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| D1 | `users.id` type | `uuid` PK, DB-side `defaultRandom()` (v4, `gen_random_uuid()`) | Works identically on Neon (PG17) and PGlite 0.5.4 (PostgreSQL 18.3 — verified by the step-3 probe) with zero extensions and zero app-side generation; single insert round-trip on neon-http. UUIDv7's index-locality benefit is negligible at M0 scale, needs app-side generation (or PG18 `uuidv7()`), and embeds creation time in an ID exposed to the client. bigint identity is enumerable — bad for an ID that lives in a client-visible contract. |
| D2 | Email verification state | `email_verified_at timestamptz` nullable, no enum | Timestamp-only is the minimal ADR-0003-satisfying shape: null = unverified, set = verified-at-that-moment. An enum adds states nothing produces yet. |
| D3 | Consent representation | `recovery_consent_at` / `reminder_consent_at`, independent nullable `timestamptz`; null = not consented (reminder defaults off = null) | Orchestrator-fixed. Satisfies ADR-0012's "flag plus timestamp" (flag is derivable, timestamp is evidence). Known gap surfaced in the PR: withdrawal sets the column back to null, losing the withdrawal moment; if the email-attach ticket needs a withdrawal audit trail, the representation grows then (no consent UI exists in M0, so nothing is lost yet). |
| D4 | Email uniqueness | **No** unique constraint on `email` in #15 | ADR-0009: two anonymous accounts attaching the same email is exactly the state that triggers merge — a hard unique index would forbid the designed flow. Uniqueness semantics land with the attach/merge ticket. |
| D5 | `merged_into` column | **Deferred** to the merge ticket | Orchestrator: schema columns only "per the issue"; the issue's list is email/verification, social ids, consents. #15 has no resolution logic that could follow the pointer, so the column would be dead weight; adding one nullable column later is a trivial additive migration. |
| D6 | Session expiry | Long-lived sliding sessions: cookie `Max-Age=34560000` (400 days, the Chrome cap), re-`Set-Cookie` on every resolve. `last_seen_at` is bumped **only when stale by >1 hour** (one conditional DB-side update: `... where last_seen_at < now() - interval '1 hour'`) — staleness granularity is days, so hourly precision is free and resolve stays write-free on hot paths once future endpoints resolve per-request. **No server-side hard expiry in M0**; a session is *stale* if `last_seen_at` > 400 days old (future cron may prune — not this ticket). | An anonymous account protects only a streak; the product's core mechanic dies if identity evaporates. HttpOnly server-set cookies are exempt from Safari ITP's 7-day cap; the sliding refresh defeats Chrome's 400-day cap for active users. Revocation exists (delete the row) — the reason we pay for a table at all. |
| D7 | DB driver | `drizzle-orm/neon-http` (`@neondatabase/serverless` 1.1.0, HTTP transport), per ADR-0014's "serverless driver" | Recorded decision; zero persistent connections = the deliberate two-app budgeting answer. Known limit: no interactive transactions (batched `sql.transaction` only) — minting is two inserts batchable in one `db.batch()`, fine here. Flagged for the merge ticket (needs the websocket driver or unpooled `pg`). |
| D8 | Endpoint shape | `POST /session` (+ `OPTIONS`), mint-on-miss | Minting writes two rows — POST expresses the write; GET must stay safe/cacheable. ADR-0014's web-reads-db carve-out is for **public** pages only; identity is user-specific, so the *only* correct trigger is a credentialed client fetch to apps/api. "First visit mints with no interaction" = a fire-on-mount fetch from the web shell (§5), zero UI. |
| D9 | Migration execution | **Manual** for M0: `pnpm --filter @miolos/db db:migrate` against `DATABASE_URL_UNPOOLED`, run by the implementer against the Neon database **before merging the PR** (migration is purely additive — safe to apply ahead of code). No Vercel-build-step migrate (couples deploy to DB, runs once per app = twice); no CI-step migrate (ci.yml is #41's file, off-limits). Automating migrate-on-deploy is surfaced in the PR as a follow-up decision. |
| D10 | Cookie attrs env switch | Single env var `COOKIE_DOMAIN` controls `Domain`. Set (prod: `miolos.app`) → emit `Domain=miolos.app`. Unset (local dev, previews) → host-only cookie, shared across `localhost:3000/3001` because cookies ignore ports. **`Secure` is decoupled from `Domain`**: emitted when `COOKIE_DOMAIN` is set **or** `NODE_ENV === "production"` — so https `*.vercel.app` previews (production builds, `COOKIE_DOMAIN` unset) get a Secure cookie; local `next dev` (http) does not. | One knob for domain, mirrors the `WEB_ORIGIN` pattern, nothing hardcodes the apex (ADR-0013). Coupling `Secure` to `COOKIE_DOMAIN` alone would leave https previews with a non-Secure cookie by accident. `__Host-` prefix is impossible (forbids `Domain`); `__Secure-` prefix would break the local-dev case — plain name `miolos_session`. |
| D13 | Cross-site mint guard (review B2) | **Guard adopted.** `POST /session` rejects with 403 (no `Set-Cookie`, no DB write) when the request carries *positive evidence* of being cross-site: `Sec-Fetch-Site: cross-site`, or an `Origin` header present that ≠ `WEB_ORIGIN` (checked only when `WEB_ORIGIN` is set). Requests lacking both headers (curl, seam-4 tests, old clients) and `Sec-Fetch-Site: same-origin/same-site/none` are allowed — deny on evidence, never require proof. | Closes the identity-wipe vector: evil.com's top-level form POST arrives cookieless under Lax, would mint a fresh user and its first-party `Set-Cookie` would overwrite the victim's identity — ADR-0003's named worst failure, inflictable by a link click. Every browser modern enough to matter sends `Sec-Fetch-Site` and sends `Origin` on cross-origin POSTs (belt and braces: either alone catches the attack). One pure function, unit-testable; local dev works because `localhost:3000→3001` is same-site and dev `WEB_ORIGIN` matches the web origin. |
| D14 | Mint abuse posture (review B3) | **Accepted for M0: `POST /session` is unauthenticated and unthrottled by design.** No rate limiting in this ticket. | Flood-minted rows are inert and unreferenced (no completions exist; orphans identical to D11's); Vercel's platform firewall is the M0 backstop. Recorded in ADR-0022 consequences, §12 R7, and the PR decisions list. **Revisit trigger:** before public launch, at the first abuse signal, or alongside the first real rate-limiting need (hint grants per ADR-0006) — whichever comes first. |
| D11 | Concurrency guarantee | Honest, not heroic: concurrent no-cookie requests may each mint a user; the browser keeps the last `Set-Cookie`; loser rows are orphans with no references (no completions exist) and are harmless. Server-side dedupe is impossible without a client idempotency key (not worth it for anonymous mint). Client mitigation: the web bootstrap fires **exactly one** request per page load (module-level in-flight guard, survives React StrictMode double-effects). Hard guarantee that *is* made: same cookie → same user, always (indexed hash lookup). |
| D12 | Response contract exposure | `{ userId, created }` only | The caller learns its own id (needed eventually for client caches) and whether this call minted (useful to tests/telemetry). No timestamps, no internal columns leak. |

## 2. Schema design (`packages/db/src/schema.ts`) — exact

All timestamps `timestamptz` (`{ withTimezone: true, mode: "date" }`), all defaults DB-side (`defaultNow()` / `defaultRandom()`) — the DB clock is the only clock (AC 5).

```ts
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"), // nullable; NOT unique in M0 (see D4)
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "date" }),
  appleId: text("apple_id").unique(),   // PG unique: multiple NULLs allowed
  googleId: text("google_id").unique(),
  recoveryConsentAt: timestamp("recovery_consent_at", { withTimezone: true, mode: "date" }),
  reminderConsentAt: timestamp("reminder_consent_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(), // sha-256 hex of the opaque token
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);
```

Comments in the file cite ADR-0003 (email/social columns from day one), ADR-0012 (consents), ADR-0022 (sessions), and D4 (why email is not unique).

**Migration strategy.** `packages/db/drizzle.config.ts`: `dialect: "postgresql"`, `schema: "./src/schema.ts"`, `out: "./migrations"`, `dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED! }` (with a comment justifying the non-null assertion — config file, fails loud). Run `pnpm --filter @miolos/db db:generate` once; **commit** the generated SQL + `migrations/meta/` journal. This ticket ships: the schema, the committed migration, the `db:generate`/`db:migrate` scripts, and the migration **applied manually to Neon** per D9. Nothing automates deploy-time migration yet. **Rollback story (review A4):** drizzle-kit generates no down migrations and none is needed — rollback = roll forward with a new migration; this change is purely additive, so reverting the code while leaving the tables in place is safe.

## 3. `packages/db` package design

- `package.json`: deps `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`; devDeps `drizzle-kit@0.31.10`, `@electric-sql/pglite@0.5.4`, `typescript@6.0.3` (kept). Scripts: `typecheck`, `db:generate": "drizzle-kit generate"`, `db:migrate": "drizzle-kit migrate"`. Exports: `"."` → `./src/index.ts`, `"./testing"` → `./src/testing.ts` (source-direct like core; consumers use `transpilePackages`).
- `src/schema.ts` — §2.
- `src/client.ts` — the injection seam, **zero singletons**:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

/** Union seam: prod (neon-http) and test (PGlite) instances share the query API. */
export type Db = NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export function createDb(databaseUrl: string): NeonHttpDatabase<typeof schema> {
  return drizzle(neon(databaseUrl), { schema });
}
```

  (If the union type fights a drizzle API at implementation time, the fallback is `PgDatabase<PgQueryResultHKT, typeof schema>` with a comment — but try the union first; service code in §4 uses only `insert`/`select`/`update`, supported by both.)
- `src/testing.ts` — the honest double: in-memory PGlite running the **real committed migrations**:

```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

export async function createTestDb(): Promise<{ db: PgliteDatabase<typeof schema>; close: () => Promise<void> }> {
  const client = new PGlite(); // in-memory
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  return { db, close: () => client.close() };
}
```

- `src/index.ts` — re-export `users`, `sessions`, `createDb`, `type Db`, **and the query helpers the service layer needs: `sql`, `eq` (re-exported from `drizzle-orm`)**. This keeps the driver an implementation detail of the package: `apps/api` depends only on `@miolos/db` and takes **no direct `drizzle-orm` dependency** (pnpm's isolated node-linker would otherwise fail the import). `testing.ts` is only reachable via the `./testing` subpath so app bundles never touch PGlite.

## 4. API design (`apps/api`)

**Files:**
- `src/db.ts` — per-request acquisition, the mock seam for integration tests:

```ts
import { createDb, type Db } from "@miolos/db";

/** Per-request; neon-http is stateless HTTP, so construction is cheap and
 *  there is deliberately no module-level cache (connection budgeting, test seam). */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return createDb(url);
}
```

- `src/session/token.ts` — Web Crypto only (edge-safe, no Node import):
  - `generateSessionToken(): string` — 32 bytes `crypto.getRandomValues` (256 bits ≥ the 128 floor), base64url-encoded (43 chars).
  - `hashSessionToken(token: string): Promise<string>` — `crypto.subtle.digest("SHA-256", ...)` → lowercase hex. Lookup is by hash, so no timing-oracle comparison exists anywhere.
- `src/session/cookie.ts`:
  - `SESSION_COOKIE_NAME = "miolos_session"`.
  - `buildSessionCookie(token: string): string` — serializes `miolos_session=<token>; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax`; appends `; Domain=<value>` iff `process.env.COOKIE_DOMAIN` is set, and `; Secure` iff `COOKIE_DOMAIN` is set **or** `NODE_ENV === "production"` (D10). Manual serialization, no dependency, unit-testable.
- `src/session/origin-guard.ts` — the D13 cross-site mint guard, one pure function:
  - `isCrossSiteMint(headers: { secFetchSite: string | null; origin: string | null }, webOrigin: string | undefined): boolean` — returns `true` (reject) iff `secFetchSite === "cross-site"`, or (`origin !== null` and `webOrigin` is set and `origin !== webOrigin`). Everything else — absent headers (curl, seam-4 tests, old clients), `same-origin`/`same-site`/`none`, matching `Origin`, `WEB_ORIGIN` unset — returns `false` (allow). Deny on positive evidence only; comment explains the Lax cookie-overwrite attack it closes.
- `src/session/service.ts` — takes `db: Db`, returns plain data (no Response); imports `sql`/`eq` from `@miolos/db` (A1 — no direct drizzle dep):
  - `resolveSession(db, tokenHash)` — `select` session by `tokenHash`; on hit, bump `last_seen_at` only when stale: `update sessions set last_seen_at = now() where token_hash = … and last_seen_at < now() - interval '1 hour'` (DB-side `sql` expressions, no JS date; D6 throttle) and return `{ userId, created: false }`.
  - `mintSession(db, tokenHash)` — insert user (all defaults), insert session with `tokenHash` + returned `userId`; return `{ userId, created: true }`. Two sequential awaits on neon-http (or `db.batch` where both drivers support it — sequential is fine and portable; an orphan user from a crash between the two inserts is the same harmless orphan as D11).
- `src/cors.ts` — **extend, don't replace** (the reserved seam):
  - `corsHeaders(options?: { credentials?: boolean })` — existing behavior unchanged for current callers; with `credentials: true` and `WEB_ORIGIN` set, adds `Access-Control-Allow-Credentials: "true"` and `Vary: "Origin"`. Never emits `*` (env is an exact origin by construction; comment states the wildcard-with-credentials browser failure).
  - `preflightResponse(): Response` — 204 with `corsHeaders({ credentials: true })` + `Access-Control-Allow-Methods: "POST, OPTIONS"`, `Access-Control-Allow-Headers: "Content-Type"`, `Access-Control-Max-Age: "86400"`.
- `app/session/route.ts`:

```ts
export const dynamic = "force-dynamic";
export function OPTIONS(): Response { return preflightResponse(); }
export async function POST(request: NextRequest): Promise<Response> {
  if (isCrossSiteMint(
    { secFetchSite: request.headers.get("sec-fetch-site"), origin: request.headers.get("origin") },
    process.env.WEB_ORIGIN,
  )) {
    return new Response(null, { status: 403 }); // D13: no Set-Cookie, no DB write
  }
  const db = getDb();
  const existingToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let result = existingToken
    ? await resolveSession(db, await hashSessionToken(existingToken))
    : undefined; // unknown/absent token falls through to mint
  let token = existingToken;
  if (!result) {
    token = generateSessionToken();
    result = await mintSession(db, await hashSessionToken(token));
  }
  const body: SessionResponse = result;
  const response = Response.json(sessionResponseSchema.parse(body), {
    headers: corsHeaders({ credentials: true }),
  });
  response.headers.append("Set-Cookie", buildSessionCookie(token!)); // always re-set: sliding 400d window (D6)
  return response;
}
```

  (Exact code shape is the implementer's; the semantics above are not: guard-before-anything, parse-before-respond, always re-`Set-Cookie` on success, unknown token → fresh mint, no request body is read — there is nothing to accept. **This structural absence of any time or identity input in the request path is the AC-5 guarantee itself**: timestamps exist only as DB column defaults (`defaultNow()`), never as request-derived or JS-constructed values. Test 6 proves it at the contract level; see §6 for what PGlite can and cannot demonstrate.)
- `next.config.ts` — `transpilePackages: ["@miolos/core", "@miolos/db"]`. **Only** this line changes (headers are #41's).

**Contract** — `packages/core/src/contracts/session.ts`, re-exported from `src/index.ts`:

```ts
export const sessionResponseSchema = z.object({
  userId: z.uuid(),
  created: z.boolean(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
```

**Idempotency semantics (honest statement, also in the ADR + PR):** repeat requests with a valid cookie are fully idempotent (same user, `created:false`). Cookieless concurrent requests are *not* deduplicated server-side — see D11.

## 5. `apps/web` integration

- `src/components/session-bootstrap.tsx` — `"use client"`, renders `null`. On mount, fires once (module-level in-flight/done guard so StrictMode's double effect and re-mounts don't double-fire):
  `fetch(`${process.env.NEXT_PUBLIC_API_URL}/session`, { method: "POST", credentials: "include" })`, then parses the JSON with `sessionResponseSchema` (parsed, never cast — result currently unused, discard) and swallows network errors (an offline first paint must not break the page; comment says so). **No body sent** → the POST stays a "simple request" (no preflight on the hot path; OPTIONS exists for robustness). **No `Date` anywhere** in this component or anything it calls.
- Mount `<SessionBootstrap />` in `apps/web/app/layout.tsx` inside `<body>` — every route bootstraps identity, no UI.
- `NEXT_PUBLIC_API_URL` already exists in env examples and turbo allowlist; nothing new needed for web env.
- The bootstrap fetch passes the D13 guard by construction: browsers send `Origin: <web origin>` (= `WEB_ORIGIN`) and `Sec-Fetch-Site: same-site` (prod, `miolos.app`→`api.miolos.app`) or `same-site` for `localhost:3000`→`:3001` in dev — never `cross-site`.

## 6. Test plan (seam 4 — this ticket creates the prior art)

Pattern: route handlers invoked as functions with a constructed `NextRequest`, responses parsed with the shared Zod schema (the #14 pattern), DB = PGlite via `createTestDb()` running the real committed migrations (§3), `apps/api/src/db.ts` mocked with `vi.mock` to return the test db — everything below `getDb` is real. Env stubbed with `vi.stubEnv` (existing convention). Fresh db per test file; per-test truncation or fresh instance per test (PGlite in-memory is fast — fresh per test is fine and simplest).

**`apps/api/test/session.test.ts` (integration, ~13 tests):**
1. **Mint on first request** — POST without cookie → 200; body parses with `sessionResponseSchema`, `created: true`; a `users` row exists with that id; a `sessions` row exists whose `token_hash` = sha-256 of the token in `Set-Cookie`; cookie attrs asserted verbatim: name, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=34560000`.
2. **Cookie attrs matrix (D10)** — `COOKIE_DOMAIN=miolos.app`: `Domain=miolos.app` and `Secure` present. Both unset (`NODE_ENV` = test): neither present. `COOKIE_DOMAIN` unset + `NODE_ENV` stubbed to `production`: `Secure` present, `Domain` absent (the preview shape).
3. **Same cookie → same user** — second POST carrying the first cookie → `created: false`, same `userId`, `Set-Cookie` re-emitted (sliding refresh), and **no second user row**. `last_seen_at` throttle (D6): immediate re-resolve leaves `last_seen_at` unchanged; after backdating the row's `last_seen_at` to 2h ago via a direct test-db update, a resolve bumps it to ~now.
4. **Unknown/garbage token → fresh mint** — POST with `miolos_session=forged` → 200, `created: true`, new user, new cookie ≠ forged.
5. **Concurrent mint (documented behavior)** — two cookieless POSTs via `Promise.all` → both 200/`created:true`, two distinct users, each returned cookie resolves to its own user on replay. The test **documents** D11 rather than pretending dedupe exists.
6. **No client time input exists (AC 5, redesigned per review B1)** — proves the invariant at the seams that can actually prove it, **no fake timers anywhere**:
   (a) *Contract accepts no time fields:* `sessionResponseSchema` is the entire boundary and the request has no schema at all — assert a POST with a junk JSON body (including date-shaped fields like `{"createdAt":"2020-01-01"}`) and with forged date-ish headers (`Date`, `X-Timestamp`) behaves identically to the bodyless POST: same status, same body shape, a fresh mint unrelated to the injected values.
   (b) *Timestamps are DB-generated:* mint via the route, read the row — `created_at`/`last_seen_at` are non-null and equal to each other on mint (both from the same `defaultNow()` moment); across two sequential mints the second user's `created_at` ≥ the first's (DB-default monotonicity). No JS-constructed date ever appears in an insert (also enforced by the §4 rule: service code contains no `new Date()` — reviewer lens at step 6).
   **Honest limitation, stated here and in the PR:** PGlite's `now()` follows the host JS clock (WASM/Emscripten — proven by the step-3 probe), so "DB clock is independent of the JS clock" is a property of real Neon that the test double *cannot* demonstrate. The AC-5 guarantee rests on the structural fact that no time input exists in the request path — which (a) and (b) do prove — not on clock-fakery theatrics.
7. **CORS matrix** — POST with `WEB_ORIGIN` set: exact `Access-Control-Allow-Origin` + `Allow-Credentials: true` + `Vary: Origin`; `WEB_ORIGIN` unset: no CORS headers; OPTIONS → 204 with methods/headers/max-age.
8. **Cross-site mint guard (D13)** — POST with `Sec-Fetch-Site: cross-site` → 403, **no** `Set-Cookie`, **zero** rows created (count `users` before/after). POST with `Origin: https://evil.example` + `WEB_ORIGIN` stubbed → 403 likewise. POST with `Origin` = `WEB_ORIGIN` → mints normally. Headerless POST (the seam-4/curl shape used by every other test) → mints normally — proving the guard never breaks non-browser clients.

**Unit tests:** `apps/api/test/session-token.test.ts` — token is 43-char base64url, distinct across calls; `hashSessionToken` matches a known SHA-256 vector. `apps/api/test/session-cookie.test.ts` — serialization matrix per D10 (`COOKIE_DOMAIN` set/unset × `NODE_ENV` production/not). `apps/api/test/session-origin-guard.test.ts` — full `isCrossSiteMint` matrix: `cross-site` → reject; `same-origin`/`same-site`/`none`/absent → allow; `Origin` ≠ `WEB_ORIGIN` → reject; `Origin` = `WEB_ORIGIN` → allow; `Origin` present but `WEB_ORIGIN` unset → allow (dev fallback); both headers absent → allow.

**`packages/core/test/session-contract.test.ts`** — round-trip valid payload; rejects non-uuid `userId`, missing `created`, wrong types (mirrors `health-contract.test.ts`).

**`apps/web/test/session-bootstrap.test.tsx`** — jsdom + stubbed `fetch`: renders → exactly one fetch with the right URL, `method: "POST"`, `credentials: "include"`; StrictMode double-render still one fetch; fetch rejection does not throw/crash.

**Suite delta:** +6 test files, roughly +26 tests. All offline and fast (PGlite in-process) — pre-commit stays viable. No vitest config change expected for apps/api (default node env runs PGlite's WASM).

## 7. Env / config

- **New:** `COOKIE_DOMAIN` — apps/api only. Prod value `miolos.app` (set post-merge: `vercel env add COOKIE_DOMAIN production` on miolos-api → `miolos.app`). Local: unset. **Preview caveat (surfaced, not solved):** on `*.vercel.app` previews `Domain=miolos.app` is unsettable and `vercel.app` is a public-suffix — the cross-app cookie simply does not work in previews; COOKIE_DOMAIN stays unset there and previews get a host-only api cookie. Acceptable for M0; noted in the PR.
- **Existing:** `DATABASE_URL` (pooled, runtime), `DATABASE_URL_UNPOOLED` (migrations only) — already in `apps/api/.env.local`; re-pull if needed: `vercel env pull --cwd apps/api --environment development` (verify no duplicate append; `.gitignore` already covers `.env*`).
- **`turbo.json`** `build.env` → add `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `COOKIE_DOMAIN` (cache-correctness; brief risk item).
- **`apps/api/.env.example`** — document `COOKIE_DOMAIN` (with the D10 semantics comment) and `DATABASE_URL`/`DATABASE_URL_UNPOOLED` ("pulled via `vercel env pull`, never committed").
- **`packages/db`** needs `DATABASE_URL_UNPOOLED` only when running drizzle-kit manually; document in a comment in `drizzle.config.ts` (`source apps/api/.env.local` or export inline).

## 8. ADR-0022 (`docs/adr/0022-opaque-session-tokens-in-a-sessions-table.md`)

Status Accepted. Records: opaque 32-byte Web Crypto token, base64url, in an `HttpOnly; Secure(prod); SameSite=Lax; Domain=env-driven; Path=/; Max-Age=400d` cookie named `miolos_session`; server stores only the SHA-256 hex hash as `sessions.token_hash` (PK) with `user_id`/`created_at`/`last_seen_at`; sliding lifetime per D6 (no hard server expiry in M0, staleness definition, `last_seen_at` bumped only when >1h stale, future prune cron); **cross-site mint guard** per D13 (403 on `Sec-Fetch-Site: cross-site` or mismatched `Origin` — closes the Lax cookie-overwrite identity-wipe; absent headers allowed by design so non-browser clients work); **no JWT** — rationale: every identity-bearing request already touches the DB (streaks are server-computed), so statelessness buys nothing; opaque+table gives revocation and the ADR-0009 merge remap (repoint `user_id`) for free; no signing-secret lifecycle. Alternatives considered: signed stateless token (rejected, above), raw user id (rejected: forgeable/enumerable). Consequences: one indexed lookup per authenticated request; merge ticket must remap or delete sessions of the losing account; **the mint endpoint is unauthenticated and unthrottled in M0 (D14)** — accepted because flood-minted rows are inert and unreferenced and the Vercel firewall is the platform backstop; revisit before public launch, at the first abuse signal, or with the first real rate-limiting need (ADR-0006 hint grants), whichever comes first. No divergence from the orchestrator sketch arose during planning.

## 9. File-by-file change list

| File | Change |
|---|---|
| `packages/db/package.json` | deps/devDeps/scripts/exports per §3 |
| `packages/db/drizzle.config.ts` | new |
| `packages/db/src/schema.ts` | new (§2) |
| `packages/db/src/client.ts` | new (§3) |
| `packages/db/src/testing.ts` | new (§3) |
| `packages/db/src/index.ts` | replace placeholder with re-exports |
| `packages/db/migrations/*` (+ `meta/`) | generated once, committed |
| `packages/core/src/contracts/session.ts` | new (§4) |
| `packages/core/src/index.ts` | re-export session contract |
| `packages/core/test/session-contract.test.ts` | new |
| `apps/api/package.json` | dep `@miolos/db: workspace:*` |
| `apps/api/next.config.ts` | `transpilePackages` += `@miolos/db` (nothing else) |
| `apps/api/src/db.ts` | new |
| `apps/api/src/session/{token,cookie,service,origin-guard}.ts` | new |
| `apps/api/src/cors.ts` | extend per §4 |
| `apps/api/app/session/route.ts` | new (POST + OPTIONS, D13 guard first) |
| `apps/api/test/session.test.ts`, `session-token.test.ts`, `session-cookie.test.ts`, `session-origin-guard.test.ts` | new |
| `apps/api/.env.example` | add COOKIE_DOMAIN + DATABASE_URL docs |
| `apps/web/src/components/session-bootstrap.tsx` | new |
| `apps/web/app/layout.tsx` | mount `<SessionBootstrap />` |
| `apps/web/test/session-bootstrap.test.tsx` | new |
| `turbo.json` | `build.env` += 3 vars |
| `docs/adr/0022-opaque-session-tokens-in-a-sessions-table.md` | new (§8) |
| `docs/plans/009-issue-15-plan-anonymous-identity.md` | this plan, committed (number as directed) |
| `pnpm-lock.yaml` | via `pnpm install` |

Explicitly untouched: `.github/workflows/ci.yml`, any `headers()` in either `next.config.ts` (#41).

## 10. Verification (evidence rule: paste real output for every gate)

Preamble for every shell: `source ~/.nvm/nvm.sh && nvm use default` (Node 24.18.1, pnpm 11.18.0).

1. `pnpm install` — lockfile updates cleanly.
2. `pnpm --filter @miolos/db db:generate` — migration SQL generated; **read the SQL** and confirm it matches §2 (timestamptz everywhere, uniques, FK cascade).
3. `pnpm typecheck` — green proves strict TS across the union `Db` seam and no casts.
4. `pnpm lint` — green, `--max-warnings 0`.
5. `pnpm test` — full suite; green proves seam-4 integration (mint/resolve/forged/concurrent/clock/CORS), contract round-trips, token/cookie units, web bootstrap.
6. Apply migration to Neon: `DATABASE_URL_UNPOOLED=<from apps/api/.env.local> pnpm --filter @miolos/db db:migrate` — output shows the migration applied (D9: before merge, additive-only).
7. **Two-request curl demo** (api dev server: `pnpm --filter @miolos/api dev`; jar in the scratchpad dir):
   - `curl -si -c "$JAR" -X POST http://localhost:3001/session` → 200, `Set-Cookie: miolos_session=…; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax` (no Domain/Secure locally), body `{"userId":"…","created":true}`.
   - `curl -si -b "$JAR" -c "$JAR" -X POST http://localhost:3001/session` → `"created":false`, **same** `userId` → proves mint-then-resolve through a real cookie jar against real Neon.
   - **Transcript hygiene (review A3):** the pasted PR transcript **redacts the token value** in `Set-Cookie` (`miolos_session=<REDACTED>; Path=/; …` — attrs stay visible, they are the evidence), **and** the demo `sessions`+`users` rows are deleted from Neon after the demo (one SQL delete, output pasted too). Both, not either — the token is live prod credential material.
8. Pre-commit hook fires and passes on commit (never `--no-verify`).
9. **Prod verification is post-merge and post-#41:** browser at `https://miolos.app` → devtools shows `miolos_session` with `Domain=.miolos.app`, and a second load returns `created:false`. Requires `COOKIE_DOMAIN` set on miolos-api first (§7). Stated in the PR as the deferred check.

Gate-to-proof map: typecheck→3, lint→4, test→5, Zod-at-boundary→5 (route parse + round-trip tests) and the absence of `as` in new code (reviewer lens), no-UI-change→`npx impeccable detect` not required unless the layout edit is judged UI-touching — the bootstrap renders null, but run it anyway on apps/web and paste the output, it is cheap and the layout file changed.

## 11. Branch / commits / PR

- Branch: `feat/15-anonymous-identity` off `main`.
- Conventional Commits (suggested slicing): `feat(db): users and sessions schema with committed migrations`; `feat(core): session boundary contract`; `feat(api): anonymous session minting at POST /session`; `feat(web): fire-once session bootstrap`; `docs: ADR-0022 opaque session tokens; commit plan 009`; `chore: turbo env allowlist for db and cookie vars`. Tests ship inside their feature commits.
- PR body skeleton: **What changed** (one paragraph + file map) · **Evidence** (one fenced output block per gate item in §10, including the curl transcript) · **Sequencing** ("must merge after #41; migration already applied to Neon on <date>") · **Decisions for Fernando — none blocking**, surfaced explicitly: D6 session longevity (400d sliding, no hard expiry, throttled `last_seen_at`), D4 email non-uniqueness until merge, D9 manual migrations for M0, preview-env cookie limitation (§7), D3 consent-withdrawal timestamp gap, **D14 mint endpoint unauthenticated + unthrottled in M0** (accepted risk: inert rows, Vercel firewall backstop; revisit trigger stated), **D13 cross-site guard adopted** (403 on cross-site evidence), and the **AC-5 testing honesty note**: PGlite cannot demonstrate DB-vs-JS clock independence (its `now()` follows the host clock), so AC 5 is proven structurally — no time input exists in the request contract or code path — not by clock fakery.
- Merge only when the mechanical gate is green and step-6 reviews are satisfied (steps 6–8 follow this plan; `/implement`'s trailing review does not replace them).

## 12. Risks and mitigations

- **R1 Duplicate minting under concurrency** — accepted per D11; mitigations: client fire-once guard, test 5 documents behavior, orphans are unreferenced rows; revisit only if telemetry ever shows meaningful orphan volume.
- **R2 Cookie domain misconfig breaks prod** — `Domain` never hardcoded (env only); test matrix 2 pins both shapes; prod check in §10.9 is an explicit post-merge step; failure mode is visible (cookie absent in devtools), not silent data corruption.
- **R3 Migration execution path** — manual (D9) means a human-ordered step; mitigated by making it a pre-merge checklist item in the PR body with pasted output, and by the migration being purely additive (old code + new schema coexist). Follow-up decision surfaced for automation.
- **R4 PGlite/neon-http behavioral drift** — Neon is PG17, PGlite 0.5.4 is PG 18.3 (real versions, per the step-3 probe); every feature used (`gen_random_uuid()`, `timestamptz`, multiple-NULL uniques, FK cascade) exists in both. All SQL flows through drizzle + the same committed migration files (the shared artifact); no interactive transactions are used (the one real neon-http divergence); PGlite's clock follows the host JS clock (a WASM artifact — why test 6 is designed structurally, not clock-faked); the curl demo (§10.7) exercises the true neon-http path end-to-end as a belt-and-suspenders check.
- **R5 CORS-with-credentials mistakes** — `*` is unrepresentable (origin comes from env verbatim, header omitted when unset); credentials + preflight covered by test 7; the bootstrap request is deliberately body-less so the hot path needs no preflight.
- **R6 Merge conflict with #41 in `apps/api/next.config.ts`** — this PR touches only the `transpilePackages` line; #41 adds `headers()`. Disjoint hunks; if #41 lands first (it must), rebase is trivial.
- **R7 Deliberate mint abuse (review B3, decision D14)** — `POST /session` is unauthenticated and unthrottled; a script can flood `users`/`sessions` (curl sends no `Sec-Fetch-Site`, so the D13 guard intentionally does not close this). **Accepted for M0**: rows are inert and unreferenced, Neon tolerates junk, Vercel's platform firewall is the backstop. Revisit before public launch, at the first abuse signal, or alongside the first real rate-limiting need (ADR-0006 hint grants) — whichever comes first. Recorded in ADR-0022 and the PR decisions list.
- **R8 Cross-site identity wipe — closed by D13**: without the guard, a cross-site top-level form POST (cookieless under Lax) would mint a fresh user whose first-party `Set-Cookie` overwrites the victim's identity. Guard rejects on `Sec-Fetch-Site: cross-site` or mismatched `Origin`; tests 8 + the unit matrix pin it; headerless clients stay unaffected.

Exit criteria = issue #15's five ACs, each mapped: AC1→§10.7/§10.9 + tests 1–3; AC2→§2 + generated SQL review; AC3→contract + round-trip test; AC4→§6 (the seam now has prior art); AC5→test 6 (structural no-time-input proof, per review B1) + no-Date client rule (§5) + DB-default-only timestamps (§2/§4).

## Step-4 changelog (dispositions of the step-3 review findings)

| Finding | Disposition |
|---|---|
| **B1** (test 6 provably broken — PGlite `now()` follows the faked JS clock) | **Fixed.** Test 6 redesigned (§6): (a) contract-level proof that no time input exists — junk body with date-shaped fields + forged date headers behave identically to the bodyless POST; (b) timestamps proven DB-default-generated (non-null, `created_at`=`last_seen_at` on mint, monotone across mints) with no fake timers. Honest limitation (PGlite cannot demonstrate DB-vs-JS clock independence) stated in §6, §4, R4 and the PR decisions list. |
| **B2** (cross-site cookie-overwrite identity wipe) | **Fixed — guard adopted (option a), recorded as D13.** New pure function `src/session/origin-guard.ts`: 403 (no Set-Cookie, no DB write) iff `Sec-Fetch-Site: cross-site`, or `Origin` present ≠ `WEB_ORIGIN` (when set). Absent headers (curl, seam-4 tests, old clients) and `same-origin`/`same-site`/`none` allowed — deny on positive evidence only, so local dev and non-browser clients are unaffected. Route code, §5 bootstrap note, integration test 8, unit test matrix, ADR-0022, file list, R8 all updated. |
| **B3** (unauthenticated unthrottled row-creating endpoint, decision absent) | **Fixed — accept-for-M0 recorded as D14** in the decisions table, §12 R7, ADR-0022 consequences (§8), and the PR decisions list, with the revisit trigger: before public launch, first abuse signal, or first real rate-limiting need (ADR-0006 hint grants), whichever comes first. Vercel firewall named as the M0 backstop. |
| **A1** (apps/api missing `drizzle-orm` dep) | **Applied** via the review's cleaner option: `@miolos/db` re-exports `sql`/`eq`; apps/api takes no direct drizzle dep (§3, §4 service.ts). |
| **A2** (`last_seen_at` write amplification) | **Applied** — throttled: bump only when >1h stale, single conditional DB-side update (D6, §4, test 3, ADR-0022). |
| **A3** (live prod token in PR transcript) | **Applied** — both mitigations: token value redacted in the pasted transcript (attrs visible) and demo rows deleted from Neon post-demo, with the delete output pasted (§10.7, PR body). |
| **A4** (rollback story unstated) | **Applied** — §2 migration strategy: no down migrations by design; rollback = roll forward; additive change means reverted code + retained tables is safe. |
| **A5** (PGlite version claim wrong) | **Applied** — D1 and R4 now state Neon PG17 vs PGlite 0.5.4 = PG 18.3, per the probe. |
| **A6** (`Secure` accidentally coupled to `COOKIE_DOMAIN`) | **Applied** — decoupled: `Secure` emitted when `COOKIE_DOMAIN` is set **or** `NODE_ENV === "production"`, giving https previews a Secure cookie with no new env var (D10, §4 cookie.ts, test 2, unit matrix). |

No advisory was dismissed. All nine findings applied; plan internally consistent (contract unchanged — the guard adds no fields; tests, ADR draft, file list, env, PR skeleton and risks all reflect the changes).
