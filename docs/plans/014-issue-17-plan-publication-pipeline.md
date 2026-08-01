# Implementation plan — Issue #17: Publication pipeline (buffer, cron, published-predicate wall)

Step 2 (Plan) of the eight-step flow, reviewed at step 3 and amended at step 4 (changelog at the bottom). Point-in-time snapshot, planned against `origin/main` = 4f3d5b4; all paths are working-tree paths.

---

## 0. Acceptance criteria → plan mapping

| # | AC (quoted from issue #17) | Where satisfied |
|---|---|---|
| 1 | "The predicate helper has its own dedicated suite (seam 3, the ADR-0004 wall): future-dated rows are invisible through every consumer; the kill switch hides published rows; boundary instants (exactly `published_at`, one second before) behave correctly. No later PR may weaken this suite." | §4 helper, §8 tests T-DB-1..T-DB-9 (`packages/db/test/published.test.ts`), incl. the surface tripwires T-DB-9a–9c; the wall is mechanical via the D16 package-surface split (§3.5) |
| 2 | "Production database holds a ~7-deep validated, future-dated Binairo buffer, topped up by the scheduled cron" | §5 cron, §10 step-8 rollout evidence E1–E5 |
| 3 | "Buffer depth is monitored with alerting when shallow; cron exit codes are not the signal" | §6: depth query in `packages/db`, public `GET /buffer-depth`, GitHub Action poller that opens/comments a GitHub issue. The Action reads the DB-derived depth, never cron exit status |
| 4 | "Buffer depth read from remote config (starting value 7); feature flags and `entitlements: string[]` (an array, never a boolean) exist as dormant seams" | §3.3 + §4.4 `remote_config` table + typed accessor, default 7. Flags/entitlements already exist in `packages/core/src/{feature-flags,entitlements}.ts` (M0) — PR description points at them; nothing added |
| 5 | "Today's puzzle is retrievable through the helper; a future day's is not, through any route or payload" | §4 helper + §7 consumer route `GET /daily/binairo`, tests T-API-7..T-API-11 |

## 1. Fixed decisions (with rationale, one line each)

