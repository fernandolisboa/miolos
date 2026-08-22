import {
  apiErrorResponseSchema,
  computeCalendar,
  statsCalendarResponseSchema,
} from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { getUserSince, listCompletionsForStats } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";
import { ROLLOVER_SLACK_DAYS } from "../../../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import { requireUserId } from "../../../src/session/service";

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
 *
 * No OPTIONS handler: a credentialed GET with no custom request headers is
 * a CORS simple request, so the browser never preflights it.
 */

function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  // The whole body is caught: an unhandled throw would otherwise be the
  // one branch without `no-store` and the CORS grant every intentional
  // branch carries.
  try {
    const db = getDb();
    // `requireUserId` never mints: a cookieless GET is 401, and
    // SessionBootstrap owns minting.
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    // Post-auth, the three reads are independent, so they share one
    // round-trip window. Auth stays FIRST and sequential: a 401 must cost
    // zero queries.
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

    return Response.json(
      // Parse, never cast (boundary rule) — the same strict schema the web
      // client parses on arrival.
      statsCalendarResponseSchema.parse({
        days: computeCalendar(rows, since, today, ROLLOVER_SLACK_DAYS),
      }),
      {
        headers: {
          ...corsHeaders({ credentials: true }),
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}
