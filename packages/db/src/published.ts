import {
  stripDailyContent,
  type DailyPuzzleResponse,
  type Game,
  type ProjectedGame,
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
 *
 * Generic in `game` so a caller gets the response of the game it asked
 * for, not the whole union: once `DailyPuzzleResponse` carries two
 * members, an un-narrowed return type forces every page to branch on a
 * discriminator it already knows (plan 018 S11).
 *
 * `ProjectedGame`, NOT `Game`, and that is load-bearing: termo has no
 * projection yet, so `Extract<DailyPuzzleResponse, { game: "termo" }>` is
 * `never` and a `Game`-keyed reader would type
 * `getTodayDaily(db, "termo")` as `Promise<undefined>` while
 * `stripDailyContent` throws for it at runtime. #27 widens `ProjectedGame`
 * in the same PR that adds its projection; until then the call does not
 * compile.
 */
export async function getTodayDaily<G extends ProjectedGame>(
  db: Db,
  game: G,
): Promise<Extract<DailyPuzzleResponse, { game: G }> | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(wallPredicate(game))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  const projected = stripDailyContent(game, row.date, row.content);
  // Restating what stripDailyContent already PROVED at runtime: it parses
  // through the per-game response schema, whose `game` is `z.literal(game)`,
  // so the discriminator cannot disagree. TypeScript cannot follow a
  // discriminant through a generic type parameter, which is the only reason
  // this line exists. Pinned by T-DB-S3 (a game-scoped read never returns
  // another game's row) and T-DB-S4 (`game === "sudoku"` at runtime on every
  // seeded row shape), so the claim is machine-checked rather than asserted.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Same wall, explicit date — future dates return `undefined` by the
 * predicate, never by argument checks. Narrowed to the requested game for
 * the same reason `getTodayDaily` is, with the same `ProjectedGame` bound.
 */
export async function getPublishedDaily<G extends ProjectedGame>(
  db: Db,
  game: G,
  date: string,
): Promise<Extract<DailyPuzzleResponse, { game: G }> | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(wallPredicate(game, date))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  const projected = stripDailyContent(game, row.date, row.content);
  // Same restatement, same runtime proof, same tests — see `getTodayDaily`
  // above for why TypeScript needs it (plan 018 §6.5).
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Full row including the solution, for judging completions (#18). Same
 * predicate: only PUBLISHED, unkilled rows — the buffer module is the
 * sole reader of unpublished rows. Exported ONLY from
 * `@miolos/db/publishing` (ADR-0024, plan 014 D16), never from the root
 * entry.
 *
 * Deliberately NOT narrowed like the two default readers: it returns the
 * raw row and never calls `stripDailyContent`, so it has no projection to
 * be missing and stays keyed on the full `Game` — the judge must be able
 * to read a row for any game the buffer can hold (plan 018 §6.5).
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
