import {
  apiErrorResponseSchema,
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
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

/** The per-route error envelope (the completions route's own convention). */
function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * POST /onboarding/seen (#35, ADR-0061): "Entendi", stamped server-side so
 * the introduction's one lifecycle per account survives cleared site data
 * AND attach/merge — the acceptance's own words (the attach-dismiss route's
 * template). The body is the STRICT empty object: the client posts a
 * literal `{}` and any key is a 400 (nothing smuggled through the
 * boundary). Idempotent: the UPDATE is guarded on
 * `onboarding_seen_at IS NULL`, so a re-post touches zero rows, never
 * re-bumps `updated_at` and never moves the recorded moment.
 *
 * The whole body is caught (the GET route's discipline, a step-6
 * correctness finding): a transient DB throw would otherwise be the one
 * branch without the CORS grant, and T-API-S122's "every branch of BOTH
 * routes" title would overclaim by exactly it. The three older write
 * routes (attach/dismiss, attach/confirm, completions) share the gap and
 * stay as-is — a template-wide observation, not this PR's scope.
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
