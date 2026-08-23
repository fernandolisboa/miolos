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

// Never statically cached: every request claims against the token table.
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

/** The `users_verified_email_uq` violation (ADR-0050 decision 6, layer 3), recognized down the drizzle cause chain. */
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
  } catch (error) {
    // Only the winner-liveness guard's throw is retryable — it fires
    // before any destructive statement. Anything else may have landed
    // mid-operation and must surface as the route's 500, never a spent-
    // token 410/409. The retry's accepted residual and the repair seam
    // (`listCompletionsForMerge`) are recorded in ADR-0050 decision 5.
    if (!isWinnerLivenessError(error)) {
      console.error(
        "attach confirm: mergeAccounts failed mid-operation",
        error,
      );
      throw error;
    }
    // The guard threw before any destructive statement. Re-derive both
    // sides fresh and retry exactly once (ADR-0050 decision 5): an
    // astronomically rare race costs one re-request, never a stranded
    // history.
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

/**
 * POST /attach/confirm — see ADR-0050: the atomic claim, the merge on
 * collision, the consent-stamping UPDATE on the winner, and a fresh
 * session cookie for the clicking browser. Requires NO session cookie —
 * the recovery user's browser may have none — because the authorization
 * boundary is ADR-0050 decision 4's verified-identity pair, not the
 * caller's cookie. The body carries exactly `{token}`.
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

  // Requester liveness (ADR-0050 decision 4): a requester tombstoned by a
  // concurrent merge between request and confirm gets no write — the token
  // is spent and a fresh request from the live account is the recovery.
  if (!(await userOwnsSession(db, claimed.userId))) {
    return errorResponse(410, "invalid-or-expired");
  }

  // SECURITY: the stale-intent guard, BEFORE any merge. A requester who
  // attached E1 while its E2 token was still live must not have that token
  // trigger a DESTRUCTIVE merge with E2's verified holder — the intent the
  // token recorded is dead the moment the requester's verified email
  // differs from it. 409, token spent, ZERO merge. Recovery requesters have
  // a null email and resends match, so neither is touched; the post-merge
  // winner re-check below stays as the concurrent-window backstop.
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
    // The token was atomically claimed and is spent; the user is told to
    // request a new link.
    return errorResponse(409, "confirm-conflict");
  }

  if (resolved.merged) {
    // SECURITY (ADR-0050 decision 13): after a CROSS-ACCOUNT merge, no
    // pre-existing session may survive onto the winner — an ATTACKER may
    // have requested this token for the victim's verified email, and the
    // merge's statement 1 just remapped the attacker's cookie onto the
    // victim's account. One delete on the winner retires both accounts'
    // old sessions (the loser's were remapped there); the clicking
    // browser's fresh session is minted below and becomes the only live
    // one. The plain-attach path keeps its sessions: no second account is
    // involved.
    await revokeSessionsForUser(db, resolved.winnerId);
  }

  // SECURITY: the confirm-side re-check on the resolved WINNER — the
  // concurrent-window backstop to the pre-merge guard above. A racing
  // confirm may have attached a different email to the winner between the
  // guard and here, and the verified email must never silently CHANGE.
  // Token spent — a stale intent is not resurrected.
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
      // retry — request a new link.
      return errorResponse(409, "confirm-conflict");
    }
    throw error;
  }

  // The clicking browser is authenticated AS the winner — never merged
  // into it (ADR-0050 decision 4): possession-of-inbox semantics, and a
  // bystander's anonymous account is untouched in the DB.
  const sessionToken = generateSessionToken();
  await createSessionForUser(
    db,
    await hashSessionToken(sessionToken),
    resolved.winnerId,
  );

  // Telemetry (see ADR-0069): `login_linked` on success, keyed by
  // `resolved.winnerId` — this route deliberately requires no session, so
  // `requireUserId` is not in scope and the winner is the one honest
  // identity here. Never the email. Post-response and throw-proof via
  // `runAfterResponse`.
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
