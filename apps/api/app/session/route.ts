import { sessionResponseSchema, type SessionResponse } from "@miolos/core";
import type { NextRequest } from "next/server";

import { corsHeaders, preflightResponse } from "../../src/cors";
import { getDb } from "../../src/db";
import {
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from "../../src/session/cookie";
import {
  isCrossSiteWrite,
  warnIfGuardDegraded,
} from "../../src/session/origin-guard";
import { mintSession, resolveSession } from "../../src/session/service";
import {
  generateSessionToken,
  hashSessionToken,
} from "../../src/session/token";

// Never statically cached: every request must hit the session table.
export const dynamic = "force-dynamic";

export function OPTIONS(): Response {
  return preflightResponse();
}

/**
 * Mint-on-miss anonymous identity (see ADR-0022). No request body is
 * read — there is nothing to accept. That structural absence of any time
 * or identity input in the request path is the guarantee: timestamps
 * exist only as DB column defaults, never as request-derived values.
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
    // Fail closed: no Set-Cookie, no DB write.
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
  // Always re-set: the sliding 400-day window restarts on every visit.
  response.headers.append("Set-Cookie", buildSessionCookie(token));
  return response;
}
