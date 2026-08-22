import { computeStats, statsResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStats } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /stats — the statistics aggregates (ADR-0051).
 *
 * The response recomputes from rows on every read — no stored aggregate
 * exists anywhere (ADR-0009, ADR-0049 decision 6). The strict schema is
 * closed to growth: medals arrive on their own endpoint and contract
 * (ADR-0048 decision 3), never here.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows] = await Promise.all([
      // The DB clock's SP date — the `today` the pure function anchors
      // on. Never new Date().
      todaySaoPaulo(db),
      // Unfiltered rows: the pure functions are the statistics' only
      // filter, so this seam exercises the authority.
      listCompletionsForStats(db, userId),
    ]);

    return statsResponseSchema.parse({
      date: today,
      ...computeStats(rows, today),
    });
  });
}
