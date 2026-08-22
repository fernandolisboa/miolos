/**
 * Env-driven CORS seam — see ADR-0007, ADR-0013. An empty-valued
 * Access-Control-Allow-Origin header is invalid rather than absent, so it
 * is conditionally omitted, never emitted empty. With `credentials: true`
 * the grant also gains Allow-Credentials and Vary: Origin — never `*`,
 * which browsers reject outright on credentialed requests.
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
 * `application/json`, parameters allowed (`; charset=utf-8`). Belongs here
 * because the reason it exists is a CORS reason: requiring JSON is what
 * forces a preflight on every cross-origin attempt, making the `WEB_ORIGIN`
 * grant load-bearing rather than the origin guard alone.
 */
export function isJsonContentType(header: string | null): boolean {
  if (header === null) {
    return false;
  }
  return header.split(";")[0]?.trim().toLowerCase() === "application/json";
}

/**
 * Preflight answer for the credentialed endpoints. `methods` defaults to
 * POST-only; /push/subscriptions passes "POST, DELETE, OPTIONS" since a
 * grant listing only POST would fail the browser's method check for its
 * DELETE.
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