- **D1 — Store full validated engine JSON** in `daily_puzzles.content` jsonb; never regenerate on read (ADR-0010 "pre-generates and validates … rows"; an engine redeploy must never change a published puzzle mid-day).
- **D2 — Random seed per row** (`crypto.getRandomValues` uint32), stored in a `bigint` column. Not derived from (game, date): derivable seeds make future puzzles precomputable if the code/salt leaks, and the buffer stores content anyway — determinism for users comes from the row.
- **D3 — Helper lives in `packages/db`** (`src/published.ts`): it is a query needing schema + drizzle operators, which `packages/core` must never depend on (ADR-0014 left the location to this ticket).
- **D4 — The helper strips by default.** Default readers return a solution-free public projection; solution access is a separately named `…WithSolution` accessor. Stripping inside the wall is the only robust answer to RSC serialization (apps/web server components can't leak what they never received — CLAUDE.md "not the framework default" landmine).
- **D5 — Allowlist, never blocklist.** Projections are built by picking named safe fields and parsed through `.strict()` Zod schemas — never by deleting `solution`.
- **D6 — Fail-closed per-game dispatch.** M1 implements binairo's projection; sudoku/nonogram/termo branches **throw** (`DailyProjectionUnsupportedError`) until #23/#25/#27 implement theirs. Rationale: implementing executable projections for content shapes those tickets own risks divergence; a throw is stronger than a strip — no leak path exists at all. The target field lists are enumerated in §4.3 and in the contract file's TSDoc so M2 extends, not invents.
- **D7 — Consumer proof: ship minimal `GET /daily/binairo` in apps/api.** AC 5 says "through any route or payload" — that needs a real route; `binairo/types.ts` TSDoc explicitly assigns "a Zod response schema without `solution`" to "the #17 server boundary". #18 keeps its full scope: UI, play state, completion submission, session wiring — it consumes this route and adds its own.
- **D8 — `published_at` computed DB-side**: `(date::timestamp AT TIME ZONE 'America/Sao_Paulo')` in the INSERT expression — Postgres tzdata owns the instant; no JS-constructed date in any insert (house rule, `schema.ts` TSDoc).
- **D9 — "Today" comes from the DB clock**: `(now() AT TIME ZONE 'America/Sao_Paulo')::date` — ADR-0010 "single authority", eliminates server-clock skew.
- **D10 — Remote config is a DB table** (`remote_config`: key/jsonb), read through a typed accessor with in-code defaults (`bufferDepth: 7`); no row needed to start; tuning = one INSERT/UPDATE, no deploy, no new vendor (rejects Edge Config and env vars).
- **D11 — Composite PK `(game, date)`**, `game` as `text` + CHECK constraint (not pgEnum — avoids enum-migration pain). The PK is the `ON CONFLICT` idempotency anchor and covers the hot read.
- **D12 — Buffer depth = days of coverage**: `count(*) where game = ? and date >= today_SP and killed_at is null`. After a full run: 7 (today + 6 future). Alert threshold: `BUFFER_ALERT_THRESHOLD = 4` — a code constant for now (buffer depth is the remote tunable AC 4 names; the threshold can become one later, flagged not-ADR-weight).
- **D13 — Empty buffer at rollover ⇒ `GET /daily/binairo` returns 404**, body `{}`. No on-demand generation fallback, ever: it would bypass "pre-generated and validated" (ADR-0010) and open a CPU DoS. The alerting exists to make this state near-impossible; the 404 client copy is #18's.
- **D14 — Rows are immutable once inserted** (published or not); `killed_at` is the sole mutation. No regeneration, no deletes on validator change.
- **D15 — Cron auth fails closed**: missing/mismatched bearer → 401; unset `CRON_SECRET` → 401. Comparison is hash-then-`timingSafeEqual` (SHA-256 both sides via `node:crypto`, three lines) — after ADR-0022 engineered timing-sensitive comparisons out of the codebase, this endpoint won't reintroduce one. Explicitly not imitating WEB_ORIGIN's fail-open (an open publish endpoint is a Sudoku-grading DoS in M2).
- **D16 — The dangerous surface is a separate package entry (the mechanical wall).** The root entry `@miolos/db` exports only the wall + prior art; a new subpath `@miolos/db/publishing` (same `package.json#exports` mechanism as the existing `./testing`) carries everything that can bypass the wall: the raw `dailyPuzzles`/`remoteConfig` table objects, the buffer module (including the `insertDailyPuzzle` write), `getRemoteConfig`, and `getPublishedDailyWithSolution`. Client-serving code importing `@miolos/db` **cannot reach** raw tables or solutions — the bypass simply isn't in the module it imports. `apps/api` (cron; #18 grading) imports the subpath; apps/web never does — the rule is recorded in ADR-0024, enforced by the barrel tripwire tests (§8 T-DB-9) and, when web gains the db dep, by an ESLint `no-restricted-imports` ban on `@miolos/db/publishing` in `apps/web` (a named #18 duty in ADR-0024).
- **ADRs**: write **ADR-0024** "The daily buffer stores validated content, reads are stripped inside the wall, and the wall is the package surface" (D1+D2+D3+D4/D5/D6+D16 — supersedes nothing, concretizes ADR-0010/0014). It also records three operational semantics: (i) a killed daily ⇒ `GET /daily/<game>` 404, no replacement puzzle; (ii) rows are immutable and the buffer is ~`bufferDepth` days deep, so any M2 content-shape change must keep the read-side schema parsing rows generated up to `bufferDepth` days earlier (a hard backward-compat duty for #23/#25/#27); (iii) the manual-SQL kill procedure (§11.6). And **ADR-0025** "Remote config is a database table read through a typed accessor" (D10). Both short. D12/D13/D15 are plan-level, recorded here and in code TSDoc — not ADR-weight.

## 2. `packages/core` changes

### 2.1 `src/game.ts` (new)
```ts
export const GAMES = ["binairo", "sudoku", "nonogram", "termo"] as const;
export type Game = (typeof GAMES)[number];
export const gameSchema = z.enum(GAMES);
```
Canonical game vocabulary (CONTEXT.md terms). `packages/db` gains a `@miolos/core` workspace dep to use it (core stays dependency-pure: zod only).

### 2.2 `src/contracts/daily.ts` (new)
- `binairoDailyContentSchema` — the **server-side** shape of `content` jsonb, mirrors `BinairoPuzzle` exactly, built with `z.strictObject` (zod 4 idiom): `{ size: z.literal(8), seed: z.number().int().nonnegative(), weekday: z.number().int().min(1).max(7), givens: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(64), solution: z.array(z.union([z.literal(0), z.literal(1)])).length(64), givensCount: z.number().int(), requiredTier: z.union([z.literal(1), z.literal(2)]) }`. Parsed by the cron **before insert** and by the helper **after read** (jsonb is untyped at the boundary — Zod, never cast). **Strictness decision (A4): strict, deliberately.** An engine-added field fails the cron's pre-insert parse → the buffer drains → the alert fires: fail-closed against unreviewed content-shape drift, at the cost of a (loud, wanted) alarm on benign additive fields. TSDoc records this and the corollary: changing the content shape means updating this schema in the same PR, and the read side must keep parsing rows generated up to `bufferDepth` days earlier (ADR-0024 semantics (ii)).
- `dailyBinairoResponseSchema` — the public projection, `z.strictObject`: `{ game: z.literal("binairo"), date: isoDateString, size: z.literal(8), givens: <as above> }`. **No `seed`** (with a stored deterministic engine, seed ⇒ solution), no `solution`, no `weekday` (client derives), no `requiredTier` (YAGNI; #18 may extend).
- `dailyPuzzleResponseSchema = z.discriminatedUnion("game", [dailyBinairoResponseSchema])` — the extension point M2 games join.
- `isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (shared with §2.3).
- `stripDailyContent(game: Game, date: string, content: unknown): DailyPuzzleResponse` — pure; `switch (game)`: binairo → parse content with `binairoDailyContentSchema`, build `{ game, date, size, givens }` by **allowlist pick**, return `dailyBinairoResponseSchema.parse(...)`; `sudoku` / `nonogram` / `termo` → `throw new DailyProjectionUnsupportedError(game)` (exported error class). TSDoc carries the §4.3 strip table verbatim as the M2 contract.

### 2.3 `src/contracts/cron.ts` (new)
- `cronPublishResponseSchema` = `{ game: z.literal("binairo"), generated: z.number().int().min(0), depth: z.number().int().min(0), failures: z.array(z.object({ date: isoDateString, reason: z.string() })) }`.
- `bufferDepthResponseSchema` = `{ depths: z.object({ binairo: z.number().int().min(0) }), threshold: z.number().int().positive(), shallow: z.boolean() }`.

### 2.4 `src/remote-config.ts` (new)
```ts
export const remoteConfigSchema = z.object({
  bufferDepth: z.number().int().min(1).max(30).default(7),
});
export type RemoteConfig = z.infer<typeof remoteConfigSchema>;
export const defaultRemoteConfig: RemoteConfig = remoteConfigSchema.parse({});
```
The 1..30 clamp is the "never derive loop bounds from untrusted input" duty (sudoku `generate.ts` TSDoc, generalized to depth). Mirrors the `defaultFeatureFlags` dormant-seam pattern.

### 2.5 `src/index.ts` — export all of the above from the barrel.

## 3. `packages/db` changes

### 3.1 `src/schema.ts` — two new tables (keep house TSDoc style, cite ADR-0004/0010 and this plan)
```ts
import { bigint, check, date, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { GAMES } from "@miolos/core";

export const dailyPuzzles = pgTable(
  "daily_puzzles",
  {
    game: text("game", { enum: GAMES }).notNull(),
    date: date("date", { mode: "string" }).notNull(),     // SP calendar day; string mode avoids JS Date tz mangling
    seed: bigint("seed", { mode: "number" }).notNull(),   // random uint32 (D2); bigint: PG integer is signed-31-bit
    content: jsonb("content").notNull(),                  // full validated engine output incl. solution (D1)
    publishedAt: timestamptz("published_at").notNull(),   // SP midnight of `date`, as an instant, derived DB-side (D8)
    killedAt: timestamptz("killed_at"),                   // kill switch: null = alive; set via sql`now()` only (ADR-0022 evidence style)
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.game, t.date] }),            // idempotency anchor + hot-read index (D11)
    check("daily_puzzles_game_check",
      sql`${t.game} in ('binairo', 'sudoku', 'nonogram', 'termo')`),
  ],
);

export const remoteConfig = pgTable("remote_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
```
Migration: `pnpm -F @miolos/db db:generate` → commit `migrations/0001_*.sql` + `meta/` untouched by hand. If drizzle-kit's `check()` output misbehaves, fall back to pgEnum and note it in the PR — do not hand-edit SQL.

### 3.2 `src/published.ts` (new) — **the wall.** Every export enforces `published_at <= now() AND killed_at IS NULL` in SQL (`now()` = DB clock, never `new Date()`). Module TSDoc: "This module is ADR-0004's entire wall (ADR-0010). Every exported reader carries the predicate; the dedicated suite in test/published.test.ts may never be weakened (issue #17 AC 1)."
```ts
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Solution-free projection of today's daily (DB-clock SP today). undefined = nothing published (D13). */
export async function getTodayDaily(db: Db, game: Game): Promise<DailyPuzzleResponse | undefined>;

/** Same wall, explicit date — future dates return undefined by the predicate, not by argument checks. */
export async function getPublishedDaily(db: Db, game: Game, date: string): Promise<DailyPuzzleResponse | undefined>;

/** Full row incl. solution, for judging completions (#18). Same predicate: only PUBLISHED, unkilled rows — the buffer module is the sole reader of unpublished rows. Exported ONLY from @miolos/db/publishing (D16), never from the root entry. */
export async function getPublishedDailyWithSolution(db: Db, game: Game, date: string): Promise<DailyPuzzleRow | undefined>;
```
Implementation notes: shared internal `wallPredicate(game, date?)` = `and(eq(dailyPuzzles.game, game), …, sql\`${dailyPuzzles.publishedAt} <= now()\`, isNull(dailyPuzzles.killedAt))`; today variant uses `sql\`${dailyPuzzles.date} = (now() at time zone 'America/Sao_Paulo')::date\``. Default readers return `stripDailyContent(game, row.date, row.content)` — strip inside the wall (D4), Zod-parsed (never cast). `DailyPuzzleRow` = drizzle inferred select type, exported as a type.

### 3.3 `src/buffer.ts` (new) — cron-side, **not part of the public wall**; reachable only through `@miolos/db/publishing` (D16), never from the root entry — client-serving code cannot import it by construction, not by reviewer vigilance. Module TSDoc states this.
```ts
/** DB-clock SP calendar date, 'YYYY-MM-DD'. */
export async function todaySaoPaulo(db: Db): Promise<string>;                       // select (now() at time zone 'America/Sao_Paulo')::date

/** Dates already buffered for game with date >= fromDate (reads unpublished rows — cron only). */
export async function listBufferedDates(db: Db, game: Game, fromDate: string): Promise<string[]>;

/** ON CONFLICT (game, date) DO NOTHING; published_at derived in the same INSERT (D8). Returns true iff a row was inserted. */
export async function insertDailyPuzzle(db: Db, row: { game: Game; date: string; seed: number; content: unknown }): Promise<boolean>;

/** Days of coverage: count(date >= today_SP AND killed_at IS NULL) (D12). Also the monitoring query (AC 3). */
export async function bufferDepth(db: Db, game: Game): Promise<number>;
```
`insertDailyPuzzle` sets `publishedAt: sql\`(${row.date}::date)::timestamp at time zone 'America/Sao_Paulo'\`` and detects insertion via bare `.returning()` length (union-`Db` overload precedent in `session/service.ts`).

### 3.4 `src/remote-config.ts` (new)
```ts
/** All rows → { [key]: value } → remoteConfigSchema. Missing table rows or invalid values fall back to defaults (safeParse; console.error once per process on invalid) — the cron must run against an empty table. */
export async function getRemoteConfig(db: Db): Promise<RemoteConfig>;
```

### 3.5 Package surface (D16 — the B1 fix)
- **`src/index.ts` (root entry — wall-only + prior art).** Existing exports unchanged (`users`, `sessions`, `createDb`, `getDb` seam types, `Db`, current operator re-exports) **plus** `getTodayDaily`, `getPublishedDaily`, `SAO_PAULO_TIME_ZONE` and the public response types. Schema re-exports are **named** — if the barrel currently uses `export *` from `schema.ts`, convert to named exports so `dailyPuzzles`/`remoteConfig` never leak through it. The root never exports: the new table objects, anything from `buffer.ts` or `remote-config.ts`, or `getPublishedDailyWithSolution`.
- **`src/publishing.ts` (new entry — the dangerous surface).** Exports `dailyPuzzles`, `remoteConfig`, `getPublishedDailyWithSolution`, the four `buffer.ts` accessors, `getRemoteConfig`, plus any extra drizzle operators only the cron path needs. Module TSDoc: "Server-internal surface. apps/web must never import `@miolos/db/publishing` (ADR-0024); apps/api and tests only."
- Extra drizzle operators needed by **wall** consumers (if any) are re-exported from the root as today (house comment: consumers take no direct drizzle-orm dep under pnpm's isolated linker); operators only the cron needs live on the publishing entry.

### 3.6 `package.json` — `exports` gains `"./publishing": "./src/publishing.ts"` (beside the existing `"."` and `"./testing"`); add dep `"@miolos/core": "workspace:*"`; add devDeps `vitest` (same 4.1.10) and `fast-check` (current stable, verify at install); add script `"test": "vitest run"` (turbo's `test` task picks it up; db has no `build`, which turbo tolerates).

## 4. Strip table (the per-game contract, D6 — goes verbatim into `contracts/daily.ts` TSDoc)

| Game | Public projection (allowlist) | Withheld (never in a default read) | Implemented |
|---|---|---|---|
| binairo | `game, date, size, givens` | `solution`, `seed`, `weekday`, `givensCount`, `requiredTier` | **#17 (this plan)** |
| sudoku | `game, date, givens, tier` | `solution`, `seed`, `clueCount` | #23 (throws until then) |
| nonogram | `game, date, size, clues` | entire `reveal` (`motifId`, `name`, `mirrored`, `solution` — motif identity is a spoiler), `seed`, `weekday` | #25 (throws until then) |
| termo | `game, date` only | the answer word, in any field; guesses are judged server-side | #27 (throws until then) |

`seed` is withheld for **every** game: engines are deterministic, so a seed is the solution.

## 5. The cron — `apps/api`

### 5.1 `app/cron/publish/route.ts`
- `export const dynamic = "force-dynamic";` `GET` only; **no CORS** (not a browser endpoint); no OPTIONS.
- Auth first (D15): unset `CRON_SECRET` → 401; otherwise SHA-256 both the received header and `` `Bearer ${secret}` `` (`node:crypto` `createHash`) and compare digests with `timingSafeEqual` — equal-length inputs by construction, no timing-sensitive comparison (ADR-0022 posture). Mismatch → `new Response(null, { status: 401 })`. Vercel auto-sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
- Then: `getDb()` → `getRemoteConfig(db)` → `topUpBinairoBuffer(db, config.bufferDepth)` → structured log `console.log(JSON.stringify({ event: "cron-publish", game: "binairo", generated, depth, failures }))` → body `cronPublishResponseSchema.parse(...)` → `Response.json(body, { status: depth >= effectiveThreshold(config.bufferDepth) ? 200 : 500 })` where `effectiveThreshold(d) = Math.min(BUFFER_ALERT_THRESHOLD, d)` (A3: a deliberately tuned depth below 4 must not make every healthy run red forever). The non-2xx-on-shallow is Vercel-log observability only; AC 3's alerting is §6.

### 5.2 `src/publishing/service.ts`
```ts
export const BUFFER_ALERT_THRESHOLD = 4;   // D12; shared with the /buffer-depth route
export function effectiveThreshold(configuredDepth: number): number { return Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth); }  // A3
const MAX_SEED_RETRIES_PER_DATE = 8;       // engine already caps 64 attempts per seed internally

export async function topUpBinairoBuffer(db: Db, depth: number): Promise<{ generated: number; depth: number; failures: { date: string; reason: string }[] }>
```
Algorithm (idempotent reconciliation — Vercel crons have no retries, and both missed and duplicate runs are documented behavior):
1. `today = await todaySaoPaulo(db)` (D9).
2. `existing = new Set(await listBufferedDates(db, "binairo", today))`.
3. For `offset` 0..depth-1 (depth already 1..30-clamped by Zod): `target = addDays(today, offset)`; skip if in `existing`. `weekday = isoWeekdayOf(target)`; guard with `isWeekday` from `@miolos/games` (RangeError otherwise — unreachable, but the engines demand the guard at untyped boundaries).
4. Up to `MAX_SEED_RETRIES_PER_DATE`: `seed = randomUint32()` (Web Crypto `crypto.getRandomValues(new Uint32Array(1))`); `puzzle = generateBinairo({ seed, weekday })` (catch `BinairoGenerationError` → next seed); `validateBinairo(puzzle, weekday)` must approve (ADR-0010 "pre-generates **and validates**" — explicit re-validation, belt and suspenders); `binairoDailyContentSchema.parse(puzzle)`; `insertDailyPuzzle(db, { game: "binairo", date: target, seed, content: puzzle })` — a `false` return (concurrent duplicate lost the `ON CONFLICT` race) still counts the date as covered.
5. All retries exhausted → push `{ date, reason }` to `failures`, continue with remaining dates (never abort the run).
6. Return `{ generated, depth: await bufferDepth(db, "binairo"), failures }`.

Never updates or deletes existing rows (D14).

### 5.3 `src/publishing/dates.ts` — pure, tz-free date math (weekday-of-a-fixed-date needs no timezone; only "today" does, and that is D9's SQL):
```ts
export function addDays(date: string, days: number): string;   // via Date.UTC triple, back to 'YYYY-MM-DD'
export function isoWeekdayOf(date: string): number;            // ((getUTCDay() + 6) % 7) + 1  → Mon=1..Sun=7
```

### 5.4 `vercel.json`
```json
{
  "ignoreCommand": "npx turbo-ignore",
  "crons": [{ "path": "/cron/publish", "schedule": "0 6 * * *" }]
}
```
Schedules are UTC-only; 06:00 UTC = 03:00 São Paulo, comfortably after the 03:00 UTC SP-midnight rollover. Hobby-plan jitter (invocation anywhere in the hour, once daily) is irrelevant by construction — the buffer absorbs it. Crons hit the production deployment only.

### 5.5 Config plumbing
- `.env.example`: add `CRON_SECRET` with rationale block (Vercel sends it as the Bearer token on cron invocations; endpoint fails closed when unset; generate with `openssl rand -hex 32`; set via `vercel env add`).
- `package.json`: add `"@miolos/games": "workspace:*"`.
- `next.config.ts`: `transpilePackages` gains `"@miolos/games"` — **update `test/next-config.test.ts` if it pins the list** (it exists; check).

## 6. Monitoring and alerting (AC 3)

Three layers, depth-derived, never cron-exit-derived:
1. **Depth query** `bufferDepth` lives in `packages/db` (§3.3), tested on PGlite.
2. **`GET /buffer-depth`** — `app/buffer-depth/route.ts`, public (depth is not sensitive; no content, no dates), `force-dynamic`, `corsHeaders()` without credentials, body `bufferDepthResponseSchema.parse({ depths: { binairo }, threshold: effectiveThreshold(config.bufferDepth), shallow: binairo < effectiveThreshold(config.bufferDepth) })` (A3 — the reported `threshold` field is the effective one), always 200 (the poller reads `shallow`, not the status).
3. **`.github/workflows/buffer-alert.yml`** — `schedule: "30 7 * * *"` (after the 06:00–06:59 UTC cron window) + `workflow_dispatch` with a `force_shallow` boolean input (treats the response as shallow regardless of the flag — the A7 end-to-end alert drill, E6). **Zero marketplace actions** (A2, the #41 pinning convention satisfied by having nothing to pin): no `actions/checkout`, plain `run:` steps only — `curl`/`jq`/`gh` are preinstalled on `ubuntu-latest`, and `gh` works checkout-free with `env: GH_TOKEN: ${{ github.token }}` and `-R fernandolisboa/miolos`. Top-level `permissions: issues: write` and nothing else. Steps: curl the production `/buffer-depth` (`-fsS`, fail the job on HTTP error → a red scheduled run is itself a notification), `jq .shallow`; when true (or `force_shallow`), `gh issue list --label buffer-alert --state open` → comment on the open one or `gh issue create --label buffer-alert --title "Buffer shallow: <depths JSON>"`. GitHub notification to Fernando = the page (solo phone-driven operator). Create the `buffer-alert` label during step 8. The production API origin is read from a workflow env var set to the real miolos-api domain — **confirm the exact domain during implement** (`vercel project ls` / NEXT-SESSION.md), do not guess it into the YAML.

## 7. Consumer proof — `GET /daily/binairo` (D7)

`app/daily/binairo/route.ts`:
- `export const dynamic = "force-dynamic";` (a statically cached daily serves yesterday's "today" — session-route precedent comment).
- `GET`: `getDb()` → `getTodayDaily(db, "binairo")` → hit: `Response.json(body, { headers: corsHeaders() })` where body is already schema-shaped by the wall; route re-parses with `dailyPuzzleResponseSchema.parse` (defense in depth — two independent Zod gates, one inside the wall, one at the HTTP boundary). Miss: `Response.json({}, { status: 404, headers: corsHeaders() })` (D13).
- No auth, no cookies, no credentialed CORS: the daily is public content (ADR-0005).
- #18 builds play UX on this route and adds completion submission; #23/#25/#27 add their own routes through the same helper.

## 8. Test plan (named)

House pattern: one PGlite per file (`createTestDb`), truncate between tests, route handlers invoked as functions with `NextRequest`, `vi.mock("../src/db")` as the only mock (seam 4). Test seeding of raw rows imports tables from `@miolos/db/publishing` (apps/api tests) or `../src/schema` (in-package db tests) — never from the root entry, which doesn't export them (D16).

### `packages/db/test/published.test.ts` — **the AC-1 wall suite** (T-DB)
1. `getPublishedDaily returns undefined for a future-dated row` (insert with `published_at = now() + interval '1 day'`).
2. `getTodayDaily returns undefined when only future rows exist`.
3. `a row published exactly at now() is visible` (`published_at = now()` in the insert expression — boundary instant, `<=`).
4. `a row published one second in the future is invisible` (`now() + interval '1 second'`).
5. `the kill switch hides an already-published row` (`killed_at = now()`), and 5b: unkilled twin stays visible.
6. `getPublishedDailyWithSolution enforces the same predicate` (future + killed → undefined; published → row with solution).
7. `the default projection strict-parses and contains no forbidden key at any depth` — recursive key scan of the returned object for `solution`, `seed`, `reveal`, `answer`.
8. **Property (fast-check)**: `for arbitrary offsets, published_at <= now() ⇔ visibility` — integer seconds offset in [-10⁶, 10⁶], insert with `now() + offset * interval '1 second'`, assert visible ⇔ offset ≤ 0 (modest `numRuns`; the wall property from the orchestrator brief).
9. **Tripwires (three, the D16 mechanical guard)**:
   - 9a `the wall module exports exactly the audited set` — `import * as published from "../src/published"`, `expect(Object.keys(published).sort()).toEqual([...])` so a new reader added without wall tests fails here ("no later PR may weaken").
   - 9b `the root barrel exports exactly the wall-only set` — `import * as root from "../src/index"`, exact sorted export-list assertion. Re-exporting `dailyPuzzles`, `remoteConfig`, any buffer accessor, or `getPublishedDailyWithSolution` from the root fails this test — AC 1's "no later PR may weaken" now covers the package **surface**, not just the module.
   - 9c `the publishing entry exports exactly the audited dangerous set` — same shape on `../src/publishing`, so the dangerous surface can't silently grow either.

### `packages/db/test/buffer.test.ts`
- `insertDailyPuzzle is idempotent on (game, date)` (second insert returns false, row unchanged).
- `published_at for 2026-08-01 is exactly 2026-08-01T03:00:00Z` (pins the AT TIME ZONE derivation against tzdata; SP is UTC-3 year-round since 2019 — asserted via tzdata, never hardcoded offset arithmetic in code).
- `bufferDepth counts only alive rows with date >= today` (past rows, killed rows excluded).
- `listBufferedDates returns only dates >= fromDate for the game`.
- `unknown game value is rejected by the CHECK constraint` (raw insert attempt fails — proves the migration carried the constraint).

### `packages/db/test/remote-config.test.ts`
- `empty table yields defaults (bufferDepth 7)`; `a bufferDepth row overrides`; `invalid value falls back to defaults`; `out-of-clamp value (e.g. 500) falls back` (Zod max 30).

### `packages/core/test/daily-contract.test.ts`
- `stripDailyContent(binairo) output strict-parses and carries no solution/seed` — example seeds × all 7 weekdays using real `generateBinairo` output (`@miolos/games` as core devDependency, test-only — runtime purity untouched).
- `dailyBinairoResponseSchema rejects a payload smuggling solution` (`z.strictObject` proof).
- `binairoDailyContentSchema rejects a content payload with an unknown field` (A4 strictness proof — drift fails the pre-insert parse).
- `sudoku, nonogram and termo dispatch throws DailyProjectionUnsupportedError` (fail-closed proof, one test per game).
- `binairoDailyContentSchema round-trips a generated puzzle`.

### `apps/api/test/cron-publish.test.ts` (seam 4, PGlite through the HTTP boundary)
- `401 without Authorization`, `401 with a wrong bearer`, `401 when CRON_SECRET is unset` (fail-closed, D15).
- `tops up an empty database to depth 7` — 7 rows, dates = SP-today..+6; every row's content parses `binairoDailyContentSchema` **and** re-passes `validateBinairo` for `isoWeekdayOf(date)` (proves the weekday mapping end to end).
- `a second run generates nothing` (idempotent; `generated: 0`).
- `a partial buffer is topped up, existing rows untouched` (byte-identical content on preexisting rows — D14).
- `response parses cronPublishResponseSchema and reports depth`.
- `depth below the effective threshold returns 500` (A3 shape: after a normal run kill today+tomorrow's rows via raw SQL, re-run → depth < min(4, 7) → 500, body still parses; killing is the one sanctioned mutation, so this seeding is honest).
- `a tuned-low depth is healthy, not alarming` (A3: remote_config bufferDepth=2 → run → depth 2 ≥ min(4, 2) → **200**).
- `remote_config bufferDepth=3 generates exactly 3 rows` (AC 4: depth is remotely tuned).

### `apps/api/test/daily-binairo.test.ts`
- `200 with today's puzzle; body strict-parses dailyPuzzleResponseSchema`.
- `body contains no solution/seed/reveal/answer key at any depth` (leak scan, not just parse success).
- `404 when only future rows exist` and `404 when today's row is killed` (wall through the real route).
- `future rows never appear regardless of offset` (insert offsets +1, +2, +30 days; response unchanged).
- `route exports dynamic = "force-dynamic"`.

### `apps/api/test/buffer-depth.test.ts`
- `reports per-game depth, effective threshold and shallow=false at 7`; `shallow=true below the effective threshold`; `tuned bufferDepth=2 with depth 2 reports shallow=false` (A3); `parses bufferDepthResponseSchema`.

### `apps/api/test/publishing-dates.test.ts`
- `addDays crosses month and year ends` (2026-08-31+1, 2026-12-31+1, leap 2028-02-28+1).
- `isoWeekdayOf: 2026-08-03 → 1 (Mon), 2026-08-02 → 7 (Sun)`.

## 9. File-by-file change list

| File | Change |
|---|---|
| `docs/plans/014-issue-17-plan-publication-pipeline.md` | this plan (adapted); + row in `docs/README.md` table (014; **015=#39 and 016=#43 are in flight — expect a trivial adjacency conflict at merge, take both rows**) |
| `docs/adr/0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md` | new ADR (D1–D6 + D16 surface rule incl. the #18 ESLint duty, plus the three operational semantics) |
| `docs/adr/0025-remote-config-is-a-database-table.md` | new ADR (D10) |
| `packages/core/src/game.ts` | new |
| `packages/core/src/contracts/daily.ts` | new (schemas + `stripDailyContent` + strip table TSDoc) |
| `packages/core/src/contracts/cron.ts` | new |
| `packages/core/src/remote-config.ts` | new |
| `packages/core/src/index.ts` | barrel exports |
| `packages/core/package.json` | devDep `@miolos/games: workspace:*` (tests only) |
| `packages/core/test/daily-contract.test.ts`, `test/remote-config.test.ts` | new |
| `packages/db/src/schema.ts` | + `dailyPuzzles`, `remoteConfig` |
| `packages/db/migrations/0001_*.sql` + `meta/` | generated, committed verbatim |
| `packages/db/src/published.ts`, `src/buffer.ts`, `src/remote-config.ts` | new |
| `packages/db/src/publishing.ts` | new entry — the dangerous surface (D16) |
| `packages/db/src/index.ts` | + wall-only exports (named, no new tables), + drizzle operator re-exports |
| `packages/db/package.json` | + `exports["./publishing"]`, + dep `@miolos/core`, devDeps `vitest`/`fast-check`, `"test"` script |
| `packages/db/test/published.test.ts`, `buffer.test.ts`, `remote-config.test.ts` | new |
| `apps/api/app/cron/publish/route.ts`, `app/daily/binairo/route.ts`, `app/buffer-depth/route.ts` | new |
| `apps/api/src/publishing/service.ts`, `src/publishing/dates.ts` | new |
| `apps/api/vercel.json` | + `crons` |
| `apps/api/.env.example` | + `CRON_SECRET` |
| `apps/api/package.json` | + `@miolos/games` |
| `apps/api/next.config.ts` (+ `test/next-config.test.ts` if it pins) | + transpile `@miolos/games` |
| `apps/api/test/{cron-publish,daily-binairo,buffer-depth,publishing-dates}.test.ts` | new |
| `.github/workflows/buffer-alert.yml` | new |

Nothing in `apps/web` (no web consumer yet — deferred to #18+, ADR-0014 note suffices). Nothing touches UI → **`npx impeccable detect` not applicable**; state so in the PR.

## 10. Branch, commits, PR, rollout

**Branch**: `feat/17-publication-pipeline` off freshly pulled `main`.

**Commits** (Conventional, each pre-commit-green):
1. `docs: add the publication-pipeline plan (014) for #17`
2. `feat(core): game vocabulary, daily contracts with wall-side stripping, remote-config and cron schemas`
3. `feat(db): daily_puzzles and remote_config tables with migration`
4. `feat(db): published-predicate wall, buffer accessors and remote-config reader`
5. `feat(api): publish cron with idempotent top-up behind CRON_SECRET`
6. `feat(api): daily binairo route and buffer-depth endpoint`
7. `ci: buffer-depth alert workflow`
8. `docs: ADR-0024 (buffer stores validated content) and ADR-0025 (remote config table)`

**Verification (evidence rule — paste real output), from repo root:**
```sh
source "$HOME/.nvm/nvm.sh" && nvm use
pnpm install               # lockfile change: new workspace deps
pnpm typecheck
pnpm lint
pnpm test                  # full suite, all packages incl. new db suite
```

**PR skeleton**: What changed (pipeline + wall + one consumer route + the `@miolos/db` surface split); Verification (the four outputs inline); Decisions surfaced to Fernando — none blocking, FYI list: D16 dangerous surface moved to `@miolos/db/publishing` with barrel tripwires (the ADR-0004 wall is now the package surface, not a convention), D6 fail-closed strips for M2 games, D7 route shipped here not #18, D12 threshold constant 4 (effective threshold = min(4, configured depth), A3), D13 empty-buffer = 404, alert channel = GitHub issue via scheduled Action. Review→fix loop per step 6/7; merge only when the mechanical gate is green.

**Step-8 production rollout (AC 2), in order, evidence pasted into the PR/issue:**
- E0. `openssl rand -hex 32` → `vercel env add CRON_SECRET production --cwd apps/api` (value never committed/logged).
- E1. Pull prod env (`vercel env pull --cwd apps/api --environment production`), run `pnpm -F @miolos/db db:migrate` with the **unpooled** URL (drizzle.config already binds `DATABASE_URL_UNPOOLED`); paste migration output. Additive migration — safe to run before the deploy.
- E2. Merge PR → miolos-api auto-deploys; the deploy registers the cron from `vercel.json`. Evidence: Vercel dashboard/CLI cron listing.
- E3. First-run proof: `curl -s -H "Authorization: Bearer $CRON_SECRET" https://<api-domain>/cron/publish` → expect `{"game":"binairo","generated":7,"depth":7,"failures":[]}`. Also prove 401 without the header.
- E4. Buffer evidence (AC 2): `psql "$DATABASE_URL_UNPOOLED" -c "select game, date, published_at, (content ? 'solution') as stored_solution, killed_at from daily_puzzles order by date;"` — 7 rows, future-dated, output pasted.
- E5. Wall in production: `curl https://<api-domain>/daily/binairo` → 200, body has no `solution` (pipe through `jq 'has("solution")'` → false); `curl https://<api-domain>/buffer-depth` → `shallow: false`.
- E6. Create the `buffer-alert` label; `gh workflow run buffer-alert.yml` → green run log showing depth read. Then the **A7 alert drill**: `gh workflow run buffer-alert.yml -f force_shallow=true` → the workflow opens a `buffer-alert` issue and Fernando confirms the GitHub notification actually reached his phone (the whole alerting chain proven end to end, not just a green log); close the drill issue afterwards.
- E7. Close #17 quoting E1–E6 against the ACs.

## 11. Risks and landmines (carry into implementation)

1. **RSC leakage** — mitigated structurally by D4/D5/D6 **and mechanically by D16**: the root `@miolos/db` entry contains no raw table, no buffer accessor and no `…WithSolution`, so client-serving code cannot reach a solution-bearing row through the import it is allowed to have; the barrel tripwires (T-DB-9b/9c) fail any PR that widens either surface. Residual risk: `apps/api` route code can import `@miolos/db/publishing` — acceptable because api routes are the judging/cron server by design; apps/web gets the ESLint `no-restricted-imports` ban when it gains the db dep (#18 duty, named in ADR-0024).
2. **Cron auth** — fail-closed (D15); never copy WEB_ORIGIN's fail-open; the 401 path is tested including the unset-secret case.
3. **Duplicate/missed cron runs are documented Vercel behavior** — idempotent top-up + `ON CONFLICT DO NOTHING`; the composite PK arbitrates concurrent double-fire (a lost race discards a candidate, harmless).
4. **tz math** — one derivation, DB-side (`AT TIME ZONE`), pinned by the 03:00:00Z test; weekday math is tz-free; never hardcode UTC-3.
5. **Buffer exhaustion at rollover** → daily route 404s (D13); alerting exists to prevent it; no generation fallback.
6. **Immutability** — no code path updates `content`/`seed`/`published_at` after insert; kill = set `killed_at` via `sql\`now()\`` (no admin surface in M1 — a manual SQL statement, documented in ADR-0024).
7. **pnpm isolated linker** — every new drizzle operator re-exported from `@miolos/db` or api/web imports fail.
8. **Migrations discipline** — generated SQL committed untouched; PGlite runs the committed artifact; prod migrate via unpooled URL only.
9. **Instant Rollback does not update crons** — ops note in ADR-0024, not code.
10. **`seed` in any response = solution** — the leak-scan tests grep for it explicitly.

## Step-4 changelog

| Finding | Disposition |
|---|---|
| **B1** (blocking — wall was convention-only) | **Applied, review's prescription adopted in full as D16.** New `@miolos/db/publishing` subpath entry (`./testing` precedent confirmed in `packages/db/package.json#exports`) carries the dangerous surface: `dailyPuzzles`/`remoteConfig` tables, the buffer module (incl. the `insertDailyPuzzle` write), `getRemoteConfig`, `getPublishedDailyWithSolution`. Root `@miolos/db` stays wall-only + prior art with named schema exports — client-serving code cannot reach a bypass through the import it is allowed to have. Tripwire extended to three exact export-list assertions (T-DB-9a module / 9b root barrel / 9c publishing entry). ADR-0024 records the surface rule and names the #18 ESLint `no-restricted-imports` duty for apps/web. Updated: §0 AC map, §1 (D16 + ADR bullet), §3.2, §3.3, §3.5 (rewritten), §3.6 exports, §8 (house pattern seeding note + tripwires), §9 file list, §10 PR skeleton, §11.1. |
| A2 (workflow action pinning) | **Applied** — zero marketplace actions: plain `run:` steps with preinstalled `curl`/`jq`/`gh` (`GH_TOKEN: ${{ github.token }}`, `-R fernandolisboa/miolos`, no checkout), explicit `permissions: issues: write` only (§6.3). Nothing to pin satisfies the #41 convention by construction. |
| A3 (500-on-shallow fights the tunable) | **Applied** — `effectiveThreshold(d) = min(BUFFER_ALERT_THRESHOLD, d)` used in the cron status, the `/buffer-depth` `threshold` field and `shallow` flag (§5.1, §5.2, §6.2); cron/buffer-depth tests reshaped: tuned depth 2 is now asserted healthy (200, shallow=false), the 500 path is produced honestly via killed rows (§8). |
| A4 (content-schema strictness undecided) | **Applied** — decided **strict** (`z.strictObject`, zod 4 idiom, also adopted for the response schemas): engine shape drift fails the cron's pre-insert parse → buffer drains → alert; fail-closed matches the project posture, rationale in the contract TSDoc plus a dedicated rejection test (§2.2, §8 core tests). |
| A5 (ADR-0024 operational semantics) | **Applied** — ADR-0024 now records (i) killed daily ⇒ 404, no replacement; (ii) read-side schemas must keep parsing rows up to `bufferDepth` days old (backward-compat duty for #23/#25/#27, cross-referenced from the A4 TSDoc); (iii) the manual-SQL kill procedure (§1 ADR bullet). |
| A6 (secret comparison not constant-time) | **Applied** — SHA-256 both sides then `timingSafeEqual` (`node:crypto`), three lines; keeps ADR-0022's "no timing-sensitive comparison exists anywhere" true (§1 D15, §5.1). |
| A7 (prove the alert pages) | **Applied** — `workflow_dispatch` gains a `force_shallow` input; E6 adds an end-to-end alert drill: forced-shallow run opens a real `buffer-alert` issue and Fernando confirms the notification reached his phone, then the drill issue is closed (§6.3, §10 E6). |
