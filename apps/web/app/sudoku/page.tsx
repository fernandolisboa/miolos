import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { SudokuScreen } from "../../src/sudoku/sudoku-screen";

// No caching of any kind on this segment (plan 017 D5): a cached page would
// serve yesterday's puzzle after the São Paulo rollover, and an ISR
// revalidation window is a window in which the wall's `published_at <=
// now()` predicate is not what the client sees (ADR-0004). No `revalidate`,
// no `generateStaticParams`, no `fetch` on this path at all.
export const dynamic = "force-dynamic";

/**
 * Today's Sudoku (plan 018 AC 1/AC 3). The puzzle is fetched ONLY through the
 * published-predicate helper, which strips the solution, the seed and the
 * clue count inside the wall (ADR-0024) — so the only value that crosses the
 * RSC boundary into the client tree is `DailySudokuResponse`, and this page
 * physically cannot serialize what it never received (D4).
 *
 * A literal route rather than a `[game]` dynamic segment (S14): a dynamic
 * segment would put an untrusted `params.game` in front of the wall and would
 * resolve `/daily/nonogram` into an uncaught `DailyProjectionUnsupportedError`.
 * `/sudoku` simply does not exist for a game that has no screen, and Next
 * 404s for free.
 *
 * Thin on purpose: `getTodayDaily` plus a branch. React Testing Library
 * cannot render an async server component, so all composition lives in the
 * synchronous components, which tests render directly (plan 018 §15).
 */
export default async function SudokuPage() {
  const daily = await getTodayDaily(getDb(), "sudoku");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />;
  }
  return <SudokuScreen daily={daily} />;
}
