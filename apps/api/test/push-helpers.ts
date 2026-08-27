import { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "../src/session/cookie";

export function jsonHeaders(sessionToken?: string): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  if (sessionToken !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
  }
  return headers;
}

export function subscriptionsRequest(
  method: "POST" | "DELETE",
  init: { headers: Headers; body: string },
): NextRequest {
  return new NextRequest("http://localhost:3001/push/subscriptions", {
    method,
    ...init,
  });
}

export function dismissRequest(init: {
  headers: Headers;
  body: string;
}): NextRequest {
  return new NextRequest("http://localhost:3001/notifications/dismiss", {
    method: "POST",
    ...init,
  });
}
