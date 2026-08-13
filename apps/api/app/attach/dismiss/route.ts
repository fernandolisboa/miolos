import {
  apiErrorResponseSchema,
  attachDismissResponseSchema,
  attachDismissSchema,
} from "@miolos/core";
import type { NextRequest } from "next/server";

import { dismissAttachPrompt } from "../../../src/attach/service";
import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { getDb } from "../../../src/db";
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
 * POST /attach/dismiss (#21, ADR-0050 decision 9): "agora não", stamped
 * server-side so the prompt's one lifecycle per account survives cleared
 * site data — the exact user the feature serves. The body is the STRICT
 * empty object: the client posts a literal `{}` and any key is a 400
 * (nothing smuggled through the boundary). Idempotent: the UPDATE is
 * guarded on `attach_prompt_dismissed_at IS NULL`, so a re-post touches
 * zero rows and never re-bumps `updated_at`.
 */
export async function POST(request: NextRequest): Promise<Response> {
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
  if (!attachDismissSchema.safeParse(raw).success) {
    return errorResponse(400, "invalid-body");
  }

  await dismissAttachPrompt(db, userId);

  return Response.json(attachDismissResponseSchema.parse({ dismissed: true }), {
    headers: corsHeaders({ credentials: true }),
  });
}
