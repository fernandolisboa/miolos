import { asc, eq } from "drizzle-orm";

import type { Db } from "./client";
import { medalGrants } from "./schema";

/**
 * The #30 curated-grant reader (ADR-0052) — user-scoped, reachable only
 * through `@miolos/db/user` (ADR-0026 decision 5), never the root entry.
 *
 * NO JS `Date` appears in any statement in this file (the completions.ts
 * file-header law) — held trivially: no timestamptz is selected, so the
 * `::text` conversion register (`todaySaoPaulo`/`getUserSince`) isn't
 * needed here either.
 */

/** The caller's curated medal grant ids — the grants input to
 *  earnedMedals (ADR-0052). Deterministic order; ≤ one row per medal id
 *  (the PK). granted_at is deliberately NOT selected: no date crosses
 *  the wire (ADR-0052/D6) — its readers are the merge's least() and the
 *  operator's audit queries. Rule-derived medals are NEVER read from
 *  here — they recompute over listCompletionsForStats. */
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
