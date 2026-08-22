// see ADR-0048 D3
import { apiErrorResponseSchema } from "@miolos/core";
import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import { corsHeaders } from "../cors";
import { getDb } from "../db";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import { requireUserId } from "../session/service";

function readResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Cache-Control": "no-store",
    },
  });
}

export async function authenticatedRead(
  request: NextRequest,
  // see ADR-0004: an authenticated read takes no parameter
  read: (db: Db, userId: string) => Promise<unknown>,
): Promise<Response> {
  try {
    const db = getDb();
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return readResponse(
        apiErrorResponseSchema.parse({ error: "no-session" }),
        401,
      );
    }

    return readResponse(await read(db, userId));
  } catch {
    return readResponse(
      apiErrorResponseSchema.parse({ error: "internal" }),
      500,
    );
  }
}
