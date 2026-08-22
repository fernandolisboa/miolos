import {
  apiErrorResponseSchema,
  attachRequestResponseSchema,
  attachRequestSchema,
} from "@miolos/core";
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
import { getDb } from "../../../src/db";
import {
  isAttachConfigured,
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

// Never statically cached: every request touches the token table.
export const dynamic = "force-dynamic";

/**
 * 3 per rolling hour per user AND per normalized email, counted from
 * attach_tokens rows (ADR-0050 decision 11). The per-email count closes
 * the mint-fresh-users mail-bombing shape for one inbox; fresh users ×
 * many addresses remains the accepted v1 risk.
 */
const MAX_REQUESTS_PER_HOUR = 3;

function errorResponse(status: number, error: string): Response {
  return Response.json(apiErrorResponseSchema.parse({ error }), {
    status,
    headers: corsHeaders({ credentials: true }),
  });
}

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * POST /attach/request; see ADR-0050 decision 1: an authenticated user
 * submits an email plus the two consents; a token is minted (hash-only)
 * and the magic link is emailed. NOTHING is written to `users` here — the
 * email and the reminder choice ride the token row until the click proves
 * possession of the inbox.
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
    // No DB touch at all: the guard runs before getDb().
    return errorResponse(403, "cross-site");
  }

  // Before the body is read: requiring JSON forces a CORS preflight on
  // every cross-origin attempt, so the WEB_ORIGIN grant becomes
  // load-bearing rather than the origin guard alone.
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

  // FAIL-CLOSED before any side effect (ADR-0050 decision 10):
  // `isAttachConfigured` requires BOTH the key (no send without it) and
  // WEB_ORIGIN (the link cannot be built) — the SAME switch
  // GET /attach/state reports ineligibility under, so a half-configured
  // environment never renders a form whose submit would land here. The
  // local read below is only the typed handle for the URL.
  const webOrigin = process.env.WEB_ORIGIN;
  if (!isAttachConfigured() || !webOrigin) {
    return errorResponse(503, "email-unconfigured");
  }

  // An already-attached account may RE-request its own address (a resend,
  // whose confirm is an idempotent re-stamp); a different address is email
  // CHANGE, a real feature with its own safeguards — 409, never a side
  // door. Non-null email implies verified (ADR-0050 decision 2).
  const account = await getAttachAccountState(db, userId);
  if (!account) {
    // The session resolved instants ago, so the row can only be gone via a
    // concurrent deletion; answer as the auth failure it now is.
    return errorResponse(401, "no-session");
  }
  if (account.email !== null && account.email !== body.email) {
    return errorResponse(409, "email-already-attached");
  }

  // The rate ledger (ADR-0050 decision 11): cleanup is aligned to the
  // ONE-HOUR rate window — deleting at the 30-minute expiry would empty
  // the band the count needs and silently double the limit. Global: any
  // request sweeps every stale row, whoever's.
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
    // The link lands on the WEB confirm page (ADR-0050 decision 3): email
    // scanners prefetch GETs, and a GET there consumes nothing — only the
    // page's explicit POST spends the token. The `/vincular` literal here
    // must match the slug `routeSlugs.attach` composes on the web side
    // (apps/web/src/i18n/routes.ts) — renaming either side alone breaks
    // every confirm link.
    await sendMagicLinkEmail({
      to: body.email,
      url: `${webOrigin}/vincular?token=${token}`,
    });
  } catch {
    // The minted row simply expires; a re-request supersedes it.
    return errorResponse(502, "email-send-failed");
  }

  return Response.json(attachRequestResponseSchema.parse({ sent: true }), {
    headers: corsHeaders({ credentials: true }),
  });
}
