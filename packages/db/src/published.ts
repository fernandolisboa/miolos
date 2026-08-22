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
 * This module is ADR-0004's entire wall (ADR-0010): every exported reader
 * carries `published_at <= now() AND killed_at IS NULL` in SQL — `now()`
 * is the DATABASE clock, never `new Date()`. Default readers additionally
 * strip inside the wall (ADR-0024): they return the solution-free public
 * projection, so no consumer — RSC pages included — can serialize what it
 * never received. The dedicated suite in test/published.test.ts may never
 * be weakened (issue #17 AC 1), and its export-list tripwires pin this
 * module's surface: a new reader added here without wall tests fails the
 * suite.
 *
 * NOT EVERY READER RETURNS A ROW. `getPublishedNonogramMotifName` (#64,
 * ADR-0070) returns ONE STRING read out of `content` behind the same wall,
 * which is the strip-inside-the-wall rule taken to its limit rather than an
 * exception to it: the caller cannot over-serialize what it never received,
 * and a reader that hands back a single curated field is narrower than one
 * that hands back a projection. `listUsedTermoAnswers` is the precedent for
 * reading stored `content` back for one value.
 */

/** The one spelling of the product timezone (CLAUDE.md invariant). */
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/** Full row shape, solution-bearing — only ever leaves via `@miolos/db/publishing`. */
export type DailyPuzzleRow = typeof dailyPuzzles.$inferSelect;

/**
 * The publication conjuncts, and the ONLY spelling of them (ADR-0010 :20,
 * ADR-0014 :16, ADR-0053 decision 4). Both predicates below spread this;
 * neither re-types it. ADR-0026 :92-95 protects the wall's SEMANTICS from
 * acquiring a write-side bound — it is not a rule against factoring the
 * conjuncts two readers share.
 */
function publishedConjuncts(): readonly SQL[] {
  return [
    sql`${dailyPuzzles.publishedAt} <= now()`,
    isNull(dailyPuzzles.killedAt),
  ];
}

/**
 * The DB clock's São Paulo day, and the ONLY spelling of it in this module.
 * `wallPredicate`'s today branch, `archivedWallPredicate`'s past bound and
 * `archiveDateClass` all interpolate this one fragment; a second timezone
 * cast of the clock anywhere in this file is the divergence T-DB-S53b
 * reds on.
 *
 * The wording avoids the scanned phrase deliberately: T-DB-S53b counts
 * occurrences in the source, so a doc block quoting the expression would
 * make the scan count its own comment. The scan additionally strips
 * comments before counting, so this is belt and braces.
 */
function saoPauloToday(): SQL {
  return sql`(now() at time zone ${SAO_PAULO_TIME_ZONE})::date`;
}

/**
 * The wall predicate, shared by every reader. `date` omitted means
 * "the DB clock's America/Sao_Paulo calendar day" (ADR-0010 single
 * authority — no server-clock skew).
 *
 * UNCHANGED BEHAVIOUR at #31: same signature, same required `game`, same
 * "date omitted means the DB clock's SP day". Only the two publication
 * conjuncts and the clock fragment are now spread instead of re-typed
 * (ADR-0053 decision 4); T-DB-S53a pins that the three shipped readers
 * answer identically over the same seeds.
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
 * The ARCHIVE wall (ADR-0053 decision 4): the same conjuncts plus
 * "strictly before the DB clock's São Paulo day". Today's daily is not
 * archive content — it has its own route, and the archive's today URL
 * redirects to it (decision 1) — and no write ever originates from an
 * archive path.
 *
 * The date bound here is a READ bound on new readers. ADR-0026 decision 6's
 * rule that the WRITE bound lives in the route and never in SQL is
 * untouched, and `wallPredicate` above is byte-identical in behaviour.
 *
 * `game` and `date` are both optional because the three readers over this
 * predicate ask three different questions: one row, a date range, or every
 * month. Range bounds ride beside it in the readers rather than in the
 * signature, so the wall itself stays one shape.
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
 * generates on demand (plan 014 D13).
 *
 * Generic in `game` so a caller gets the response of the game it asked
 * for, not the whole union: once `DailyPuzzleResponse` carries two
 * members, an un-narrowed return type forces every page to branch on a
 * discriminator it already knows (plan 018 S11).
 *
 * `ProjectedGame`, NOT `Game`, and that is load-bearing: a game with no
 * projection has `Extract<DailyPuzzleResponse, { game: G }>` = `never`, so a
 * `Game`-keyed reader would type the call as `Promise<undefined>` while
 * `stripDailyContent` threw for it at runtime. The bound is what keeps an
 * unprojected game off the wall at COMPILE time, and it is the reason
 * `ProjectedGame` exists as a separate name from `Game`.
 *
 * **Termo closed at #27** — it has a projection (`game` and `date` only,
 * ADR-0038 decision 7), `ProjectedGame` covers all four M2 games
 * (`daily.ts`'s extension point is discharged), and `getTodayDaily(db,
 * "termo")` is a live call in `apps/web`'s two Termo segments. The bound
 * therefore constrains nothing today and must NOT be removed as dead: it is
 * the guard the fifth game meets. **The invariant is stated without a
 * ticket, deliberately** (step-6 F22): this sentence has already had its
 * justification moved from one unshipped ticket to another (#31 → #34) and a
 * third move would falsify it again. The standing fact is that this reader is
 * the TODAY-inclusive one — any caller that needs today's projected daily
 * wants this signature and not the archive's past-only twin below, whose
 * extra conjunct excludes today in SQL.
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
  // this line exists. Pinned by T-DB-S3 (a game-scoped read never returns
  // another game's row) and T-DB-S4 (`game === "sudoku"` at runtime on every
  // seeded row shape), so the claim is machine-checked rather than asserted.
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Same wall, explicit date — future dates return `undefined` by the
 * predicate, never by argument checks. Narrowed to the requested game for
 * the same reason `getTodayDaily` is, with the same `ProjectedGame` bound —
 * including its #27 status: all four M2 games are projected, so the bound
 * constrains nothing today and is kept for the fifth.
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
  // Same restatement, same runtime proof, same tests — see `getTodayDaily`
  // above for why TypeScript needs it (plan 018 §6.5).
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Full row including the solution, for judging completions (#18). Same
 * predicate: only PUBLISHED, unkilled rows — the buffer module is the
 * sole reader of unpublished rows. Exported ONLY from
 * `@miolos/db/publishing` (ADR-0024, plan 014 D16), never from the root
 * entry.
 *
 * Deliberately NOT narrowed like the two default readers: it returns the
 * raw row and never calls `stripDailyContent`, so it has no projection to
 * be missing and stays keyed on the full `Game` — the judge must be able
 * to read a row for any game the buffer can hold (plan 018 §6.5).
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
 * Today's Nonogram MOTIF NAME, and nothing else from the row (#64,
 * ADR-0070, which supersedes ADR-0033 decision 1's name clause).
 *
 * Same wall as every reader here — `published_at <= now() AND killed_at IS
 * NULL`, the DB clock — and the parse happens INSIDE it (ADR-0024), so the
 * caller receives one string and never a row it could over-serialize. It
 * returns `reveal.name` only: `motifId`, `mirrored` and `reveal.solution`
 * stay server-side on every projection, exactly as ADR-0033 decision 1
 * still says of them.
 *
 * IT IS THE CALLER'S JOB TO ASK ONLY AFTER THE DAY IS DECIDED. This reader
 * enforces publication, not completion — the completion half lives in
 * `dayGamesFromRows`, which attaches the name only to a `completed` nonogram
 * claim. `/day` calls this only when its own status derivation already said
 * `completed`, so most callers pay for no extra query at all.
 *
 * **IT NEVER THROWS, and the WHOLE body is guarded rather than just the
 * parse** — `getArchivedDaily`'s log-and-`undefined` idiom, for a sharper
 * reason. `/day` touches only the clock and `completions` today; this read
 * couples it to `daily_puzzles` for the first time, so an escaping throw —
 * a parse failure, a dropped connection, a statement timeout — would 500 the
 * ENTIRE day payload (hub, four tiles, every completed view) for a user
 * whose only sin was finishing the Nonogram. The name is progressive
 * enhancement; its absence is the honest degraded case, and the log line is
 * the alarm.
 *
 * **An EMPTY stored name normalises to `undefined`, and that is load-bearing
 * rather than tidy.** `nonogramRevealSchema` has no `.min(1)` —
 * `validateNonogram`'s `reveal-name-empty` rejection lives in
 * `packages/games` at GENERATION time, not on this read path — so a stored
 * `name: ""` parses fine here. Left alone it would attach `motifName: ""`,
 * fail `dayGameStateSchema`'s `.min(1)` inside the route's own
 * `dayResponseSchema.parse`, and 500 the whole payload: verbatim the failure
 * ADR-0065 decision 2 records for the `hintsUsed` cap. Tightening the
 * content schema instead would be a WRITE-side change that can drain the
 * buffer, so the normalisation lives here, at the read, where it costs
 * nothing.
 *
 * Exported from `@miolos/db/publishing` ONLY, never the root entry
 * (ADR-0024): the root entry is `apps/web`'s, and a root export would hand
 * an RSC segment a one-line channel to today's motif name.
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
    return name.trim() === "" ? undefined : name;
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
 * The archive's per-day read (ADR-0053 decision 4). `getPublishedDaily`'s
 * twin plus "strictly before the DB clock's SP day": today's daily is not
 * archive content and its URL redirects to the daily route (decision 1).
 *
 * `undefined` = the route answers Next's `notFound()` — a real 404, which
 * the daily route deliberately does NOT do (it renders an unavailable card
 * at 200, because "no puzzle today" is not "no such resource").
 *
 * **It never throws on a bad row.** If a historical row's content fails
 * `stripDailyContent`, this logs game and date and returns `undefined`, so
 * the page 404s. The URL is one the sitemap advertises to crawlers, and a
 * 500 there is worse than a 404 in every dimension — it pages nobody, it is
 * not cacheable-negative for a crawler, and it hides which row is bad. The
 * log line IS the alarm. `getTodayDaily` and `getPublishedDaily` still
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
  // Same restatement, same runtime proof, same tests — see `getTodayDaily`
  // above for why TypeScript needs it (plan 018 §6.5).
  return projected as Extract<DailyPuzzleResponse, { game: G }>;
}

/**
 * Which `(date, game)` pairs the archive holds (ADR-0053 decision 4).
 * `date` and `game` are the ONLY columns selected — no `content` is named,
 * so ADR-0024's strip-inside-the-wall holds by construction rather than by
 * a projection step.
 *
 * Deterministic order: `date DESC, game ASC`. `from`/`to` are inclusive
 * `YYYY-MM-DD` bounds compared as `date` values in SQL, never string-sliced
 * in JS. Serves the index (`limit`, over-fetched), the month pages (the
 * month's edges), the day page (`from = to`) and the sitemap (unbounded).
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
 * The months the archive spans, `'YYYY-MM'`, newest first (ADR-0053
 * decision 4). One grouped scan instead of an unbounded row read on the
 * crawler-facing index. Its LAST element IS the archive's floor — no second
 * value records it anywhere (decision 3).
 *
 * `to_char` runs in Postgres, so no JS `Date` appears in the statement —
 * this module's own law.
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
 * Which side of the DB clock's São Paulo day a date falls on (ADR-0053
 * decision 4). Reads no table and carries no wall — it answers a question
 * ABOUT the clock, and its callers have already been through one.
 *
 * It exists so `apps/web` never needs a second clock (decision 1):
 * `todaySaoPaulo` stays on `@miolos/db/publishing`, which ESLint bans in
 * `apps/web`, and `todaySaoPauloDate(new Date())` would be the WEB SERVER's
 * clock — on a different machine from Postgres — deciding a question
 * `archivedWallPredicate` answers from the database's. In the rollover
 * window where the two disagree, a URL the sitemap advertises would neither
 * redirect nor render.
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
