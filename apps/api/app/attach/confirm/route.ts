import {
  apiErrorResponseSchema,
  attachConfirmResponseSchema,
  attachConfirmSchema,
} from "@miolos/core";
import { mergeAccounts } from "@miolos/db/user";
import type { Db } from "@miolos/db";
import type { NextRequest } from "next/server";

import {
  attachEmailToUser,
  claimAttachToken,
  findVerifiedHolder,
  getAttachAccountState,
  userOwnsSession,
} from "../../../src/attach/service";
import {
  corsHeaders,
  isJsonContentType,
  preflightResponse,
} from "../../../src/cors";
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

// Never statically cached: every request claims against the token table.
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

/** The D6-layer-3 violation, recognized down the drizzle cause chain. */
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

/**
 * Resolve the winner for a claimed token (ADR-0050 decisions 4 and 5).
 * The pair handed to `mergeAccounts` is always (token.user_id, verified-
 * holder-of-token.email) — the resolved session at request time and one DB
 * lookup — NEVER the clicking cookie and never a request-supplied id. On a
 * winner-liveness throw (a concurrent merge), the pair is re-derived once
 * and retried; a second failure is the conflict answer.
 */
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
  } catch {
    // The guard threw before any destructive statement. Re-derive both
    // sides fresh and retry exactly once (plan 031 D5): an astronomically
    // rare race costs one re-request, never a stranded history.
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
    } catch {
      return "conflict";
    }
  }
}

/**
 * POST /attach/confirm (#21, ADR-0050): the atomic claim, the merge on
 * collision, the consent-stamping UPDATE on the winner, and a fresh
 * session cookie for the clicking browser. Requires NO session cookie —
 * the recovery user's browser may have none — because the authorization
 * boundary is D4's verified-identity pair, not the caller's cookie. The
 * body carries exactly `{token}`.
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

  // The atomic claim IS the single-use semantics; unknown, expired and
  // spent tokens are indistinguishable — one generic answer, no oracle.
  const claimed = await claimAttachToken(
    db,
    await hashSessionToken(parsed.data.token),
  );
  if (!claimed) {
    return errorResponse(410, "invalid-or-expired");
  }

  // Requester liveness (D4): a requester tombstoned by a concurrent merge
  // between request and confirm gets no write — the token is spent and a
  // fresh request from the live account is the recovery.
  if (!(await userOwnsSession(db, claimed.userId))) {
    return errorResponse(410, "invalid-or-expired");
  }

  const resolved = await resolveWinner(db, claimed.userId, claimed.email);
  if (resolved === "gone") {
    return errorResponse(410, "invalid-or-expired");
  }
  if (resolved === "conflict") {
    // The token was atomically claimed and is spent; the user is told to
    // request a new link (T-API-S73).
    return errorResponse(409, "confirm-conflict");
  }

  // D16's confirm-side re-check, closing the pending-token side door: a
  // still-live token for E2 confirmed after E1 was attached must not
  // silently CHANGE the verified email. Token spent — a stale intent is
  // not resurrected.
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
      // The concurrent-confirm window where the holder lookup returned
      // null (ADR-0050 decision 6): another confirm verified this email
      // onto a different winner first. Same answer as the exhausted merge
      // retry — request a new link (T-API-S80).
      return errorResponse(409, "confirm-conflict");
    }
    throw error;
  }

  // The clicking browser is authenticated AS the winner — never merged
  // into it (D4): possession-of-inbox semantics, and a bystander's
  // anonymous account is untouched in the DB.
  const sessionToken = generateSessionToken();
  await createSessionForUser(
    db,
    await hashSessionToken(sessionToken),
    resolved.winnerId,
  );

  const response = Response.json(
    attachConfirmResponseSchema.parse({ merged: resolved.merged }),
    { headers: corsHeaders({ credentials: true }) },
  );
  response.headers.append("Set-Cookie", buildSessionCookie(sessionToken));
  return response;
}
