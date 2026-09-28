import type { Game } from "@miolos/core";
import { sql, type Db } from "@miolos/db";
import { dailyPuzzles } from "@miolos/db/publishing";

function midnightOf(date: string) {
  return sql`(${date}::timestamp at time zone 'America/Sao_Paulo')`;
}

export async function publishDaily(
  db: Db,
  game: Game,
  date: string,
  options: { insertedAfterPublish?: boolean } = {},
): Promise<void> {
  await db.insert(dailyPuzzles).values({
    game,
    date,
    seed: 1,
    content: {},
    publishedAt: midnightOf(date),
    createdAt: options.insertedAfterPublish
      ? sql`${midnightOf(date)} + interval '1 hour'`
      : sql`${midnightOf(date)} - interval '2 days'`,
  });
}
