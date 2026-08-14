/**
 * The site's own origin, and the ONE spelling of it in `apps/web` (#31,
 * ADR-0013 `:36` — nothing hardcodes the apex outside environment config).
 *
 * Three surfaces need it and none of them may disagree: the root layout's
 * `metadataBase`, against which every `alternates.canonical` in the app is
 * resolved; `sitemap.ts`, whose entries Next requires as ABSOLUTE URLs and
 * does not resolve against `metadataBase`; and `robots.ts`, which points a
 * crawler at that sitemap. A canonical and a sitemap URL that resolve to
 * different origins is the failure this hoist exists to prevent, and before
 * #31 there was one consumer, so one literal was not yet a duplicate.
 *
 * The localhost fallback is the shipped one, moved rather than invented: it
 * is what `app/layout.tsx` carried before this module existed.
 */
const FALLBACK_ORIGIN = "http://localhost:3000";

export function siteOrigin(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_ORIGIN);
}

/** An absolute URL for an app-relative path, against `siteOrigin()`. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteOrigin()).toString();
}
