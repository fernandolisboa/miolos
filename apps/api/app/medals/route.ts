import { earnedMedals, medalsResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import {
  listCompletionsForStats,
  listMedalGrants,
  listPublishedDailiesOnWonDates,
} from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows, grants, published] = await Promise.all([
      todaySaoPaulo(db),

      listCompletionsForStats(db, userId),

      listMedalGrants(db, userId),

      listPublishedDailiesOnWonDates(db, userId),
    ]);

    return medalsResponseSchema.parse({
      medals: earnedMedals(rows, grants, today, published),
    });
  });
}
