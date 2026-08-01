import { dailyPuzzleResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached: a statically cached daily would serve
// yesterday's "today" (session-route precedent).
export const dynamic = "force-dynamic";

/**
 * GET /daily/binairo — today's daily through the wall (issue #17 AC 5;
 * #18 builds the play UX on this route). The daily is public content
 * (ADR-0005): no auth, no cookies, no credentialed CORS.
 *
 * Miss → 404 with an empty body: no on-demand generation fallback, ever
 * (plan 014 D13) — it would bypass "pre-generated and validated"
 * (ADR-0010) and open a CPU DoS. The 404 client copy is #18's.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "binairo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Defense in depth: the wall already returns a schema-shaped
  // projection; the HTTP boundary independently re-parses it (two Zod
  // gates, one per enforcement point).
  return Response.json(dailyPuzzleResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
