// Root entry: the wall + prior art, and nothing that can bypass the wall
// (ADR-0024 D16). Schema exports stay NAMED — `daily_puzzles` and
// `remote_config` never leak through this barrel; they live on
// `@miolos/db/publishing` with the buffer writers and the
// solution-bearing reader. The export list is pinned exactly by the
// tripwire test in test/published.test.ts.
export { sessions, users } from "./schema";
export { createDb, type Db } from "./client";
// Re-exported so consumers depend only on @miolos/db and take no direct
// drizzle-orm dependency (pnpm's isolated node-linker would otherwise fail
// the import). The driver stays an implementation detail of this package.
export { eq, sql } from "drizzle-orm";
export {
  getPublishedDaily,
  getTodayDaily,
  SAO_PAULO_TIME_ZONE,
} from "./published";
// Public response type for wall consumers (defined beside its schema in
// @miolos/core; re-exported here so a wall read is one import).
export type { DailyPuzzleResponse } from "@miolos/core";
