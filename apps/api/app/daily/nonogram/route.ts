import { dailyNonogramResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached: a statically cached daily would serve
// yesterday's "today" (session-route precedent).
export const dynamic = "force-dynamic";

/**
 * GET /daily/nonogram — today's daily through the wall (issue #25). The THIRD
 * literal route, and the answer to the question `daily/sudoku/route.ts` left
 * open: a `[game]` dynamic segment would still put an untrusted `params.game`
 * in front of the wall (plan 020 P8). The second half of that argument — that
 * `/daily/termo` would resolve, reach `stripDailyContent` and throw
 * `DailyProjectionUnsupportedError` uncaught — died at #27, which landed the
 * fourth literal route and the last projection.
 *
 * Nothing in `apps/web` consumes this path — the web app fetches `/session`,
 * `/completions` and, since #27, `POST /termo/guess`, which is a user-specific
 * READ that ADR-0014 routes here the same way — and it ships anyway, because
 * it is the operator's
 * machine-readable check that a `killed_at` took effect. Without it two games
 * can be verified with a `curl` and the third only by scraping the web app,
 * and a `limit(1)` indexed read of already-public content is identical in
 * cost and exposure to its two shipped siblings.
 *
 * The daily is public content (ADR-0005): no auth, no cookies, no
 * credentialed CORS. Miss → 404 with an empty body: no on-demand
 * generation fallback, ever (plan 014 D13).
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "nonogram");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Defense in depth: the wall already returns a schema-shaped projection;
  // the HTTP boundary independently re-parses it (two Zod gates, one per
  // enforcement point). Parsed against the NONOGRAM member, never the union —
  // a union parse would accept a mismatched row on this path and lose the
  // assertion (plan 018 §7.4).
  return Response.json(dailyNonogramResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
