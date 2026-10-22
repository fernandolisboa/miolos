import { addDays } from "@miolos/core";
import { sql, type Db } from "@miolos/db";
import { dailyPuzzles } from "@miolos/db/publishing";
import type { TermoAnswer } from "@miolos/games/termo-answers";

function termoRow(date: string, answer: TermoAnswer) {
  return {
    game: "termo" as const,
    date,
    seed: 1,
    content: { canonical: answer.canonical, normalized: answer.normalized },
    publishedAt: sql`(${date}::timestamp at time zone 'America/Sao_Paulo')`,
  };
}

export async function seedTermoAnswers(
  db: Db,
  rows: readonly { date: string; answer: TermoAnswer }[],
): Promise<void> {
  if (rows.length > 0) {
    await db
      .insert(dailyPuzzles)
      .values(rows.map(({ date, answer }) => termoRow(date, answer)));
  }
}

export async function spendAnswers(
  db: Db,
  answers: readonly TermoAnswer[],
): Promise<void> {
  if (answers.length > 0) {
    await db.insert(dailyPuzzles).values(
      answers.map((answer, index) => ({
        ...termoRow(addDays("2126-01-01", index), answer),
        killedAt: sql`now()`,
      })),
    );
  }
}
