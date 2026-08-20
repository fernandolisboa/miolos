/**
 * Minimal, env-driven CORS seam (ADR-0007 "real configuration"). The web
 * origin is configuration, never a hardcoded apex (ADR-0013). An
 * empty-valued Access-Control-Allow-Origin header is invalid rather than
 * absent, so the header is conditionally omitted, never emitted empty.
 *
 * With `credentials: true` (issue #15's /session), the exact-origin grant
 * gains Allow-Credentials and Vary: Origin. `*` is unrepresentable here —
 * the origin comes from env verbatim — which matters because browsers
 * reject the wildcard outright on credentialed requests.
 */
export function corsHeaders(options?: { credentials?: boolean }): HeadersInit {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    return {};
  }
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": webOrigin,
  };
  if (options?.credentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
  }
  return headers;
}

/**
 * `application/json`, parameters allowed (`; charset=utf-8`).
 *
 * ONE COPY, SHARED BY BOTH WRITE ROUTES (#27 step-7 finding A-6). It is a
 * pure predicate with no route-specific meaning, and it belongs here because
 * the reason it exists is a CORS reason: requiring a JSON content type is
 * what forces a preflight on every cross-origin attempt, so the `WEB_ORIGIN`
 * grant above becomes load-bearing rather than the origin guard alone. The
 * guess route duplicated it claiming that "a new `apps/api/src` surface"
 * would cost more — but this module already existed, so the duplicate cost
 * more than the hoist did. `errorResponse` is different and deliberately
 * stays per-route: an error envelope should be visible in the route emitting
 * it.
 */
export function isJsonContentType(header: string | null): boolean {
  if (header === null) {
    return false;
  }
  return header.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/**
 * Preflight answer for the credentialed endpoints. The session bootstrap
 * deliberately sends no body, so the hot path never preflights — OPTIONS
 * exists for robustness, not for the happy path.
 *
 * `methods` (#145): /push/subscriptions is the first route with a
 * cross-origin DELETE, and its JSON content type forces a preflight on
 * every call — a grant listing only POST would fail the browser's method
 * check before the route ever ran. Every POST-only caller keeps the
 * default.
 */
export function preflightResponse(methods = "POST, OPTIONS"): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
