import {
  accountDeleteResponseSchema,
  accountDeleteSchema,
  apiErrorResponseSchema,
} from "@miolos/core";
import { eq, users } from "@miolos/db";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { getDb } from "../../../src/db";
import {
  buildSessionClearingCookie,
  SESSION_COOKIE_NAME,
} from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";

// Never statically cached: every request deletes against the users table.
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
 * POST /account/delete (#21, ADR-0050 decision 12): real, immediate,
 * self-service deletion — the LGPD path the /privacidade page hosts. One
 * cascade DELETE removes sessions, completions, hint_grants and
 * attach_tokens with the row; the cookie is cleared; the next visit mints
 * a FRESH, empty identity through the normal bootstrap.
 *
 * Structurally distinct from tombstones, and deliberately so: a tombstone
 * owns no session, so `requireUserId` can never resolve a cookie to one —
 * this route can never delete a tombstone, and deletion never conflicts
 * with ADR-0049's "retained forever". The literal `confirm: true` is a
 * second factor against drive-by fetches; the UI's two-step confirm
 * supplies it.
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
  if (!accountDeleteSchema.safeParse(raw).success) {
    return errorResponse(400, "invalid-body");
  }

  // The cascade is the whole footprint: sessions, completions,
  // hint_grants and attach_tokens all declare ON DELETE CASCADE.
  await db.delete(users).where(eq(users.id, userId));

  const response = Response.json(
    accountDeleteResponseSchema.parse({ deleted: true }),
    { headers: corsHeaders({ credentials: true }) },
  );
  response.headers.append("Set-Cookie", buildSessionClearingCookie());
  return response;
}
