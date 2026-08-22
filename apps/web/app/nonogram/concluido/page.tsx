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
 * `result`, no `motifName`, and no `solveNonogram` call on this server. This
 * route renders for players who have not solved, so a server-computed bitmap
 * would turn a bookmarkable page into a spoiler channel (ADR-0004, ADR-0033,
 * ADR-0034 decision 3). The wrapper derives the picture from the player's OWN
 * record.
 *
 * THE MOTIF NAME (#64, ADR-0070) IS THE SAME RULE, ONE FIELD OVER, and it
 * holds by construction rather than by this comment: the name is read
 * CLIENT-SIDE, from the day-truth store, whose server snapshot is `undefined`
 * by design (`useSyncExternalStore`'s `getServerSnapshot`). No server render
 * can see it, so it can never enter this route's RSC payload — which matters
 * precisely because a visitor who has NOT solved today's Nonogram opens this
 * page too. `T-WEB-S327` pins it with a marker name and an anti-vacuity
 * positive, rather than trusting the sentence.
 */
export default async function NonogramConclusionPage() {
  const daily = await getTodayDaily(getDb(), "nonogram");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }
  return <NonogramConclusion date={daily.date} />;
}
