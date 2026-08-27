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

export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

export type DailyPuzzleRow = typeof dailyPuzzles.$inferSelect;

function publishedConjuncts(): readonly SQL[] {
  return [
    sql`${dailyPuzzles.publishedAt} <= now()`,
    isNull(dailyPuzzles.killedAt),
  ];
}

function saoPauloToday(): SQL {
  return sql`(now() at time zone ${SAO_PAULO_TIME_ZONE})::date`;
}

function wallPredicate(game: Game, date?: string): SQL | undefined {
  return and(
    eq(dailyPuzzles.game, game),
    date === undefined
      ? sql`${dailyPuzzles.date} = ${saoPauloToday()}`
      : eq(dailyPuzzles.date, date),
    ...publishedConjuncts(),
  );
}

function archivedWallPredicate(game?: Game, date?: string): SQL | undefined {
  return and(
    game === undefined ? undefined : eq(dailyPuzzles.game, game),
    date === undefined ? undefined : eq(dailyPuzzles.date, date),
    sql`${dailyPuzzles.date} < ${saoPauloToday()}`,
    ...publishedConjuncts(),
  );
}

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

  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

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

  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

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

    return /^[\s\p{Cf}]*$/u.test(name) ? undefined : name;
  } catch (error) {
    console.error(
      `getPublishedNonogramMotifName: could not read the motif name for ${date}`,
      error,
    );
    return undefined;
  }
}

export interface ArchivedDay {
  readonly date: string;
  readonly game: Game;
}

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

  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

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
