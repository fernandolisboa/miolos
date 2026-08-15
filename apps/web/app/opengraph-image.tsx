import { ImageResponse } from "next/og";

import { messages } from "../src/i18n";
import { CARD_HEIGHT, CARD_WIDTH, siteCard } from "../src/og/card";
import { FONTS } from "../src/og/fonts";

/**
 * The root site card (#34, ADR-0054) — the one card in the family that reads
 * nothing at all.
 *
 * **No `force-dynamic`, and that is the deliberate half of decision 9.** The
 * eight dated cards carry it because an image route at a date-bearing URL is
 * squarely inside ADR-0053 decision 2's precondition: no `revalidate` may be
 * added to an archive surface before a `killed_at` writer exists to
 * invalidate it, and a cached card outliving a takedown is that decision's
 * exact failure mode on a new surface. This card has no date, no dynamic
 * segment, no dynamic API and nothing that can go stale, so Next prerenders
 * it at build — one satori render at build time, zero at runtime. The route
 * table shows one `○` and eight `ƒ`.
 *
 * **It keeps `ImageResponse`'s default cache-control**, for the same reason.
 * The eight dated handlers override it to `private, no-store` because
 * `public` lets a shared intermediary hold bytes the kill switch must reach;
 * there is nothing here for a kill switch to reach, and a constant PNG that
 * is already a build artefact should be cacheable.
 *
 * It also imports NOTHING from `@miolos/db`, transitively included, and
 * `T-WEB-S204` proves that as a module-graph scan rather than as a claim.
 */
export const size = { width: CARD_WIDTH, height: CARD_HEIGHT };
export const contentType = "image/png";
export const alt = messages.og.altSite;

export default function Image() {
  return new ImageResponse(siteCard(), { ...size, fonts: FONTS });
}
