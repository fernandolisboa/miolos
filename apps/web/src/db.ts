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
  // #59 / ADR-0026: the credential is the least-privilege `miolos_web` role
  // (select on daily_puzzles only), under a name the Neon–Vercel integration
  // does not manage. Deliberately NO fallback to the integration's variable —
  // a fallback would silently restore the all-tables credential on any env
  // drift and turn ADR-0026's "second enforcement point" claim false while
  // it still read as true. Pinned by T-WEB-S290.
  const url = process.env.WEB_DATABASE_URL;
  if (!url) {
    throw new Error("WEB_DATABASE_URL is not set");
  }
  return createDb(url);
}
