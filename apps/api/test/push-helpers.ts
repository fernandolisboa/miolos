import { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "../src/session/cookie";

// Shared by notifications-state.test.ts, notifications-dismiss.test.ts and
// push-subscriptions-routes.test.ts (the onboarding-helpers.ts precedent:
// several new files, one PR, one shape). Not a suite-wide convention
// change: createSession() stays per-file, per the standing convention.

/** JSON headers for the push write routes, with an optional session cookie. */
export function jsonHeaders(sessionToken?: string): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (sessionToken !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }
  return headers;
}

/** A POST/DELETE /push/subscriptions request with the given headers and body. */
export function subscriptionsRequest(
  method: "POST" | "DELETE",
  init: { headers: Headers; body: string },
): NextRequest {
  return new NextRequest("http://localhost:3001/push/subscriptions", {
    method,
    ...init,
  });
}

/** A POST /notifications/dismiss request with the given headers and body. */
export function dismissRequest(init: {
  headers: Headers;
  body: string;
}): NextRequest {
  return new NextRequest("http://localhost:3001/notifications/dismiss", {
    method: "POST",
    ...init,
  });
}
