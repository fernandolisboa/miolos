import { sessionResponseSchema, type SessionResponse } from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../src/cors";
import { getDb } from "../../src/db";
import {
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from "../../src/session/cookie";
import { isCrossSiteMint } from "../../src/session/origin-guard";
import { mintSession, resolveSession } from "../../src/session/service";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../src/session/token";

// Never statically cached: every request must hit the session table.
export const dynamic = "force-dynamic";

// Once-per-instance loud misconfiguration signal: without WEB_ORIGIN the
// origin guard fails open to Sec-Fetch-Site-only (which pre-16.4 Safari
// never sends) — see ADR-0022. Not a throw: previews legitimately run
// without a WEB_ORIGIN grant. The message carries no request data.
let warnedMissingWebOrigin = false;
function warnIfGuardDegraded(): void {
  if (
    !warnedMissingWebOrigin &&
    process.env.NODE_ENV === "production" &&
    !process.env.WEB_ORIGIN
  ) {
    warnedMissingWebOrigin = true;
    console.error(
      "WEB_ORIGIN is unset in production: the cross-site mint guard is degraded to Sec-Fetch-Site-only (ADR-0022)",
    );
  }
}

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * Mint-on-miss anonymous identity (issue #15, ADR-0022). No request body is
 * read — there is nothing to accept. That structural absence of any time or
 * identity input in the request path IS the AC-5 guarantee: timestamps
 * exist only as DB column defaults, never as request-derived values.
 */
export async function POST(request: NextRequest): Promise<Response> {
  warnIfGuardDegraded();
  if (
    isCrossSiteMint(
      {
        secFetchSite: request.headers.get("sec-fetch-site"),
        origin: request.headers.get("origin"),
      },
      process.env.WEB_ORIGIN,
    )
  ) {
    // D13: no Set-Cookie, no DB write.
    return new Response(null, { status: 403 });
  }
  const db = getDb();
  const existingToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (existingToken) {
    const resolved = await resolveSession(
      db,
      await hashSessionToken(existingToken),
    );
    if (resolved) {
      return sessionResponse(resolved, existingToken);
    }
    // Unknown or forged token: fall through to a fresh mint.
  }
  const token = generateSessionToken();
  const minted = await mintSession(db, await hashSessionToken(token));
  return sessionResponse(minted, token);
}

function sessionResponse(body: SessionResponse, token: string): Response {
  const response = Response.json(sessionResponseSchema.parse(body), {
    headers: corsHeaders({ credentials: true }),
  });
  // Always re-set: the sliding 400-day window (D6) restarts on every visit.
  response.headers.append("Set-Cookie", buildSessionCookie(token));
  return response;
}
