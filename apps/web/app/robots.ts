import type { MetadataRoute } from "next";

import { routes } from "../src/i18n";
import { absoluteUrl } from "../src/site-origin";

// Request-time, for the same reason the sitemap it points at is (ADR-0053
// decision 2).
export const dynamic = "force-dynamic";

/**
 * The repo's FIRST site-wide crawl posture (#31, ADR-0053) — and it sets one
 * rule for everything: crawlable except the magic-link landing page, which
 * already carries `robots: noindex` of its own.
 *
 * **Absence from a sitemap is not `noindex`, and this file is where that is
 * said rather than implied.** `/estatisticas` and the four daily play routes
 * are therefore crawlable but unlisted — they are simply not an SEO surface
 * worth a sitemap slot, not secrets. That is safe: `/estatisticas` is a
 * static shell whose aggregates arrive client-side behind a session, so an
 * anonymous crawler sees the zero state and nothing personal, and the daily
 * play routes render today's public puzzle. If either should genuinely leave
 * the index, the instrument is `robots: { index: false }` in that route's own
 * metadata, never the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [routes.attach] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
