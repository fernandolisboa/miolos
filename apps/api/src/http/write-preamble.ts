import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import { isJsonContentType } from "../cors";
import { getDb } from "../db";
import { errorResponse } from "./responses";
import { SESSION_COOKIE_NAME } from "../session/cookie";
import { isCrossSiteWrite, warnIfGuardDegraded } from "../session/origin-guard";
import { requireUserId } from "../session/service";

type BodySchema<T> = {
  safeParse(raw: unknown): { success: true; data: T } | { success: false };
};

export async function writePreamble<T>(
  request: NextRequest,
  schema: BodySchema<T>,
  unavailable: () => Response | undefined = () => undefined,
): Promise<
  | { failure: Response }
  | { failure?: undefined; db: Db; userId: string; body: T }
> {
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
    return { failure: errorResponse(403, "cross-site") };
  }

  const refusal = unavailable();
  if (refusal) {
    return { failure: refusal };
  }

  if (!isJsonContentType(request.headers.get("content-type"))) {
    return { failure: errorResponse(415, "unsupported-media-type") };
  }

  const db = getDb();
  const userId = await requireUserId(
    db,
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!userId) {
    return { failure: errorResponse(401, "no-session") };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { failure: errorResponse(400, "invalid-body") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { failure: errorResponse(400, "invalid-body") };
  }

  return { db, userId, body: parsed.data };
}
