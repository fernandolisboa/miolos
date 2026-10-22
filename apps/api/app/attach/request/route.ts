import { attachRequestResponseSchema, attachRequestSchema } from "@miolos/core";
import type { NextRequest } from "next/server";

import {
  cleanupStaleTokens,
  countRecentTokens,
  countRecentTokensForEmail,
  getAttachAccountState,
  mintAttachToken,
} from "../../../src/attach/service";
import { corsHeaders, preflightResponse } from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { writePreamble } from "../../../src/http/write-preamble";
import {
  isEmailConfigured,
  sendMagicLinkEmail,
} from "../../../src/email/transport";
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
  const context = await writePreamble(request, attachRequestSchema);
  if (context.failure) {
    return context.failure;
  }
  const { db, userId, body } = context;

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
