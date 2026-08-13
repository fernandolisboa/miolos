import {
  apiErrorResponseSchema,
  computeStreak,
  streakResponseSchema,
} from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStreak } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /streak — the repo's first authenticated READ (ADR-0048, plan 027
 * §7). Everything write-shaped from POST /completions is deliberately
 * absent, each absence a decision (plan 027 D6):
 *
 * - No OPTIONS handler and no `preflightResponse` change: a credentialed
 *   GET with no custom request headers is a CORS simple request — the
 *   browser never preflights it (the same Fetch-spec reasoning
 *   `session/bootstrap.ts` records for the body-less POST). Widening the
 *   shared preflight's "POST, OPTIONS" for a preflight that never occurs
 *   would be change without a caller.
 * - No origin guard: it protects writes; a read mutates nothing, and its
 *   confidentiality is the CORS allowlist plus the cookie.
 * - No content-type check: there is no body.
 * - No request parameters at all: the user is the cookie, the day is the
 *   DB clock. A `?date=` would be an archive/statistics feature (#29/#31).
 *
 * `Cache-Control: no-store` is new and load-bearing: this is the first
 * response where a shared cache could serve one user's data to another;
 * POSTs were never cacheable, so the discipline starts here.
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

  // The DB clock's SP date (ADR-0010 single authority) — the `today` the
  // pure function anchors on. Never new Date().
  const today = await todaySaoPaulo(db);
  // Unfiltered rows: the pure function is the streak's only filter (plan
  // 027 D3), so this seam exercises the authority ADR-0009 names.
  const rows = await listCompletionsForStreak(db, userId);
  const status = computeStreak(rows, today);

  return Response.json(
    // Parse, never cast (boundary rule) — the same strict schema the web
    // client parses on arrival.
    streakResponseSchema.parse({ date: today, ...status }),
    {
      headers: {
        ...corsHeaders({ credentials: true }),
        "Cache-Control": "no-store",
      },
    },
  );
}
