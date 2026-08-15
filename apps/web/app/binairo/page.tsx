import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { BinairoScreen } from "../../src/binairo/binairo-screen";
import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";

// No caching of any kind on this segment (plan 017 D5): a cached page would
// serve yesterday's puzzle after the São Paulo rollover, and an ISR
// revalidation window is a window in which the wall's `published_at <=
// now()` predicate is not what the client sees (ADR-0004). No `revalidate`,
// no `generateStaticParams`, no `fetch` on this path at all.
export const dynamic = "force-dynamic";

/**
 * The share card's copy (#34 AC 4, ADR-0054 decision 10). This is the daily
 * routes' canonical statement of the shape; the other three point here.
 *
 * **`openGraph` and nothing else — no page `title`, no `description`, no
 * `alternates`.** A page-level `description` is the SERP snippet, not a chat
 * bubble, so adding one would make ADR-0028 `:37-39`'s "neither cacheable nor
 * an SEO surface" a claim this ticket had quietly falsified. Verified on a
 * Turbopack production build: with `openGraph` alone, `<title>` and
 * `<meta name="description">` still come from the root layout, while
 * `og:title`/`og:description` are the leaf's and `twitter:title` is derived
 * from `openGraph` automatically. So the crawl-facing metadata of this route
 * is byte-unchanged from before #34 and only the sharing channel gains
 * anything. `T-WEB-S198` asserts the absence as a key list so a later ticket
 * cannot add them silently.
 *
 * **No canonical either.** Pointing it at itself is the default assumption
 * anyway, and pointing it at `/arquivo/<hoje>/<jogo>` would name a URL that
 * 307s back to this one today (ADR-0053 decision 1) — a self-defeating signal
 * whose meaning changes at midnight.
 *
 * **Static, not `generateMetadata`.** Nothing in it depends on the request,
 * and a static export cannot accidentally acquire a database read. The card
 * image and its `alt` come from the sibling `opengraph-image.tsx`.
 *
 * The cost, stated: the browser tab keeps saying *Miolos* rather than
 * *Binairo · Miolos*. That is today's behaviour, unchanged. A later ticket
 * that wants a page title is welcome to it, and will owe the ADR-0028
 * annotation this one does not.
 */
export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.binairo.name),
    description: ogCopy.dailyDescription(messages.games.binairo.name),
  },
};

/**
 * Today's Binairo (AC 1). The puzzle is fetched ONLY through the
 * published-predicate helper, which strips the solution inside the wall
 * (ADR-0024) — so the only value that crosses the RSC boundary into the
 * client tree is `DailyPuzzleResponse`, and this page physically cannot
 * serialize what it never received (D4).
 *
 * Thin on purpose: `getTodayDaily` plus a branch. React Testing Library
 * cannot render an async server component, so all composition lives in the
 * synchronous components below, which tests render directly (plan 017 §15).
 */
export default async function BinairoPage() {
  const daily = await getTodayDaily(getDb(), "binairo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.binairo.play.unavailable} />;
  }
  return <BinairoScreen daily={daily} />;
}
