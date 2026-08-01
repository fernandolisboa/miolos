import type { Game } from "@miolos/core";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { dailyPuzzles } from "./schema";

/**
 * Cron-side buffer accessors — NOT part of the public wall. Reachable
 * only through `@miolos/db/publishing` (ADR-0024 D16), never from the
 * root entry: client-serving code cannot import this module by
 * construction, not by reviewer vigilance. Rows are immutable once
 * inserted (D14) — nothing here updates or deletes.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** DB-clock America/Sao_Paulo calendar date, 'YYYY-MM-DD' (ADR-0010 single authority). */
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
 * unpublished (and killed) rows — cron only: killed dates are already
 * covered and are never regenerated (D14).
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
 * INSERT ... ON CONFLICT (game, date) DO NOTHING. `published_at` is
 * derived DB-side in the same INSERT — the SP midnight of `date` as an
 * instant, via Postgres tzdata (D8); no JS-constructed date ever appears
 * in an insert. Returns true iff a row was actually inserted (a false
 * from a lost concurrent race still means the date is covered).
 */
export async function insertDailyPuzzle(
  db: Db,
  row: { game: Game; date: string; seed: number; content: unknown },
): Promise<boolean> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse (session/service.ts precedent).
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

/**
 * Days of coverage: count of alive rows with date >= SP-today (D12).
 * After a full top-up: bufferDepth (today + bufferDepth-1 future days).
 * Also the monitoring query behind GET /buffer-depth (issue #17 AC 3).
 */
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
