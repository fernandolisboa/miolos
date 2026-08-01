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
 * Preflight answer for the credentialed endpoints. The session bootstrap
 * deliberately sends no body, so the hot path never preflights — OPTIONS
 * exists for robustness, not for the happy path.
 */
export function preflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders({ credentials: true }),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
