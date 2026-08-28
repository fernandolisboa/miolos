import { computeCalendar, statsCalendarResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { getUserSince, listCompletionsForStats } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { ROLLOVER_SLACK_DAYS } from "../../../src/publishing/dates";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    const [today, rows, since] = await Promise.all([
      todaySaoPaulo(db),
      listCompletionsForStats(db, userId),
      getUserSince(db, userId),
    ]);
    if (since === undefined) {
      throw new Error("stats/calendar: user row vanished mid-request");
    }

    return statsCalendarResponseSchema.parse({
      days: computeCalendar(rows, since, today, ROLLOVER_SLACK_DAYS),
    });
  });
}
