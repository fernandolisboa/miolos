import { dailyTermoResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached — same reason as daily/binairo/route.ts.
export const dynamic = "force-dynamic";

/**
 * GET /daily/termo — today's daily through the wall. The FOURTH literal
 * route, for the same reason as `daily/sudoku/route.ts`.
 *
 * The body is TWO KEYS, and that is the entire response: a Termo board
 * starts empty and every guess is judged server-side (ADR-0038), so there
 * is nothing to ship. The 200 therefore means "today is playable" and
 * nothing else — which is why the wall parses the stored content strictly
 * before projecting it, and 500s on a drifted row rather than answering
 * (ADR-0040).
 *
 * The daily is public content (ADR-0005): no auth, no cookies, no
 * credentialed CORS. Miss → 404 with an empty body: no on-demand
 * generation fallback, ever.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "termo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Parsed against the TERMO member, never the union: the member is
  // `z.strictObject({game, date})`, so the parse itself rejects the
  // answer word appearing in any field, not code review.
  return Response.json(dailyTermoResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
