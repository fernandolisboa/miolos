import { fullDays, fullDaysResponseSchema } from "@miolos/core";
import {
  listCompletionsForStats,
  listPublishedDailiesOnWonDates,
} from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [rows, published] = await Promise.all([
      listCompletionsForStats(db, userId),
      listPublishedDailiesOnWonDates(db, userId),
    ]);

    return fullDaysResponseSchema.parse({
      dates: fullDays(rows, published),
    });
  });
}
