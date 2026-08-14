import {
  earnedMedals,
  apiErrorResponseSchema,
  medalsResponseSchema,
} from "@miolos/core";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { listCompletionsForStats, listMedalGrants } from "@miolos/db/user";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../src/cors";
import { getDb } from "../../src/db";
import { SESSION_COOKIE_NAME } from "../../src/session/cookie";
import { requireUserId } from "../../src/session/service";

// Never statically cached: every request reads the caller's rows.
export const dynamic = "force-dynamic";

/**
 * GET /medals — an authenticated READ (#30, ADR-0052; ADR-0051
 * decision 3's "own endpoint and contract"), the `GET /streak` template
 * verbatim. Everything write-shaped is deliberately absent, each absence
 * a decision (plan 027 D6, restated):
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
 * The answer is the earned id SET only — no names, no descriptions, no
 * earnedDate (the client owns the copy; the honest earning day is
 * structurally unavailable for a late-counted feat, ADR-0052). Grants
 * whose id is unknown to the catalog or names a rule-derived definition
 * are ignored inside `earnedMedals`, never an error.
 *
 * `Cache-Control: no-store` on every branch: per-user data must never
 * sit in a shared cache.
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
  // grant (the streak route's own reasoning; T-API-S94 pins it).
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

    // Post-auth, the three reads are independent, so they share one
    // round-trip window. Auth stays FIRST and sequential: a 401 must cost
    // zero queries.
    const [today, rows, grants] = await Promise.all([
      // The DB clock's SP day the derivation anchors on — never
      // new Date(). A consumed input, not surface: every rule ignores
      // rows dated after it (ADR-0052).
      todaySaoPaulo(db),
      // Unfiltered rows: the pure function is the medals' only filter
      // (ADR-0049 decision 6 — the SAME reader the statistics recompute
      // over; no second reader exists).
      listCompletionsForStats(db, userId),
      // The curated-grant ids (ADR-0052) — rule-derived medals are never
      // read from storage.
      listMedalGrants(db, userId),
    ]);

    return Response.json(
      // Parse, never cast (boundary rule) — the same strict schema the web
      // client parses on arrival.
      medalsResponseSchema.parse({ medals: earnedMedals(rows, grants, today) }),
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
