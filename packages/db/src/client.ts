import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

/**
 * Union seam: prod (neon-http) and test (PGlite) instances share the query
 * API. Service code written against `Db` runs unchanged on both — the test
 * double differs only in transport, never in SQL.
 */
export type Db =
  NeonHttpDatabase<typeof schema> | PgliteDatabase<typeof schema>;

/**
 * Deliberately not a singleton: neon-http is stateless HTTP, so construction
 * is cheap, and per-request acquisition keeps the connection budget explicit
 * (ADR-0014) and the seam mockable in tests.
 */
export function createDb(databaseUrl: string): NeonHttpDatabase<typeof schema> {
  return drizzle(neon(databaseUrl), { schema });
}
