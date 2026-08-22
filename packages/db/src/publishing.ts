/**
 * Server-internal surface — the dangerous side of the wall (ADR-0024,
 * plan 014 D16). Everything that can bypass the published-predicate wall
 * lives here and ONLY here: the raw table objects, the buffer writers/
 * readers, remote config, the solution-bearing reader, and — since #64
 * (ADR-0070) — a CURATED-CONTENT reader that returns neither a row nor a
 * solution but one withheld string, today's Nonogram motif name.
 *
 * That last one widens what this entry is FOR, so it is named rather than
 * left to be inferred from the export list: the entry is not only "readers
 * that can see unpublished rows" and "readers that carry a solution". It is
 * every read whose result `apps/web` must not be able to name. A single
 * curated field is exactly that — the daily payload strips `reveal` whole,
 * and a root export of this reader would hand an RSC segment a one-line
 * channel to today's name.
 *
 * apps/web must NEVER import `@miolos/db/publishing` (ADR-0024 records
 * the rule; #18 adds the ESLint no-restricted-imports ban when web gains
 * the db dependency). apps/api (cron; #18 grading) and tests only.
 *
 * The export list below is pinned exactly by the tripwire test in
 * test/published.test.ts — widening this surface fails the suite.
 */
export {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  listUsedTermoAnswers,
  todaySaoPaulo,
} from "./buffer";
// Full-schema client (relational-query access to daily_puzzles) — the
// root entry's createDb is deliberately narrowed to users/sessions.
export { createPublishingDb } from "./client";
export {
  getPublishedDailyWithSolution,
  // #64 (ADR-0070): today's Nonogram motif NAME, for a day the caller has
  // already judged completed. It sits on this entry rather than the root's
  // for the ADR-0024 reason the header states — the root entry is
  // `apps/web`'s, and a root export would hand an RSC segment a one-line
  // channel to today's name. It is the whole reason the surface tripwires
  // move by one on THIS entry and stay byte-identical on the root's.
  getPublishedNonogramMotifName,
  type DailyPuzzleRow,
} from "./published";
export { getRemoteConfig } from "./remote-config";
export { dailyPuzzles, remoteConfig } from "./schema";
