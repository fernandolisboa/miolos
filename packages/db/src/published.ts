import {
  nonogramDailyContentSchema,
  stripDailyContent,
  type DailyPuzzleResponse,
  type Game,
  type ProjectedGame,
} from "@miolos/core";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Db } from "./client";
import { dailyPuzzles } from "./schema";

/**
 * This module is ADR-0004's entire wall: every exported reader carries
 * `published_at <= now() AND killed_at IS NULL` in SQL — `now()` is the
 * DATABASE clock, never `new Date()`. Default readers additionally strip
 * inside the wall: they return the solution-free public projection, so no
 * consumer — RSC pages included — can serialize what it never received.
 * See ADR-0004.
 */

/** The one spelling of the product timezone. */
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Full row shape, solution-bearing — only ever leaves via `@miolos/db/publishing`. */
export type DailyPuzzleRow = typeof dailyPuzzles.$inferSelect;

/**
 * The publication conjuncts, and the ONLY spelling of them — both
 * predicates below spread this, neither re-types it. See ADR-0004.
 */
function publishedConjuncts(): readonly SQL[] {
  return [
    sql`${dailyPuzzles.publishedAt} <= now()`,
    isNull(dailyPuzzles.killedAt),
  ];
}

/**
 * The DB clock's São Paulo day, the ONLY spelling of it in this module —
 * `wallPredicate`, `archivedWallPredicate` and `archiveDateClass` all
 * interpolate this one fragment. A test counts spellings by source scan
 * (comments stripped first), so this doc block avoids quoting the
 * expression itself.
 */
function saoPauloToday(): SQL {
  return sql`(now() at time zone ${SAO_PAULO_TIME_ZONE})::date`;
}

/**
 * The wall predicate, shared by every reader. `date` omitted means "the
 * DB clock's America/Sao_Paulo calendar day" — no server-clock skew.
 */
function wallPredicate(game: Game, date?: string): SQL | undefined {
  return and(
    eq(dailyPuzzles.game, game),
    date === undefined
      ? sql`${dailyPuzzles.date} = ${saoPauloToday()}`
      : eq(dailyPuzzles.date, date),
    ...publishedConjuncts(),
  );
}

/**
 * The ARCHIVE wall: the same conjuncts plus "strictly before the DB
 * clock's São Paulo day". Today's daily is not archive content — it has
 * its own route, and the archive's today URL redirects to it.
 *
 * The date bound here is a READ bound only; the WRITE bound lives in the
 * route and never in SQL, and `wallPredicate` above is untouched.
 *
 * `game` and `date` are both optional because the three readers over this
 * predicate ask three different questions: one row, a date range, or every
 * month.
 */
function archivedWallPredicate(game?: Game, date?: string): SQL | undefined {
  return and(
    game === undefined ? undefined : eq(dailyPuzzles.game, game),
    date === undefined ? undefined : eq(dailyPuzzles.date, date),
    sql`${dailyPuzzles.date} < ${saoPauloToday()}`,
    ...publishedConjuncts(),
  );
}

/**
 * Solution-free projection of today's daily (DB-clock SP today).
 * `undefined` = nothing published — the route answers 404, never
 * generates on demand.
 *
 * Generic in `game` so a caller gets the response of the game it asked
 * for, not the whole union. Bounded to `ProjectedGame`, NOT `Game`: a game
 * with no projection has `Extract<DailyPuzzleResponse, { game: G }>` =
 * `never`, so a `Game`-keyed reader would type the call as
 * `Promise<undefined>` while `stripDailyContent` threw for it at runtime —
 * the bound is what keeps an unprojected game off the wall at COMPILE
 * time. Every shipped game currently has a projection, so the bound
 * constrains nothing today; it is the guard the next unprojected game
 * meets.
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
  // this line exists.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Same wall as `getTodayDaily`, explicit date — future dates return
 * `undefined` by the predicate, never by argument checks. Same
 * `ProjectedGame` bound and reasoning.
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
  // Same restatement, same runtime proof — see `getTodayDaily` above.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Full row including the solution, for judging completions. Same
 * predicate: only PUBLISHED, unkilled rows — the buffer module is the
 * sole reader of unpublished rows. Exported ONLY from
 * `@miolos/db/publishing`, never from the root entry.
 *
 * Deliberately NOT narrowed like the two default readers: it returns the
 * raw row and never calls `stripDailyContent`, so it stays keyed on the
 * full `Game` — the judge must be able to read a row for any game the
 * buffer can hold.
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

/**
 * Today's Nonogram MOTIF NAME, and nothing else from the row (see
 * ADR-0070). Same wall as every reader here, parsed INSIDE it, so the
 * caller receives one string and never a row it could over-serialize.
 *
 * IT NEVER THROWS, and the WHOLE body is guarded, not just the parse:
 * `/day` touches only the clock and `completions` today, and this read
 * couples it to `daily_puzzles` for the first time. An escaping throw — a
 * parse failure, a dropped connection, a statement timeout — would 500
 * the ENTIRE day payload for a user whose only sin was finishing the
 * Nonogram. The name is progressive enhancement; the log line is the
 * alarm.
 *
 * An EMPTY stored name normalises to `undefined` — load-bearing, not
 * tidy: `nonogramRevealSchema` has no `.min(1)`, so a stored `name: ""`
 * parses fine here, but would fail the wire's `.min(1)` and 500 the whole
 * payload if returned as-is.
 *
 * Exported from `@miolos/db/publishing` ONLY, never the root entry: the
 * root entry is `apps/web`'s, and a root export would hand an RSC segment
 * a one-line channel to today's motif name.
 */
