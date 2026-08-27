import {
  LATE_SYNC_CREDIT_DAYS_BACK,
  type CompletionOutcome,
  type DayRow,
  type Game,
  type HintGrantSource,
  type StreakRow,
} from "@miolos/core";
import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { completions, hintGrants } from "./schema";

export interface CompletionRecord {
  readonly game: Game;
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  readonly elapsedMs: number;
  readonly hintsUsed: number;
}

export async function getCompletion(
  db: Db,
  userId: string,
  game: Game,
  date: string,
): Promise<CompletionRecord | undefined> {
  const rows = await db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
      onTime: completions.onTime,
    })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        eq(completions.game, game),
        eq(completions.date, date),
      ),
    )
    .limit(1);
  return rows[0];
}

export async function listCompletionsForStreak(
  db: Db,
  userId: string,
): Promise<StreakRow[]> {
  return db
    .select({
      date: completions.date,
      outcome: completions.outcome,
      onTime: completions.onTime,
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(desc(completions.date));
}

export async function listCompletionsForDay(
  db: Db,
  userId: string,
  date: string,
): Promise<DayRow[]> {
  return db
    .select({
      game: completions.game,
      outcome: completions.outcome,
      onTime: completions.onTime,
      elapsedMs: completions.elapsedMs,
      hintsUsed: completions.hintsUsed,
    })
    .from(completions)
    .where(and(eq(completions.userId, userId), eq(completions.date, date)));
}

function writtenOnSaoPauloDay(day: string) {
  return sql`(${completions.completedAt} at time zone ${SAO_PAULO_TIME_ZONE})::date = ${day}`;
}

interface LateWriteCeiling {
  readonly day: string;
  readonly max: number;
}

type CompletionWrite =
  | {
      readonly capped: false;
      readonly record: CompletionRecord;
      readonly recorded: boolean;
    }
  | { readonly capped: true };

interface CompletionWriteInput {
  userId: string;
  game: Game;
  date: string;
  outcome: CompletionOutcome;
  elapsedMs: number;
  hintsUsed: number;
  guesses?: number;
  onTime: boolean;
}

function guardedInsertSelect(
  input: CompletionWriteInput,
  ceiling: LateWriteCeiling,
) {
  return sql`select ${input.userId}::uuid, ${input.game}::text, ${input.date}::date, now(), ${input.outcome}::text, ${input.elapsedMs}::integer, ${input.hintsUsed}::integer, ${input.guesses ?? null}::integer, ${input.onTime}::boolean
    where (
      select count(*) from ${completions}
      where ${completions.userId} = ${input.userId}::uuid
        and ${writtenOnSaoPauloDay(ceiling.day)}
        and not ${completions.onTime}
    ) < ${ceiling.max}`;
}

export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
): Promise<Extract<CompletionWrite, { capped: false }>>;
export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
  ceiling: LateWriteCeiling,
): Promise<CompletionWrite>;
export async function recordCompletion(
  db: Db,
  input: CompletionWriteInput,
  ceiling?: LateWriteCeiling,
): Promise<CompletionWrite> {
  const inserted = ceiling
    ? await db
        .insert(completions)
        .select(guardedInsertSelect(input, ceiling))
        .onConflictDoNothing({
          target: [completions.userId, completions.game, completions.date],
        })
        .returning()
    : await db
        .insert(completions)
        .values({
          userId: input.userId,
          game: input.game,
          date: input.date,
          outcome: input.outcome,
          elapsedMs: input.elapsedMs,
          hintsUsed: input.hintsUsed,
          guesses: input.guesses,
          onTime: input.onTime,
        })
        .onConflictDoNothing({
          target: [completions.userId, completions.game, completions.date],
        })
        .returning();
  const recorded = inserted.length > 0;

  const record = await getCompletion(db, input.userId, input.game, input.date);
  if (!record) {
    if (ceiling && !recorded) {
      return { capped: true };
    }

    throw new Error("completions insert left no readable row");
  }
  return { capped: false, record, recorded };
}

export async function hasCreditedPastDateToday(
  db: Db,
  userId: string,
  args: { today: string; excludingDate: string },
): Promise<boolean> {
  const rows = await db
    .select({ date: completions.date })
    .from(completions)
    .where(
      and(
        eq(completions.userId, userId),
        eq(completions.onTime, true),
        sql`${completions.date} < ${args.today}`,
        sql`${completions.date} >= ${args.today}::date - ${LATE_SYNC_CREDIT_DAYS_BACK}::int`,
        sql`${completions.date} <> ${args.excludingDate}`,
        writtenOnSaoPauloDay(args.today),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function grantedHintsToday(
  db: Db,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({
      hints: sql<number>`coalesce(sum(${hintGrants.hints}), 0)::int`,
    })
    .from(hintGrants)
    .where(
      and(
        eq(hintGrants.userId, userId),
        sql`${hintGrants.date} = (now() at time zone ${SAO_PAULO_TIME_ZONE})::date`,
      ),
    );
  return rows[0]?.hints ?? 0;
}

export async function grantHints(
  db: Db,
  input: {
    userId: string;
    date: string;
    source: HintGrantSource;
    hints: number;
  },
): Promise<void> {
  await db.insert(hintGrants).values({
    userId: input.userId,
    date: input.date,
    source: input.source,
    hints: input.hints,
  });
}
