import { computeStreak, streakResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows] = await Promise.all([
      // The DB clock's SP date — the `today` the pure function anchors
      // on. Never new Date().
      todaySaoPaulo(db),
      // Unfiltered rows: the pure function is the streak's only filter
      // (ADR-0009), so this seam exercises the authority.
      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);

    return streakResponseSchema.parse({ date: today, ...status });
  });
}
