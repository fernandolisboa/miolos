import { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "../src/session/cookie";

// Shared by onboarding-seen.test.ts and onboarding-state.test.ts (step-6
// quality finding: two new files, one PR, one shape — the cheapest moment
// to share the helper is before the merge). Not a suite-wide convention
// change: createSession() stays per-file, per the standing convention.

/** JSON headers for POST /onboarding/seen, with an optional session cookie. */
export function jsonHeaders(sessionToken?: string): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (sessionToken !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }
  return headers;
}

/** A POST /onboarding/seen request with the given headers and body. */
export function seenRequest(init: {
  headers: Headers;
  body: string;
}): NextRequest {
  return new NextRequest("http://localhost:3001/onboarding/seen", {
    method: "POST",
    ...init,
  });
}
