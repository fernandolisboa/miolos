import type { NextRequest } from "next/server";

import {
  buildAuthorizeUrl,
  buildFlowCookie,
  callbackUrl,
  googleClient,
  startFlow,
} from "../../../../src/google/oauth";
import { errorResponse } from "../../../../src/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const client = googleClient();
  if (!client) {
    return errorResponse(503, "google-unconfigured");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse(403, "cross-site");
  }

  const flow = startFlow();
  const response = new Response(null, {
    status: 302,
    headers: {
      Location: await buildAuthorizeUrl(
        client,
        callbackUrl(request.nextUrl.origin),
        flow,
      ),
    },
  });
  response.headers.append("Set-Cookie", buildFlowCookie(flow));
  return response;
}
