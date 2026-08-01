/**
 * Cross-site mint guard (plan 009 D13, ADR-0022). Closes the Lax
 * cookie-overwrite identity wipe: a cross-site top-level form POST arrives
 * cookieless under SameSite=Lax, would mint a fresh user, and its
 * first-party Set-Cookie would overwrite the victim's identity — ADR-0003's
 * named worst failure, inflictable by a link click.
 *
 * Deny on POSITIVE evidence only, never require proof: requests lacking
 * both headers (curl, seam-4 tests, old clients) and every non-cross-site
 * Sec-Fetch-Site value are allowed. Every browser modern enough to matter
 * sends Sec-Fetch-Site, and sends Origin on cross-origin POSTs — either
 * alone catches the attack.
 */
export function isCrossSiteMint(
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
