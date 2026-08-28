import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import { getDb } from "../db";
import { readErrorResponse, readResponse } from "./responses";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import { requireUserId } from "../session/service";

export async function authenticatedRead(
  request: NextRequest,

  read: (db: Db, userId: string) => Promise<unknown>,
): Promise<Response> {
  try {
    const db = getDb();
    const userId = await requireUserId(
      db,
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );
    if (!userId) {
      return readErrorResponse(401, "no-session");
    }

    return readResponse(await read(db, userId));
  } catch {
    return readErrorResponse(500, "internal");
  }
}
