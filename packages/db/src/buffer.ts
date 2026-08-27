import type { Game } from "@miolos/core";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { dailyPuzzles } from "./schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function todaySaoPaulo(db: Db): Promise<string> {
  const result = await db.execute(
    sql`select ((now() at time zone ${SAO_PAULO_TIME_ZONE})::date)::text as today`,
  );
  const today: unknown = result.rows[0]?.["today"];
  if (typeof today !== "string" || !ISO_DATE.test(today)) {
    throw new Error("todaySaoPaulo: unexpected result shape from the database");
  }
  return today;
}

export async function listBufferedDates(
  db: Db,
  game: Game,
  fromDate: string,
): Promise<string[]> {
  const rows = await db
    .select({ date: dailyPuzzles.date })
    .from(dailyPuzzles)
    .where(and(eq(dailyPuzzles.game, game), gte(dailyPuzzles.date, fromDate)));
  return rows.map((row) => row.date);
}

export async function listUsedTermoAnswers(db: Db): Promise<string[]> {
  const rows = await db
    .select({
      answer: sql<string | null>`${dailyPuzzles.content} ->> 'normalized'`,
    })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.game, "termo"));
  return rows
    .map((row) => row.answer)
    .filter((answer): answer is string => answer !== null);
}

export async function insertDailyPuzzle(
  db: Db,
  row: { game: Game; date: string; seed: number; content: unknown },
): Promise<boolean> {
  const inserted = await db
    .insert(dailyPuzzles)
    .values({
      game: row.game,
      date: row.date,
      seed: row.seed,
      content: row.content,
      publishedAt: sql`(${row.date}::date)::timestamp at time zone ${SAO_PAULO_TIME_ZONE}`,
    })
    .onConflictDoNothing({ target: [dailyPuzzles.game, dailyPuzzles.date] })
    .returning();
  return inserted.length > 0;
}

export async function bufferDepth(db: Db, game: Game): Promise<number> {
  const rows = await db
    .select({ depth: count() })
    .from(dailyPuzzles)
    .where(
      and(
        eq(dailyPuzzles.game, game),
        sql`${dailyPuzzles.date} >= (now() at time zone ${SAO_PAULO_TIME_ZONE})::date`,
        isNull(dailyPuzzles.killedAt),
      ),
    );
  return rows[0]?.depth ?? 0;
}
