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
 * GET /stats/calendar — the #29 day-by-day enumeration (plan 033 §5,
 * ADR-0051), a verbatim clone of the GET /streak authenticated-READ
 * template (ADR-0048). Everything write-shaped is deliberately absent,
 * each absence a decision (plan 027 D6, inherited whole):
 *
 * - No OPTIONS handler and no `preflightResponse` change: a credentialed
 *   GET with no custom request headers is a CORS simple request — the
 *   browser never preflights it.
 * - No origin guard: it protects writes; a read mutates nothing, and its
 *   confidentiality is the CORS allowlist plus the cookie.
 * - No content-type check: there is no body.
 * - No request parameters at all: the user is the cookie, the day is the
 *   DB clock, the range anchor is the account's own birth day. A
 *   `?month=`/`?from=` would be speculative surface — windowing arrives
 *   on a NEW contract if the D4 trigger (1,100 days or 64 KB) ever fires.
 *
 * The payload is exactly what core derived: range start = days[0].date,
 * range end = days.at(-1).date — NO envelope fields (plan 033 §3.3).
 * `ROLLOVER_SLACK_DAYS` is passed into core as a parameter: the bound
 * lives in the route layer (ADR-0026 decision 6), and this route is its
 * ONE consumer — one constant, one owner.
 *
 * It is deliberately NOT the write window. Until #31 both were ONE
 * constant; #31 removed the write window's lower bound
 * entirely (`isWritableDate`, ADR-0053 decision 5) and this clamp stayed
 * at one day, because a clamp that followed the write window would drag
 * the calendar's range back arbitrarily and paint "missed" over days the
 * account did not exist for. This one line is what makes ADR-0053
 * decision 7 true.
 */

/** The per-route error envelope (the completions route's own convention). */
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
  // one branch whose response carries neither `no-store` nor the CORS
  // grant, so the failure mode would leak the discipline every intentional
  // branch keeps (the T-API-S53 pin's reasoning; T-API-S89 pins it here).
  try {
    const db = getDb();
    // `requireUserId` never mints (service.ts): a GET from a cookieless
    // client is 401, and SessionBootstrap owns minting.
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
