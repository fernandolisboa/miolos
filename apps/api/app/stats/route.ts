import {
  apiErrorResponseSchema,
  computeStats,
  statsResponseSchema,
} from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStats } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /stats — the #29 aggregates (plan 033 §5, ADR-0051), a verbatim
 * clone of the GET /streak authenticated-READ template (ADR-0048).
 * Everything write-shaped is deliberately absent, each absence a decision
 * (plan 027 D6, inherited whole):
 *
 * - No OPTIONS handler and no `preflightResponse` change: a credentialed
 *   GET with no custom request headers is a CORS simple request — the
 *   browser never preflights it.
 * - No origin guard: it protects writes; a read mutates nothing, and its
 *   confidentiality is the CORS allowlist plus the cookie.
 * - No content-type check: there is no body.
 * - No request parameters at all: the user is the cookie, the day is the
 *   DB clock. A `?date=` would be speculative surface (plan 033 D4).
 *
 * The response recomputes from rows on every read — no stored aggregate
 * exists anywhere (ADR-0009, ADR-0049 decision 6). The strict schema is
 * closed to growth: #30's medals arrive on their own endpoint and
 * contract (ADR-0048 decision 3), never here.
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
  // branch keeps (the T-API-S53 pin's reasoning; T-API-S86 pins it here).
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

    // Post-auth, the two reads are independent, so they share one round-trip
    // window. Auth stays FIRST and sequential: a 401 must cost zero queries.
    const [today, rows] = await Promise.all([
      // The DB clock's SP date (ADR-0010 single authority) — the `today`
      // the pure function anchors on. Never new Date().
      todaySaoPaulo(db),
      // Unfiltered rows: the pure functions are the statistics' only
      // filter (plan 033 D3), so this seam exercises the authority AC 1
      // names.
      listCompletionsForStats(db, userId),
    ]);

    return Response.json(
      // Parse, never cast (boundary rule) — the same strict schema the web
      // client parses on arrival.
      statsResponseSchema.parse({ date: today, ...computeStats(rows, today) }),
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
