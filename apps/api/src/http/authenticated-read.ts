// see ADR-0048 D3 (no-store, no OPTIONS) and ADR-0060 D1 (401 `no-session`,
// whole-body catch -> 500 `internal`, the credentialed CORS grant on every
// branch including the catch)
import { apiErrorResponseSchema } from "@miolos/core";
import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import { getDb } from "../db";
import { readResponse } from "./responses";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import { requireUserId } from "../session/service";

export async function authenticatedRead(
  request: NextRequest,
  // An authenticated read takes no parameter — see ADR-0051 D3 and ADR-0052
  // D5; for /day the wall is ADR-0004 via ADR-0060 D2. This signature does NOT
  // enforce it (the callback closes over `request`); T-API-S183 does.
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
