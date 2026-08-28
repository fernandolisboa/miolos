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

export const dynamic = "force-dynamic";

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
  }
  const token = generateSessionToken();
  const minted = await mintSession(db, await hashSessionToken(token));
  return sessionResponse(minted, token);
}

function sessionResponse(body: SessionResponse, token: string): Response {
  const response = Response.json(sessionResponseSchema.parse(body), {
    headers: corsHeaders({ credentials: true }),
  });

  response.headers.append("Set-Cookie", buildSessionCookie(token));
  return response;
}
