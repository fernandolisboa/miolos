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

let warnedMissingWebOrigin = false;

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
