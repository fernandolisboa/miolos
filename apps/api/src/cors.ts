/**
 * Minimal, env-driven CORS seam (ADR-0007 "real configuration"). The web
 * origin is configuration, never a hardcoded apex (ADR-0013). An
 * empty-valued Access-Control-Allow-Origin header is invalid rather than
 * absent, so the header is conditionally omitted, never emitted empty.
 * No credentials and no preflight handling in M0; issue #15 extends here.
 */
export function corsHeaders(): HeadersInit {
  const webOrigin = process.env.WEB_ORIGIN;
  return webOrigin ? { "Access-Control-Allow-Origin": webOrigin } : {};
}
