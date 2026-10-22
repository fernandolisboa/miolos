import { addDays, remoteConfigField } from "@miolos/core";
import { sql, type Db } from "@miolos/db";
import { dailyPuzzles } from "@miolos/db/publishing";
import type { TermoAnswer } from "@miolos/games/termo-answers";
import { TERMO_ANSWER_COOLDOWN_DAYS } from "../src/publishing/service";

const maxBufferDepth = remoteConfigField("bufferDepth").maxValue;
if (maxBufferDepth === null) {
  throw new Error("bufferDepth has no maximum");
}
export const MAX_BUFFER_DEPTH: number = maxBufferDepth;

export const FULLEST_TERMO_WINDOW =
  TERMO_ANSWER_COOLDOWN_DAYS - 1 + MAX_BUFFER_DEPTH;

const FAR_FUTURE = "2126-01-01";

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
  await db
    .insert(dailyPuzzles)
    .values(rows.map(({ date, answer }) => termoRow(date, answer)));
}

export async function spendTermoAnswers(
  db: Db,
  answers: readonly TermoAnswer[],
): Promise<void> {
  await db.insert(dailyPuzzles).values(
    answers.map((answer, index) => ({
      ...termoRow(addDays(FAR_FUTURE, index), answer),
      killedAt: sql`now()`,
    })),
  );
}
