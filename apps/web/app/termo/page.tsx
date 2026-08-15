import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";
import { TermoScreen } from "../../src/termo/termo-screen";

// No caching of any kind on this segment (plan 017 D5): a cached page would
// serve yesterday's puzzle after the São Paulo rollover, and an ISR
// revalidation window is a window in which the wall's `published_at <= now()`
// predicate is not what the client sees (ADR-0004). No `revalidate`, no
// `generateStaticParams`, no `fetch` on this path at all.
export const dynamic = "force-dynamic";

/**
 * The share card's copy (#34 AC 4, ADR-0054 decision 10) — see
 * `app/binairo/page.tsx` for why this object carries `openGraph` and nothing
 * else, and `src/og/defaults.ts` for why the spread is not optional.
 */
export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.termo.name),
    description: ogCopy.dailyDescription(messages.games.termo.name),
  },
};

/**
 * Today's Termo (#27 AC 1). The daily is fetched ONLY through the
 * published-predicate helper, which strips the stored answer inside the wall
 * (ADR-0024, ADR-0040) — so the only value that crosses the RSC boundary into
 * the client tree is `DailyTermoResponse`, two strings, one of which is the
 * game's own name. This page physically cannot serialize what it never
 * received.
 *
 * THE STRIP IS SHARPER HERE THAN FOR THE THREE SHIPPED GAMES, and the
 * difference is worth writing down: a Nonogram picture is derivable on the
 * client from the clues, so its strip is a PRODUCT decision (ADR-0033);
 * Termo's answer is derivable from nothing the client holds, so a
 * server-computed reveal would be the ONLY channel and the leak would be
 * total.
 *
 * A literal route rather than a `[game]` dynamic segment (plan 018 S14): a
 * dynamic segment would put an untrusted `params.game` in front of the wall.
 *
 * Thin on purpose: `getTodayDaily` plus a branch. React Testing Library
 * cannot render an async server component, so all composition lives in the
 * synchronous components, which tests render directly.
 */
export default async function TermoPage() {
  const daily = await getTodayDaily(getDb(), "termo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }
  return <TermoScreen daily={daily} />;
}
