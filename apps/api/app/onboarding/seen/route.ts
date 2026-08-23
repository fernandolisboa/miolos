import {
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { getDb } from "../../../src/db";
import { markOnboardingSeen } from "../../../src/onboarding/service";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request stamps against the users table.
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * "Entendi" — stamped server-side so the introduction's one lifecycle per
 * account survives cleared site data and account merge (see ADR-0061;
 * the attach-dismiss route's template). The body must be a literal `{}`;
 * any key is a 400. Idempotent: the UPDATE is guarded on
 * `onboarding_seen_at IS NULL`, so a re-post touches zero rows.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    warnIfGuardDegraded();

    if (
      isCrossSiteWrite(
        {
          secFetchSite: request.headers.get("sec-fetch-site"),
          origin: request.headers.get("origin"),
        },
        process.env.WEB_ORIGIN,
      )
    ) {
      return errorResponse(403, "cross-site");
    }

    if (!isJsonContentType(request.headers.get("content-type"))) {
      return errorResponse(415, "unsupported-media-type");
    }

    const db = getDb();
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return errorResponse(401, "no-session");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(400, "invalid-body");
    }
    if (!onboardingSeenSchema.safeParse(raw).success) {
      return errorResponse(400, "invalid-body");
    }

    await markOnboardingSeen(db, userId);

    return Response.json(onboardingSeenResponseSchema.parse({ seen: true }), {
      headers: corsHeaders({ credentials: true }),
    });
  } catch {
    return errorResponse(500, "internal");
  }
}
