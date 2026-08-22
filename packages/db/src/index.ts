// Root entry: the wall + prior art, nothing that can bypass it.
// `daily_puzzles` and `remote_config` never leak through this barrel —
// they live on `@miolos/db/publishing`.
// `pushSubscriptions` carries no puzzle content, so it is not behind the
// ADR-0004 wall — safe on the root entry, like `users`.
export { pushSubscriptions, sessions, users } from "./schema";
export { createDb, type Db } from "./client";
// Re-exported so consumers depend only on @miolos/db and take no direct
// drizzle-orm dependency — pnpm's isolated node-linker would otherwise
// fail the import.
export { eq, sql } from "drizzle-orm";
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
export type { DailyPuzzleResponse } from "@miolos/core";
