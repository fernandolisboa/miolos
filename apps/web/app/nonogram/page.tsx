import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { NonogramScreen } from "../../src/nonogram/nonogram-screen";
import { OG_DEFAULTS } from "../../src/og/defaults";

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
    title: messages.og.dailyTitle(messages.games.nonogram.name),
    description: messages.og.dailyDescription(messages.games.nonogram.name),
  },
};

/**
 * Today's Nonogram (plan 020 AC 1/AC 3). The puzzle is fetched ONLY through
 * the published-predicate helper, which strips the reveal inside the wall
 * (ADR-0024, ADR-0033) — so the only value that crosses the RSC boundary into
 * the client tree is `DailyNonogramResponse`, and this page physically cannot
 * serialize what it never received.
 *
 * A literal route rather than a `[game]` dynamic segment (plan 018 S14): a
 * dynamic segment would put an untrusted `params.game` in front of the wall.
 * `/<jogo>` simply does not exist for a game that has no screen, and Next 404s
 * for free.
 *
 * Thin on purpose: `getTodayDaily` plus a branch. React Testing Library cannot
 * render an async server component, so all composition lives in the
 * synchronous components, which tests render directly.
 */
export default async function NonogramPage() {
  const daily = await getTodayDaily(getDb(), "nonogram");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }
  return <NonogramScreen daily={daily} />;
}
