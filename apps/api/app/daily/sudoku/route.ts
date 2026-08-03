import { dailySudokuResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached: a statically cached daily would serve
// yesterday's "today" (session-route precedent).
export const dynamic = "force-dynamic";

/**
 * GET /daily/sudoku — today's daily through the wall (issue #23). A LITERAL
 * route, not a `[game]` dynamic segment (plan 018 S14): a dynamic segment
 * would save 33 lines and buy an untrusted `params.game` reaching
 * `eq(dailyPuzzles.game, …)`. A literal route simply does not exist for a
 * game that has none, and Next 404s for free.
 *
 * REVISITED AT #25 and again at #27, and kept literal both times. The
 * second half of the original argument — that an unimplemented game's path
 * would resolve, reach `stripDailyContent` and throw
 * `DailyProjectionUnsupportedError` uncaught — DIED at #27: all four games
 * project and nothing can reach that throw any more. The untrusted-`params`
 * half survives and is now the whole reason. Four literal files cost ~100
 * lines total. Revisit only if a fifth game ever makes that arithmetic
 * uncomfortable.
 *
 * The daily is public content (ADR-0005): no auth, no cookies, no
 * credentialed CORS. Miss → 404 with an empty body: no on-demand
 * generation fallback, ever (plan 014 D13).
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "sudoku");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Defense in depth: the wall already returns a schema-shaped projection;
  // the HTTP boundary independently re-parses it (two Zod gates, one per
  // enforcement point). Parsed against the SUDOKU member, never the union —
  // now that the union has two members, a union parse would accept a
  // mismatched row on this path and lose the assertion (plan 018 §7.4).
  return Response.json(dailySudokuResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
