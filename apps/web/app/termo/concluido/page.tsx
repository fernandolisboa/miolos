import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { TermoConclusion } from "../../../src/termo/termo-conclusion";

// Same reasoning as /termo (plan 017 D5): no caching, no revalidation.
export const dynamic = "force-dynamic";

/**
 * The bookmarkable, reloadable, scannable half of the conclusion (ADR-0028).
 * The player who just finished sees the same conclusion swapped in place on
 * `/termo` with no navigation; this route is what a bookmark, a reload and
 * `impeccable detect` reach.
 *
 * The São Paulo day always comes from the DATABASE clock: the conclusion
 * looks its record up by `daily.date`, so a wrong client clock cannot select
 * which day's result is shown (CONTEXT.md "Rollover"). With nothing published
 * there is no server day, hence no record to look up, hence the same
 * unavailable screen `/termo` renders.
 *
 * `date` and NOTHING ELSE crosses into the client tree — no `result`, no
 * outcome and above all no word. This route renders for players who have NOT
 * finished, so a server-supplied answer here would turn a bookmarkable page
 * into a spoiler channel, and for this game it would be the only one there is
 * (ADR-0004, ADR-0034 decision 3, ADR-0043 decision 7). The wrapper derives
 * everything it shows from the player's OWN record.
 */
export default async function TermoConclusionPage() {
  const daily = await getTodayDaily(getDb(), "termo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }
  return <TermoConclusion date={daily.date} />;
}
