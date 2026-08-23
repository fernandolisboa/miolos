import { earnedMedals, medalsResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStats, listMedalGrants } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /medals — ADR-0052; ADR-0051 decision 3's "own endpoint and
 * contract".
 *
 * The answer is the earned id SET only — no names, no descriptions, no
 * earnedDate (the client owns the copy; the honest earning day is
 * structurally unavailable for a late-counted feat, ADR-0052). Grants
 * whose id is unknown to the catalog or names a rule-derived definition
 * are ignored inside `earnedMedals`, never an error.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows, grants] = await Promise.all([
      // The DB clock's SP day, never `new Date()`: every rule ignores
      // rows dated after it (ADR-0052).
      todaySaoPaulo(db),
      // Unfiltered rows: the pure function is the medals' only filter
      // (ADR-0049 decision 6 — the SAME reader the statistics recompute
      // over; no second reader exists).
      listCompletionsForStats(db, userId),
      // The curated-grant ids (ADR-0052) — rule-derived medals are never
      // read from storage.
      listMedalGrants(db, userId),
    ]);

    return medalsResponseSchema.parse({
      medals: earnedMedals(rows, grants, today),
    });
  });
}
