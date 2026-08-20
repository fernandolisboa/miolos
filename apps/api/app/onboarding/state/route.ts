import {
  apiErrorResponseSchema,
  onboardingStateResponseSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../../../src/cors";
import { getDb } from "../../../src/db";
import { getOnboardingState } from "../../../src/onboarding/service";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request reads the caller's row.
export const dynamic = "force-dynamic";

/**
 * GET /onboarding/state (#35, ADR-0061) — the authenticated-READ template
 * (the attach-state route's own conventions: no OPTIONS — a credentialed
 * GET with no custom header never preflights — no origin guard, no-store on
 * every branch, whole body caught). Serves ONE derived boolean: the
 * timestamp never ships (ADR-0048 decision 3), and "once only" is fully
 * server-owned —
 *
 *   show = the row exists AND onboarding_seen_at IS NULL
 *
 * An unknown user id resolves `show: false` — fail closed: an identity we
 * cannot read is never nagged. `requireUserId` never mints: on a genuinely
 * first visit the card waits for the layout's own mint (the web hook
 * awaits `ensureSession()` before calling here, plan 057 D10).
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

function stateResponse(show: boolean): Response {
  return Response.json(onboardingStateResponseSchema.parse({ show }), {
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  // The whole body is caught (the streak route's discipline): an unhandled
  // throw would be the one branch without no-store and the CORS grant.
  try {
    const db = getDb();
    // `requireUserId` never mints; auth stays first and a 401 costs zero
    // further queries.
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    const account = await getOnboardingState(db, userId);
    return stateResponse(
      account !== undefined && account.onboardingSeenAt === null,
    );
  } catch {
    return errorResponse(500, "internal");
  }
}
