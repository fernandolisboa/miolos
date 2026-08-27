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

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

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
