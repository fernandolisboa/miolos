import type { NextRequest } from "next/server";

import { getDb } from "../../../../src/db";
import { completeGoogleSignIn } from "../../../../src/google/callback";
import {
  buildFlowClearingCookie,
  FLOW_COOKIE_NAME,
  googleClient,
} from "../../../../src/google/oauth";
import { errorResponse } from "../../../../src/http/responses";
import {
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from "../../../../src/session/cookie";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const client = googleClient();
  const webOrigin = process.env.WEB_ORIGIN;
  if (!client || !webOrigin) {
    return errorResponse(503, "google-unconfigured");
  }

  const params = request.nextUrl.searchParams;
  const { outcome, sessionToken } = await completeGoogleSignIn(
    getDb(),
    client,
    {
      apiOrigin: request.nextUrl.origin,
      code: params.get("code"),
      state: params.get("state"),
      flowCookie: request.cookies.get(FLOW_COOKIE_NAME)?.value,
      sessionCookie: request.cookies.get(SESSION_COOKIE_NAME)?.value,
    },
  );
  const response = new Response(null, {
    status: 303,
    headers: { Location: `${webOrigin}/ajustes?google=${outcome}` },
  });
  response.headers.append("Set-Cookie", buildFlowClearingCookie());
  if (sessionToken !== undefined) {
    response.headers.append("Set-Cookie", buildSessionCookie(sessionToken));
  }
  return response;
}