export async function getPublishedNonogramMotifName(
  db: Db,
  date: string,
): Promise<string | undefined> {
  try {
    const rows = await db
      .select({ content: dailyPuzzles.content })
      .from(dailyPuzzles)
      .where(wallPredicate("nonogram", date))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    const name = nonogramDailyContentSchema.parse(row.content).reveal.name;
    // BLANK is wider than `trim()`'s idea of blank, on purpose: a stored
    // U+200B (zero-width space) or U+FEFF (BOM) survives `trim()` and
    // would render an INVISIBLE name under a visible lead. `\p{Cf}` covers
    // the format characters that `\s` does not.
    return /^[\s\p{Cf}]*$/u.test(name) ? undefined : name;
  } catch (error) {
    console.error(
      `getPublishedNonogramMotifName: could not read the motif name for ${date}`,
      error,
    );
    return undefined;
  }
}

/** One archived `(date, game)` pair — no content, by construction. */
export interface ArchivedDay {
  readonly date: string;
  readonly game: Game;
}

/**
 * The archive's per-day read. `getPublishedDaily`'s twin plus "strictly
 * before the DB clock's SP day": today's daily is not archive content and
 * its URL redirects to the daily route.
 *
 * `undefined` = the route answers Next's `notFound()` — a real 404, which
 * the daily route deliberately does NOT do (it renders an unavailable card
 * at 200, because "no puzzle today" is not "no such resource").
 *
 * It never throws on a bad row: if a historical row's content fails to
 * parse, this logs and returns `undefined` so the page 404s. The URL is
 * one the sitemap advertises to crawlers, and a 500 there is worse than a
 * 404 in every dimension. `getTodayDaily` and `getPublishedDaily` still
 * throw, because on those a bad row is a live incident.
 */
export async function getArchivedDaily<G extends ProjectedGame>(
  db: Db,
  game: G,
  date: string,
): Promise<Extract<DailyPuzzleResponse, { game: G }> | undefined> {
  const rows = await db
    .select()
    .from(dailyPuzzles)
    .where(archivedWallPredicate(game, date))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  let projected;
  try {
    projected = stripDailyContent(game, row.date, row.content);
  } catch (error) {
    console.error(
      `getArchivedDaily: stored content failed to parse for ${game} ${date}`,
      error,
    );
    return undefined;
  }
  // Same restatement, same runtime proof — see `getTodayDaily` above.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Which `(date, game)` pairs the archive holds. `date` and `game` are the
 * ONLY columns selected — no `content` is named, so the strip-inside-the-
 * wall rule holds by construction rather than by a projection step.
 *
 * Deterministic order: `date DESC, game ASC`. `from`/`to` are inclusive
 * `YYYY-MM-DD` bounds compared as `date` values in SQL, never
 * string-sliced in JS.
 */
export async function listArchivedDays(
  db: Db,
  options?: {
    readonly from?: string;
    readonly to?: string;
    readonly limit?: number;
  },
): Promise<readonly ArchivedDay[]> {
  const query = db
    .select({ date: dailyPuzzles.date, game: dailyPuzzles.game })
    .from(dailyPuzzles)
    .where(
      and(
        archivedWallPredicate(),
        options?.from === undefined
          ? undefined
          : gte(dailyPuzzles.date, options.from),
        options?.to === undefined
          ? undefined
          : lte(dailyPuzzles.date, options.to),
      ),
    )
    .orderBy(desc(dailyPuzzles.date), asc(dailyPuzzles.game));
  return options?.limit === undefined ? query : query.limit(options.limit);
}

/**
 * The months the archive spans, `'YYYY-MM'`, newest first. One grouped
 * scan instead of an unbounded row read on the crawler-facing index.
 *
 * `to_char` runs in Postgres, so no JS `Date` appears in the statement.
 */
export async function listArchivedMonths(db: Db): Promise<readonly string[]> {
  const month = sql<string>`to_char(${dailyPuzzles.date}, 'YYYY-MM')`;
  const rows = await db
    .select({ month })
    .from(dailyPuzzles)
    .where(archivedWallPredicate())
    .groupBy(month)
    .orderBy(desc(month));
  return rows.map((row) => row.month);
}

/**
 * Which side of the DB clock's São Paulo day a date falls on. Reads no
 * table and carries no wall — it answers a question ABOUT the clock.
 *
 * It exists so `apps/web` never needs a second clock: this function stays
 * on `@miolos/db/publishing`, which ESLint bans in `apps/web`, so no route
 * ever decides this question from the WEB SERVER's clock — on a different
 * machine from Postgres — instead of the database's.
 *
 * Called ONLY after a walled read came back empty, to tell "today,
 * redirect" from "absent, 404".
 */
export async function archiveDateClass(
  db: Db,
  date: string,
): Promise<"past" | "today" | "future"> {
  const result = await db.execute(
    sql`select case
          when ${date}::date < ${saoPauloToday()} then 'past'
          when ${date}::date = ${saoPauloToday()} then 'today'
          else 'future'
        end as class`,
  );
  const value: unknown = result.rows[0]?.["class"];
  if (value !== "past" && value !== "today" && value !== "future") {
    throw new Error(
      "archiveDateClass: unexpected result shape from the database",
    );
  }
  return value;
}
