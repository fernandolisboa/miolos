import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";

// Same reasoning as /sudoku (plan 017 D5): no caching, no revalidation.
export const dynamic = "force-dynamic";

/**
 * The bookmarkable, reloadable, scannable half of the conclusion (ADR-0028,
 * D26). The player who just finished sees the same `<ConclusionView/>`
 * swapped in place on `/sudoku` with no navigation — which is what makes
 * finishing offline work without a service worker. This route is what a
 * bookmark, a reload and `impeccable detect` reach.
 *
 * The São Paulo day always comes from the DATABASE clock (D27): the
 * conclusion looks its record up by `daily.date`, so a wrong client clock
 * cannot select which day's result is shown (CONTEXT.md "Rollover"). With
 * nothing published there is no server day, hence no record to look up, hence
 * the same unavailable screen `/sudoku` renders.
 */
export default async function SudokuConclusionPage() {
  const daily = await getTodayDaily(getDb(), "sudoku");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />;
  }
  return (
    <ConclusionView
      game="sudoku"
      date={daily.date}
      copy={messages.games.sudoku.conclusion}
    />
  );
}
