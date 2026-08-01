# 0024 — The daily buffer stores validated content, reads are stripped inside the wall, and the wall is the package surface

Status: accepted
Date: 2026-07-31

## Context

ADR-0010 made publication a time predicate over pre-generated,
pre-validated `daily_puzzles` rows, enforced by one shared helper — "the
shared helper is the entire wall" — and left the helper's home to the
ticket that creates it (ADR-0014: `packages/db` or `packages/core`).
Issue #17 builds that pipeline and has to settle what a buffer row
contains, how a solution-bearing row is kept out of every client-facing
payload (ADR-0004, including RSC streams, which Next does not strip by
default), and what stops a future consumer from simply querying the raw
table around the helper.

## Decision

1. **A buffer row stores the full validated engine output** in a `content`
   jsonb column — solution included — plus a per-row random seed
   (`crypto.getRandomValues` uint32, stored as `bigint`). Puzzles are never
   regenerated on read: an engine redeploy must never change a published
   puzzle mid-day, and a derivable seed would make future dailies
   precomputable. `published_at` is derived DB-side in the INSERT
   (`(date::timestamp AT TIME ZONE 'America/Sao_Paulo')`); `now()` is
   always the database clock.
2. **The wall lives in `packages/db`** (`src/published.ts`): every exported
   reader carries `published_at <= now() AND killed_at IS NULL` in SQL.
   It needs the schema and drizzle operators, which `packages/core` must
   never depend on.
3. **Default reads strip inside the wall.** Readers return a solution-free
   public projection built by allowlist pick and parsed through strict Zod
   schemas (`packages/core/src/contracts/daily.ts`) — never by deleting a
   `solution` field. Solution access is a separately named
   `getPublishedDailyWithSolution` accessor behind the same predicate.
   Content schemas are strict on purpose: engine shape drift fails the
   cron's pre-insert parse, drains the buffer, and trips the depth alert
   rather than shipping an unreviewed shape.
4. **Unimplemented projections fail closed.** M1 implements binairo's
   projection; the sudoku/nonogram/termo branches throw
   `DailyProjectionUnsupportedError` until #23/#25/#27 implement theirs.
   `seed` is withheld for every game — engines are deterministic, so a
   seed is the solution.
5. **The wall is the package surface.** The root `@miolos/db` entry
   exports only wall readers and prior art — never the `daily_puzzles`/
   `remote_config` table objects, the buffer writers, or
   `…WithSolution`. Those live on a separate `@miolos/db/publishing`
   subpath that only `apps/api` (cron; #18 grading) and tests may import.
   `apps/web` imports the root entry only; when web gains the db
   dependency (#18+), an ESLint `no-restricted-imports` ban on
   `@miolos/db/publishing` in `apps/web` lands with it — a named #18
   duty. Export-list tripwire tests pin all three surfaces
   (`packages/db/test/published.test.ts`), so widening any of them fails
   the suite.

### Operational semantics

- **Kill switch:** a killed daily (`killed_at` set) disappears from every
  reader; `GET /daily/<game>` returns 404 with no replacement puzzle.
  Killing is the sole sanctioned mutation, done manually until an admin
  surface exists:
  `update daily_puzzles set killed_at = now() where game = '<game>' and date = '<YYYY-MM-DD>';`
- **Rows are immutable** once inserted, and the buffer is ~`bufferDepth`
  days deep — so any M2 content-shape change must keep the read-side
  schema parsing rows generated up to `bufferDepth` days earlier. This is
  a hard backward-compatibility duty for #23/#25/#27.
- **Vercel Instant Rollback does not update crons** — after a rollback,
  verify the cron schedule still matches the deployed `vercel.json`.

## Consequences

- Client-serving code cannot reach a solution-bearing row through the
  import it is allowed to have; ADR-0004's guarantee is enforced by the
  module graph and pinned by tests, not by reviewer vigilance.
- The cron (and any future writer) must re-validate and strict-parse
  content before insert; changing a content shape means updating the
  contract schema in the same PR.
- #18 inherits two named duties: the apps/web ESLint ban, and judging
  completions through `getPublishedDailyWithSolution` only.

## Amendment — 2026-07-31 (PR #54 step-6 review; append-only)

- **The wall covers query capability, not just named exports.** The root
  `createDb` builds its drizzle client over a narrowed relational-query
  schema (`users`, `sessions` only), so `db.query.dailyPuzzles` /
  `db.query.remoteConfig` do not exist on a root-entry client. The
  full-schema factory `createPublishingDb` lives on
  `@miolos/db/publishing`. A fourth tripwire (T-DB-9d) pins the root
  client's `db.query` keys.
- **Known residual:** the root entry re-exports drizzle's `sql` (session
  prior art) and every db handle carries `.execute()`, so raw string SQL
  against `daily_puzzles` remains physically reachable from the root
  entry. Typing a table name into an SQL string is a deliberate act, not
  the accident this wall targets. The named #18 ESLint duty is extended:
  besides banning `@miolos/db/publishing` imports in `apps/web`, it must
  flag `daily_puzzles`/`remote_config` string literals in `apps/web`
  source.
- **Accepted for v1: no rate limiting on the public reads.**
  `GET /daily/<game>` and `GET /buffer-depth` are unauthenticated,
  uncached (`force-dynamic`) and unthrottled; each request costs a Neon
  round-trip. No content is at risk and Vercel + Neon absorb casual
  abuse — a recorded cost/availability posture, to be revisited only on a
  real traffic incident.
