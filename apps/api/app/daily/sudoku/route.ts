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
 * `eq(dailyPuzzles.game, …)` plus a 500-on-unimplemented-game hazard, since
 * an unimplemented game's path would resolve, reach `stripDailyContent` and
 * throw `DailyProjectionUnsupportedError` uncaught. A literal route simply
 * does not exist and Next 404s for free.
 *
 * REVISITED AT #25 with three games and kept literal: a `[game]` segment
 * would still put an untrusted `params.game` in front of the wall, and
 * `/daily/termo` would still resolve, reach `stripDailyContent` and throw
 * uncaught. Three literal files cost ~75 lines total and 404 for free.
 * Revisit again only if a game is ever added whose projection exists at
 * build time.
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
