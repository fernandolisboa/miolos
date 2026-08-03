import { dailyTermoResponseSchema } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";

// Never statically cached: a statically cached daily would serve
// yesterday's "today" (session-route precedent).
export const dynamic = "force-dynamic";

/**
 * GET /daily/termo — today's daily through the wall (issue #27). The FOURTH
 * literal route, and the last one M2 owes. A `[game]` dynamic segment would
 * still put an untrusted `params.game` in front of the wall; that half of
 * the argument `daily/sudoku/route.ts` made is unchanged and is now the
 * whole of it, because every game projects and no path can reach an
 * unimplemented projection any more (plan 018 S14, plan 020 P8, plan 022
 * §10.4).
 *
 * The body is TWO KEYS, and that is the entire response: a Termo board
 * starts empty and every guess is judged server-side (ADR-0038), so there is
 * nothing to ship. The 200 therefore means "today is playable" and nothing
 * else — which is why the wall parses the stored content strictly before
 * projecting it, and 500s on a drifted row rather than answering (ADR-0040,
 * plan 022 §8.3).
 *
 * The daily is public content (ADR-0005): no auth, no cookies, no
 * credentialed CORS. Miss → 404 with an empty body: no on-demand
 * generation fallback, ever (plan 014 D13).
 */
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "termo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  // Defense in depth: the wall already returns a schema-shaped projection;
  // the HTTP boundary independently re-parses it (two Zod gates, one per
  // enforcement point). Parsed against the TERMO MEMBER, never the union —
  // and here the member is `z.strictObject({game, date})`, so the parse is
  // also what makes "the answer word, in any field" a failure rather than a
  // rule kept by review.
  return Response.json(dailyTermoResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
