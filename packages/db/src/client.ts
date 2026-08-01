import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";
import { sessions, users } from "./schema";

/**
 * Relational-query schema of the ROOT client: the wall-safe subset only.
 * `daily_puzzles` and `remote_config` are deliberately absent, so
 * `db.query.dailyPuzzles…` does not exist on a root-entry client — the
 * autocomplete-discoverable relational API cannot bypass the
 * published-predicate wall (ADR-0024, plan 014 D16). Pinned by tripwire
 * T-DB-9d in test/published.test.ts.
 */
const clientSchema = { users, sessions };
type ClientSchema = typeof clientSchema;

/**
 * Union seam: prod (neon-http) and test (PGlite) instances share the query
 * API. Service code written against `Db` runs unchanged on both — the test
 * double differs only in transport, never in SQL. The schema generic is the
 * wall-safe subset; the full-schema test double from `@miolos/db/testing`
 * remains assignable (its extra `query` keys are structurally harmless).
 */
export type Db = NeonHttpDatabase<ClientSchema> | PgliteDatabase<ClientSchema>;

/**
 * Deliberately not a singleton: neon-http is stateless HTTP, so construction
 * is cheap, and per-request acquisition keeps the connection budget explicit
 * (ADR-0014) and the seam mockable in tests.
 */
export function createDb(databaseUrl: string): NeonHttpDatabase<ClientSchema> {
  return drizzle(neon(databaseUrl), { schema: clientSchema });
}

/**
 * Full-schema client for the publishing side (cron; #18 grading):
 * relational-query access to every table, `daily_puzzles` included.
 * Exported ONLY from `@miolos/db/publishing` (ADR-0024, plan 014 D16) —
 * client-serving code never holds a handle that can query the buffer.
 */
export function createPublishingDb(
  databaseUrl: string,
): NeonHttpDatabase<typeof schema> {
  return drizzle(neon(databaseUrl), { schema });
}
