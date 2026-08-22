import { dailySudokuResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached — same reason as daily/binairo/route.ts.
export const dynamic = "force-dynamic";

/**
 * GET /daily/sudoku — today's daily through the wall. A LITERAL route,
 * not a `[game]` dynamic segment: a dynamic segment would buy an
 * untrusted `params.game` reaching `eq(dailyPuzzles.game, …)`. A literal
 * route simply does not exist for a game that has none, and Next 404s for
 * free. Four literal files cost ~100 lines total; revisit only if a fifth
 * game ever makes that arithmetic uncomfortable.
 *
 * The daily is public content (ADR-0005): no auth, no cookies, no
 * credentialed CORS. Miss → 404 with an empty body: no on-demand
 * generation fallback, ever.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "sudoku");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Parsed against the SUDOKU member, never the union — a union parse
  // would accept a mismatched row on this path.
  return Response.json(dailySudokuResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
