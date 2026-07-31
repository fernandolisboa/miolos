export const SESSION_COOKIE_NAME = "miolos_session";

/** 400 days in seconds — the Chrome cap; the sliding re-set defeats it. */
const MAX_AGE_SECONDS = 34_560_000;

/**
 * Manual serialization per plan 009 D10 — no dependency, unit-testable.
 *
 * - `Domain` comes from COOKIE_DOMAIN alone (prod: miolos.app so web and
 *   api subdomains share the cookie; never hardcoded, ADR-0013). Unset →
 *   host-only cookie, shared across localhost:3000/3001 because cookies
 *   ignore ports.
 * - `Secure` is deliberately decoupled from Domain: emitted when
 *   COOKIE_DOMAIN is set OR NODE_ENV is production, so https *.vercel.app
 *   previews (production builds, COOKIE_DOMAIN unset) get a Secure cookie
 *   while local http `next dev` does not.
 * - `__Host-`/`__Secure-` prefixes are impossible here: the first forbids
 *   Domain, the second would break local http dev.
 */
export function buildSessionCookie(token: string): string {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  let cookie = `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax`;
  if (cookieDomain) {
    cookie += `; Domain=${cookieDomain}`;
  }
  if (cookieDomain || process.env.NODE_ENV === "production") {
    cookie += "; Secure";
  }
  return cookie;
}
