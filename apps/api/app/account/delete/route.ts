import { accountDeleteResponseSchema, accountDeleteSchema } from "@miolos/core";
import { eq, users } from "@miolos/db";
import type { NextRequest } from "next/server";

import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
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

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * Real, immediate, self-service deletion — see ADR-0050 decision 12. One
 * cascade DELETE removes every row the users table owns; the cookie is
 * cleared and the next visit mints a fresh, empty identity.
 *
 * A merge tombstone owns no session, so `requireUserId` can never resolve
 * a cookie to one — this route can never reach a tombstone, so deletion
 * never conflicts with ADR-0049's "retained forever". The literal
 * `confirm: true` is a second factor against drive-by fetches; the UI's
 * two-step confirm supplies it.
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

  await db.delete(users).where(eq(users.id, userId));

  const response = Response.json(
    accountDeleteResponseSchema.parse({ deleted: true }),
    { headers: corsHeaders({ credentials: true }) },
  );
  response.headers.append("Set-Cookie", buildSessionClearingCookie());
  return response;
}
