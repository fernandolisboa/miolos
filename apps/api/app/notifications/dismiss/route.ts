import {
  apiErrorResponseSchema,
  notificationsDismissResponseSchema,
  notificationsDismissSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { getDb } from "../../../src/db";
import { dismissPushPrompt } from "../../../src/push/service";
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
 * POST /notifications/dismiss (#145, ADR-0064): "Agora não" — or a browser
 * denial — stamped server-side so the push pre-prompt's one lifecycle per
 * account survives cleared site data AND attach/merge (the
 * onboarding-seen route's template, which is the attach-dismiss template).
 * The body is the STRICT empty object: the client posts a literal `{}` and
 * any key is a 400 (nothing smuggled through the boundary). Idempotent:
 * the UPDATE is guarded on `push_prompt_dismissed_at IS NULL`, so a
 * re-post touches zero rows, never re-bumps `updated_at` and never moves
 * the recorded moment.
 *
 * Deliberately NOT gated on `isPushConfigured()`: a dismissal is the
 * player declining a prompt this environment rendered — refusing to record
 * it because an env var vanished between render and click would re-prompt
 * them forever. The dismissal has no push side effect to fail closed over.
 *
 * The whole body is caught (the onboarding-seen route's discipline): a
 * transient DB throw would otherwise be the one branch without the CORS
 * grant.
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
    if (!notificationsDismissSchema.safeParse(raw).success) {
      return errorResponse(400, "invalid-body");
    }

    await dismissPushPrompt(db, userId);

    return Response.json(
      notificationsDismissResponseSchema.parse({ dismissed: true }),
      { headers: corsHeaders({ credentials: true }) },
    );
  } catch {
    return errorResponse(500, "internal");
  }
}
