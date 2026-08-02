import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { NonogramConclusion } from "../../../src/nonogram/nonogram-conclusion";

// Same reasoning as /nonogram (plan 017 D5): no caching, no revalidation.
export const dynamic = "force-dynamic";

/**
 * The bookmarkable, reloadable, scannable half of the conclusion (ADR-0028).
 * The player who just finished sees the same `<ConclusionView/>` swapped in
 * place on `/nonogram` with no navigation — which is what makes finishing
 * offline work without a service worker. This route is what a bookmark, a
 * reload and `impeccable detect` reach.
 *
 * The São Paulo day always comes from the DATABASE clock: the conclusion looks
 * its record up by `daily.date`, so a wrong client clock cannot select which
 * day's result is shown (CONTEXT.md "Rollover"). With nothing published there
 * is no server day, hence no record to look up, hence the same unavailable
 * screen `/nonogram` renders.
 *
 * `date` and NOTHING ELSE crosses into the client tree — no `picture`, no
 * `result`, and no `solveNonogram` call on this server. This route renders for
 * players who have not solved, so a server-computed bitmap would turn a
 * bookmarkable page into a spoiler channel (ADR-0004, ADR-0033, ADR-0034
 * decision 3). The wrapper derives the picture from the player's OWN record.
 */
export default async function NonogramConclusionPage() {
  const daily = await getTodayDaily(getDb(), "nonogram");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }
  return <NonogramConclusion date={daily.date} />;
}
