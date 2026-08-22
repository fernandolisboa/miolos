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
 * GET /stats — the statistics aggregates (ADR-0051), a verbatim clone of
 * the GET /streak authenticated-READ template (ADR-0048). Everything
 * write-shaped is deliberately absent:
 *
 * - No OPTIONS handler and no `preflightResponse` change: a credentialed
 *   GET with no custom request headers is a CORS simple request — the
 *   browser never preflights it.
 * - No origin guard: it protects writes; a read mutates nothing, and its
 *   confidentiality is the CORS allowlist plus the cookie.
 * - No content-type check: there is no body.
 * - No request parameters at all: the user is the cookie, the day is the
 *   DB clock.
 *
 * The response recomputes from rows on every read — no stored aggregate
 * exists anywhere (ADR-0009, ADR-0049 decision 6). The strict schema is
 * closed to growth: medals arrive on their own endpoint and contract
 * (ADR-0048 decision 3), never here.
 */
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
  // branch keeps.
  try {
    const db = getDb();
    // `requireUserId` never mints: a GET from a cookieless client is 401,
    // and SessionBootstrap owns minting.
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    const [today, rows] = await Promise.all([
      // The DB clock's SP date — the `today` the pure function anchors
      // on. Never new Date().
      todaySaoPaulo(db),
      // Unfiltered rows: the pure functions are the statistics' only
      // filter, so this seam exercises the authority.
      listCompletionsForStats(db, userId),
    ]);

    return Response.json(
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
