import { computeCalendar, statsCalendarResponseSchema } from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { getUserSince, listCompletionsForStats } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { authenticatedRead } from "../../../src/http/authenticated-read";
import { ROLLOVER_SLACK_DAYS } from "../../../src/publishing/dates";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /stats/calendar — the day-by-day enumeration; see ADR-0051.
 *
 * SECURITY: no request parameters at all — the user is the cookie, the day
 * is the DB clock, the range anchor is the account's own birth day. A
 * `?month=`/`?from=` would be speculative surface; windowing arrives on a
 * new contract if the size trigger (ADR-0051 decision 3) ever fires.
 *
 * The payload is exactly what core derived: range start = days[0].date,
 * range end = days.at(-1).date — no envelope fields.
 *
 * `ROLLOVER_SLACK_DAYS` is passed into core as a parameter: the bound
 * lives in the route layer (ADR-0053 decision 6, amending ADR-0051
 * decision 2), and this route is its ONE consumer — one constant, one
 * owner. It is deliberately NOT the write window: a clamp that followed
 * the write window would drag the calendar's range back arbitrarily and
 * paint "missed" over days the account did not exist for.
 */
export function GET(request: NextRequest): Promise<Response> {
  return authenticatedRead(request, async (db, userId) => {
    // Post-auth, the three reads are independent, so they share one
    // round-trip window.
    const [today, rows, since] = await Promise.all([
      todaySaoPaulo(db),
      listCompletionsForStats(db, userId),
      getUserSince(db, userId),
    ]);
    if (since === undefined) {
      // The user row vanished mid-request (a deletion race, not a client
      // state): the catch-all 500 is the honest answer.
      throw new Error("stats/calendar: user row vanished mid-request");
    }

    // Parse, never cast (boundary rule) — the same strict schema the web
    // client parses on arrival.
    return statsCalendarResponseSchema.parse({
      days: computeCalendar(rows, since, today, ROLLOVER_SLACK_DAYS),
    });
  });
}
