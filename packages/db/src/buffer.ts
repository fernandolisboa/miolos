import type { Game } from "@miolos/core";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { dailyPuzzles } from "./schema";

/**
 * Cron-side buffer accessors, reachable only through
 * `@miolos/db/publishing`. Rows are immutable once inserted — nothing
 * here updates or deletes.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** DB-clock America/Sao_Paulo calendar date, `'YYYY-MM-DD'` (ADR-0010). */
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

/**
 * Dates already buffered for `game` with date >= fromDate. Reads
 * unpublished and killed rows too — a killed date is already covered and
 * is never regenerated.
 */
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

/**
 * Every termo answer any row has ever claimed, as normalized ASCII forms
 * — the no-repeat rule's used-set (ADR-0040).
 *
 * No date filter and no killed_at filter, deliberately: a killed or past
 * date's answer may already have reached players, so it is spent forever,
 * not for a window (stronger than `listBufferedDates`, which is about
 * coverage).
 *
 * Reads `normalized`, not `canonical` — pure ASCII (`^[a-z]{5}$`), so the
 * comparison can't be defeated by a jsonb round-trip that composes a
 * diacritic differently.
 *
 * Bounded by the word list (~400 answers) — no index needed.
 */
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

/**
 * `published_at` is derived DB-side, the SP midnight of `date`, via
 * Postgres tzdata — no JS-constructed date appears in the insert. Returns
 * true iff a row was actually inserted; false (a lost race) still means
 * the date is covered.
 */
export async function insertDailyPuzzle(
  db: Db,
  row: { game: Game; date: string; seed: number; content: unknown },
): Promise<boolean> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse.
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

/** Days of coverage: count of alive rows with `date >= SP-today`. */
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
