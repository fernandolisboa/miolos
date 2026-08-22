import { asc, eq } from "drizzle-orm";

import type { Db } from "./client";
import { medalGrants } from "./schema";

/**
 * User-scoped, reachable only through `@miolos/db/user`, never the root
 * entry.
 *
 * The caller's curated medal grant ids — the grants input to earned
 * medals. Deterministic order; ≤ one row per medal id (the PK).
 * `granted_at` is deliberately not selected: no date crosses the wire.
 * Rule-derived medals are never read from here — they recompute over
 * `listCompletionsForStats`.
 */
export async function listMedalGrants(
  db: Db,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({ medalId: medalGrants.medalId })
    .from(medalGrants)
    .where(eq(medalGrants.userId, userId))
    .orderBy(asc(medalGrants.medalId));
  return rows.map((row) => row.medalId);
}
