/**
 * The dangerous side of the wall: raw table objects, the buffer
 * writers/readers, remote config, the solution-bearing reader, and the
 * curated Nonogram motif name — every read whose result apps/web must
 * never be able to name (ADR-0024). apps/web must NEVER import
 * `@miolos/db/publishing`; apps/api (cron) and tests only.
 */
export {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  listUsedTermoAnswers,
  todaySaoPaulo,
} from "./buffer";
export { createPublishingDb } from "./client";
export {
  getPublishedDailyWithSolution,
  getPublishedNonogramMotifName,
  type DailyPuzzleRow,
} from "./published";
export { getRemoteConfig } from "./remote-config";
export { dailyPuzzles, remoteConfig } from "./schema";
