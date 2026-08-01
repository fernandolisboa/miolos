// ADR-0014 (as extended by ADR-0028): this module holds the web app's
// database credential. It must never be reachable from a client bundle —
// `server-only` makes that a build error rather than a review duty, and it
// is the one wall the three ESLint bans and the narrowed root `@miolos/db`
// entry cannot enforce on their own (a `"use client"` module importing
// `../db` would walk around all of them). Pinned as the FIRST line by the
// source tripwire in test/binairo-page.test.tsx (plan 017 D32).
import "server-only";

import { createDb, type Db } from "@miolos/db";

/**
 * Per-request client, deliberately uncached — neon-http is stateless HTTP,
 * so construction is cheap (connection budgeting per ADR-0014). Twin of
 * `apps/api/src/db.ts`; ADR-0002 forbids a shared home for these.
 *
 * This is also the single mock seam for tests: every page reaches the
 * database through it, so `vi.mock("../src/db")` replaces the whole data
 * layer without a PGlite anywhere in apps/web (plan 017 D33).
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return createDb(url);
}
