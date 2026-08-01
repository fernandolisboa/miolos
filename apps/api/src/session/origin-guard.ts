/**
 * Cross-site write guard (plan 009 D13, ADR-0022). Closes the Lax
 * cookie-overwrite identity wipe: a cross-site top-level form POST arrives
 * cookieless under SameSite=Lax, would mint a fresh user, and its
 * first-party Set-Cookie would overwrite the victim's identity — ADR-0003's
 * named worst failure, inflictable by a link click.
 *
 * Generalized from "mint" to every state-changing write (plan 017 D25):
 * POST /completions runs the same check, and a forged completion is
 * strictly worse than a forged mint because the row is never reopened
 * (ADR-0026).
 *
 * Deny on POSITIVE evidence only, never require proof: requests lacking
 * both headers (curl, seam-4 tests, old clients) and every non-cross-site
 * Sec-Fetch-Site value are allowed. Every browser modern enough to matter
 * sends Sec-Fetch-Site, and sends Origin on cross-origin POSTs — either
 * alone catches the attack.
 */
export function isCrossSiteWrite(
  headers: { secFetchSite: string | null; origin: string | null },
  webOrigin: string | undefined,
): boolean {
  if (headers.secFetchSite === "cross-site") {
    return true;
  }
  return (
    headers.origin !== null &&
    webOrigin !== undefined &&
    headers.origin !== webOrigin
  );
}

// Once-per-instance loud misconfiguration signal: without WEB_ORIGIN the
// origin guard fails open to Sec-Fetch-Site-only (which pre-16.4 Safari
// never sends) — see ADR-0022. Not a throw: previews legitimately run
// without a WEB_ORIGIN grant. The message carries no request data.
let warnedMissingWebOrigin = false;

/**
 * Called first by EVERY route that depends on the guard (plan 017 D25) —
 * it lives here rather than in one route precisely because a degraded
 * guard on /completions means a forged, unreopenable write.
 */
export function warnIfGuardDegraded(): void {
  if (
    !warnedMissingWebOrigin &&
    process.env.NODE_ENV === "production" &&
    !process.env.WEB_ORIGIN
  ) {
    warnedMissingWebOrigin = true;
    console.error(
      "WEB_ORIGIN is unset in production: the cross-site write guard is degraded to Sec-Fetch-Site-only (ADR-0022)",
    );
  }
}
