import { computeStreak, streakResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows] = await Promise.all([
      todaySaoPaulo(db),

      listCompletionsForStreak(db, userId),
    ]);
    const status = computeStreak(rows, today);

    return streakResponseSchema.parse({ date: today, ...status });
  });
}
