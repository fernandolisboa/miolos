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
 * GET /onboarding/state — the authenticated-READ template (ADR-0048),
 * cloned from GET /attach/state (see ADR-0061). Serves one derived
 * boolean; the timestamp itself never ships (ADR-0048 decision 3).
 *
 * An unknown user id resolves `show: false` — fail closed: an identity we
 * cannot read is never nagged. `requireUserId` never mints: on a
 * genuinely first visit the card waits for the layout's own mint (the web
 * hook awaits `ensureSession()` before calling here).
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

function stateResponse(show: boolean): Response {
  return Response.json(onboardingStateResponseSchema.parse({ show }), {
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const db = getDb();
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
