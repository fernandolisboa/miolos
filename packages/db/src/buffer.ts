import type { Game } from "@miolos/core";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { dailyPuzzles } from "./schema";

/**
 * Cron-side buffer accessors — NOT part of the public wall. Reachable
 * only through `@miolos/db/publishing` (ADR-0024, plan 014 D16), never from the
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
 * Every termo answer any row has ever claimed, as normalized forms — the
 * no-repeat rule's used-set (ADR-0040). THE FIRST top-up read-back of
 * stored `content` in this package; every sibling above and below reads
 * dates (`listBufferedDates`) or counts (`bufferDepth`). Do not
 * "harmonise" it away.
 *
 * NO date filter and NO killed_at filter, deliberately, and for a stronger
 * reason than `listBufferedDates`' (ADR-0024 D14): a killed date's answer
 * may already have reached players, and a past date's certainly did. An
 * answer is spent forever, not for a window.
 *
 * `normalized` and not `canonical`: it is `^[a-z]{5}$` by the word-list
 * harness (packages/games/test/termo/word-list.test.ts), so the comparison
 * is pure ASCII and cannot be defeated by a jsonb round-trip that composes
 * or decomposes a diacritic differently.
 *
 * Bounded by the word list, forever: the exhaustion rule stops writing at
 * 400 answers, so this scans at most ~400 rows of ~50-byte content and
 * returns ~2.4 KB, because `->>` projects server-side. No index is owed on
 * `daily_puzzles`, which has none beyond its composite PK. Revisit only if
 * a second game ever needs a content read-back.
 *
 * `->>` yields NULL for a row whose content has no `normalized` key, so the
 * filter below is a real branch rather than a formality: it is what a
 * hand-written or pre-schema row would take.
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
