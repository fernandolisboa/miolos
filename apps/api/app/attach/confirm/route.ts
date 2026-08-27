import { attachConfirmResponseSchema, attachConfirmSchema } from "@miolos/core";
import { isWinnerLivenessError, mergeAccounts } from "@miolos/db/user";
import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import {
  attachEmailToUser,
  claimAttachToken,
  findVerifiedHolder,
  getAttachAccountState,
  revokeSessionsForUser,
  userOwnsSession,
} from "../../../src/attach/service";
import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
import { errorResponse } from "../../../src/http/responses";
import { getDb } from "../../../src/db";
import { buildSessionCookie } from "../../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../../src/session/origin-guard";
import { createSessionForUser } from "../../../src/session/service";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../../src/session/token";
import { captureEvent, runAfterResponse } from "../../../src/telemetry/capture";

export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

function isVerifiedEmailUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("users_verified_email_uq")) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

async function resolveWinner(
  db: Db,
  requesterId: string,
  email: string,
): Promise<{ winnerId: string; merged: boolean } | "gone" | "conflict"> {
  const holder = await findVerifiedHolder(db, email);
  if (holder === undefined || holder === requesterId) {
    return { winnerId: requesterId, merged: false };
  }
  try {
    const { winnerId } = await mergeAccounts(db, requesterId, holder);
    return { winnerId, merged: true };
  } catch (error) {
    if (!isWinnerLivenessError(error)) {
      console.error(
        "attach confirm: mergeAccounts failed mid-operation",
        error,
      );
      throw error;
    }

    if (!(await userOwnsSession(db, requesterId))) {
      return "gone";
    }
    const freshHolder = await findVerifiedHolder(db, email);
    if (freshHolder === undefined || freshHolder === requesterId) {
      return { winnerId: requesterId, merged: false };
    }
    try {
      const { winnerId } = await mergeAccounts(db, requesterId, freshHolder);
      return { winnerId, merged: true };
    } catch (retryError) {
      if (!isWinnerLivenessError(retryError)) {
        console.error(
          "attach confirm: mergeAccounts retry failed mid-operation",
          retryError,
        );
        throw retryError;
      }
      return "conflict";
    }
  }
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

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid-body");
  }
  const parsed = attachConfirmSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "invalid-body");
  }

  const claimed = await claimAttachToken(
    db,
    await hashSessionToken(parsed.data.token),
  );
  if (!claimed) {
    return errorResponse(410, "invalid-or-expired");
  }

  if (!(await userOwnsSession(db, claimed.userId))) {
    return errorResponse(410, "invalid-or-expired");
  }

  const requesterAccount = await getAttachAccountState(db, claimed.userId);
  if (
    requesterAccount &&
    requesterAccount.email !== null &&
    requesterAccount.email !== claimed.email
  ) {
    return errorResponse(409, "email-already-attached");
  }

  const resolved = await resolveWinner(db, claimed.userId, claimed.email);
  if (resolved === "gone") {
    return errorResponse(410, "invalid-or-expired");
  }
  if (resolved === "conflict") {
    return errorResponse(409, "confirm-conflict");
  }

  if (resolved.merged) {
    await revokeSessionsForUser(db, resolved.winnerId);
  }

  // Unreachable by construction, and kept: the concurrent-window backstop —
  // see ADR-0050 decision 6. Deleting it as dead code leaves that window to
  // the unique index, which answers `confirm-conflict`, a different error.
  const winnerAccount = await getAttachAccountState(db, resolved.winnerId);
  if (
    winnerAccount &&
    winnerAccount.email !== null &&
    winnerAccount.email !== claimed.email
  ) {
    return errorResponse(409, "email-already-attached");
  }

  try {
    await attachEmailToUser(db, {
      userId: resolved.winnerId,
      email: claimed.email,
      reminderConsent: claimed.reminderConsent,
    });
  } catch (error) {
    if (isVerifiedEmailUniqueViolation(error)) {
      return errorResponse(409, "confirm-conflict");
    }
    throw error;
  }

  const sessionToken = generateSessionToken();
  await createSessionForUser(
    db,
    await hashSessionToken(sessionToken),
    resolved.winnerId,
  );

  const winnerId = resolved.winnerId;
  const merged = resolved.merged;
  runAfterResponse(() =>
    captureEvent({
      distinctId: winnerId,
      event: "login_linked",
      properties: { merged },
    }),
  );

  const response = Response.json(
    attachConfirmResponseSchema.parse({ merged: resolved.merged }),
    { headers: corsHeaders({ credentials: true }) },
  );
  response.headers.append("Set-Cookie", buildSessionCookie(sessionToken));
  return response;
}
