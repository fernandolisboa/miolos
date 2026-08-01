import {
  stripDailyContent,
  type DailyPuzzleResponse,
  type Game,
} from "@miolos/core";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import type { Db } from "./client";
import { dailyPuzzles } from "./schema";

/**
 * This module is ADR-0004's entire wall (ADR-0010): every exported reader
 * carries `published_at <= now() AND killed_at IS NULL` in SQL — `now()`
 * is the DATABASE clock, never `new Date()`. Default readers additionally
 * strip inside the wall (ADR-0024): they return the solution-free public
 * projection, so no consumer — RSC pages included — can serialize what it
 * never received. The dedicated suite in test/published.test.ts may never
 * be weakened (issue #17 AC 1), and its export-list tripwires pin this
 * module's surface: a new reader added here without wall tests fails the
 * suite.
 */

/** The one spelling of the product timezone (CLAUDE.md invariant). */
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Full row shape, solution-bearing — only ever leaves via `@miolos/db/publishing`. */
export type DailyPuzzleRow = typeof dailyPuzzles.$inferSelect;

/**
 * The wall predicate, shared by every reader. `date` omitted means
 * "the DB clock's America/Sao_Paulo calendar day" (ADR-0010 single
 * authority — no server-clock skew).
 */
function wallPredicate(game: Game, date?: string): SQL | undefined {
  return and(
    eq(dailyPuzzles.game, game),
    date === undefined
      ? sql`${dailyPuzzles.date} = (now() at time zone ${SAO_PAULO_TIME_ZONE})::date`
      : eq(dailyPuzzles.date, date),
    sql`${dailyPuzzles.publishedAt} <= now()`,
    isNull(dailyPuzzles.killedAt),
  );
}

/**
 * Solution-free projection of today's daily (DB-clock SP today).
 * `undefined` = nothing published — the route answers 404, never
 * generates on demand (plan 014 D13).
 */
export async function getTodayDaily(
  db: Db,
  game: Game,
): Promise<DailyPuzzleResponse | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(wallPredicate(game))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return stripDailyContent(game, row.date, row.content);
}

/**
 * Same wall, explicit date — future dates return `undefined` by the
 * predicate, never by argument checks.
 */
export async function getPublishedDaily(
  db: Db,
  game: Game,
  date: string,
): Promise<DailyPuzzleResponse | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(wallPredicate(game, date))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return stripDailyContent(game, row.date, row.content);
}

/**
 * Full row including the solution, for judging completions (#18). Same
 * predicate: only PUBLISHED, unkilled rows — the buffer module is the
 * sole reader of unpublished rows. Exported ONLY from
 * `@miolos/db/publishing` (ADR-0024 D16), never from the root entry.
 */
export async function getPublishedDailyWithSolution(
  db: Db,
  game: Game,
  date: string,
): Promise<DailyPuzzleRow | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(wallPredicate(game, date))
    .limit(1);
  return rows[0];
}
