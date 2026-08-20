// Root entry: the wall + prior art, and nothing that can bypass the wall
// (ADR-0024, plan 014 D16). Schema exports stay NAMED — `daily_puzzles` and
// `remote_config` never leak through this barrel; they live on
// `@miolos/db/publishing` with the buffer writers and the
// solution-bearing reader. The export list is pinned exactly by the
// tripwire test in test/published.test.ts.
// `pushSubscriptions` (#145, ADR-0064) rides the same entry `users` does:
// its statements live in apps/api/src/push/service.ts, which imports the
// root entry exactly as onboarding/service.ts imports `users`. Carries no
// puzzle content, so it is not behind the ADR-0004 wall.
export { pushSubscriptions, sessions, users } from "./schema";
export { createDb, type Db } from "./client";
// Re-exported so consumers depend only on @miolos/db and take no direct
// drizzle-orm dependency (pnpm's isolated node-linker would otherwise fail
// the import). The driver stays an implementation detail of this package.
export { eq, sql } from "drizzle-orm";
// #31 (ADR-0053 decision 4): the three archive readers and the date
// classifier join the ROOT entry, because `apps/web` is their only consumer
// and it may hold nothing else. They carry the same wall plus "strictly
// before the DB clock's SP day"; the classifier reads no table at all.
export {
  archiveDateClass,
  getArchivedDaily,
  getPublishedDaily,
  getTodayDaily,
  listArchivedDays,
  listArchivedMonths,
  SAO_PAULO_TIME_ZONE,
  type ArchivedDay,
} from "./published";
// Public response type for wall consumers (defined beside its schema in
// @miolos/core; re-exported here so a wall read is one import).
export type { DailyPuzzleResponse } from "@miolos/core";
