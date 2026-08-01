import { getTodayDaily } from "@miolos/db";

import { BinairoScreen } from "../../src/binairo/binairo-screen";
import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";

// No caching of any kind on this segment (plan 017 D5): a cached page would
// serve yesterday's puzzle after the São Paulo rollover, and an ISR
// revalidation window is a window in which the wall's `published_at <=
// now()` predicate is not what the client sees (ADR-0004). No `revalidate`,
// no `generateStaticParams`, no `fetch` on this path at all.
export const dynamic = "force-dynamic";

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
