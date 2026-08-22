import { dailyBinairoResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached: a statically cached daily would serve
// yesterday's "today" (session-route precedent).
export const dynamic = "force-dynamic";

/**
 * GET /daily/binairo — today's daily through the wall. The daily is
 * public content (ADR-0005): no auth, no cookies, no credentialed CORS.
 *
 * Miss → 404 with an empty body: no on-demand generation fallback,
 * ever — that would bypass "pre-generated and validated" (ADR-0010) and
 * open a CPU DoS.
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "binairo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Defense in depth: the wall already returns a schema-shaped
  // projection, and the HTTP boundary re-parses it against the BINAIRO
  // member, never the union — a union parse would accept a mismatched
  // row on this path.
  return Response.json(dailyBinairoResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
