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
 * "Agora não" — a permanent decline, stamped server-side so it survives
 * cleared site data (see ADR-0050 decision 9). The body must be a literal
 * `{}`; any key is a 400. Idempotent: the UPDATE is guarded on
 * `attach_prompt_dismissed_at IS NULL`, so a re-post touches zero rows.
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
