import { attachRequestResponseSchema, attachRequestSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  cleanupStaleTokens,
  countRecentTokens,
  countRecentTokensForEmail,
  getAttachAccountState,
  mintAttachToken,
} from "../../../src/attach/service";
import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { getDb } from "../../../src/db";
import {
  isEmailConfigured,
  sendMagicLinkEmail,
} from "../../../src/email/transport";
import { SESSION_COOKIE_NAME } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { requireUserId } from "../../../src/session/service";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../../src/session/token";

export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_HOUR = 3;

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
  const parsed = attachRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }
  const body = parsed.data;

  const webOrigin = process.env.WEB_ORIGIN;
  if (!isEmailConfigured() || !webOrigin) {
    return errorResponse(503, "email-unconfigured");
  }

  const account = await getAttachAccountState(db, userId);
  if (!account) {
    return errorResponse(401, "no-session");
  }
  if (account.email !== null && account.email !== body.email) {
    return errorResponse(409, "email-already-attached");
  }

  await cleanupStaleTokens(db);
  const [userCount, emailCount] = await Promise.all([
    countRecentTokens(db, userId),
    countRecentTokensForEmail(db, body.email),
  ]);
  if (
    userCount >= MAX_REQUESTS_PER_HOUR ||
    emailCount >= MAX_REQUESTS_PER_HOUR
  ) {
    return errorResponse(429, "too-many-requests");
  }

  const token = generateSessionToken();
  await mintAttachToken(db, {
    userId,
    email: body.email,
    reminderConsent: body.reminderConsent,
    tokenHash: await hashSessionToken(token),
  });

  try {
    await sendMagicLinkEmail({
      to: body.email,
      url: `${webOrigin}/vincular?token=${token}`,
    });
  } catch {
    return errorResponse(502, "email-send-failed");
  }

  return Response.json(attachRequestResponseSchema.parse({ sent: true }), {
    headers: corsHeaders({ credentials: true }),
  });
}
