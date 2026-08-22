import type { ProjectedGame } from "@miolos/core";
import { getPublishedDaily, getTodayDaily, listArchivedDays } from "@miolos/db";
import { ImageResponse } from "next/og";

import {
  monthDayBounds,
  parseArchiveDate,
  parseArchiveMonth,
} from "../archive/parse-params";
import { getDb } from "../db";
import {
  formatDayAndMonth,
  formatLongDate,
  formatMonth,
  messages,
} from "../i18n";
import { archiveCard, gameCard, CARD_HEIGHT, CARD_WIDTH } from "./card";
import { ogCopy } from "./copy";
import { FONTS } from "./fonts";

/**
 * The two handlers behind the eight dated OG image routes (#34, ADR-0054).
 *
 * Each route file is a table entry: the segment config, the static `alt`, and
 * one call. Everything that could differ between them lives here, once.
 *
 * ## One wall read, and the card gets ONE field of it
 *
 * The result decides *render or 404* and supplies the one non-content value
 * the card names — the date. That is not "no field of the response reaches the
 * card"; it is narrower and still strong: `date` is not puzzle content (it is
 * the value the archive URL carries in plain sight and the sitemap publishes),
 * and the mechanism keeping it that way is `gameCard`'s SIGNATURE, which has
 * no parameter a daily response can enter through.
 *
 * **The archive family reads `getPublishedDaily(db, game, date)` — one round
 * trip, no classifier, no today branch.** Its `wallPredicate` is
 * `game = X AND date = D AND published_at <= now() AND killed_at IS NULL`, and
 * the buffer writes `published_at` as the date's OWN São Paulo midnight, so
 * `published_at <= now()` IS "date ≤ today (São Paulo)", exactly. Future dates
 * are excluded by the same predicate that excludes unpublished ones, and the
 * today case that a read-then-classify path needs a branch for is simply
 * inside it — which also removes the midnight race where a rollover between
 * two round trips renders a card for date D on the strength of a row for D+1.
 *
 * **The daily family reads `getTodayDaily(db, game)`** — the same call its
 * sibling page already makes. It has no date in the URL, and the only
 * server-truthful source of today's São Paulo date is the DB clock, which that
 * reader's predicate interpolates. No client clock, no `new Date()`.
 *
 * ADR-0010 `:20` is the governing sentence and it names this surface: "Every
 * read path — daily, archive, OG images, anything — filters
 * `published_at <= now()`, and does so through one shared query helper, not a
 * predicate re-typed per route." Both readers carry the conjuncts through
 * `packages/db`'s single private `publishedConjuncts()`. No fallback card
 * exists, ever: a fallback would be an unpublished day rendering *something*.
 *
 * ## The two ARCHIVE SHELL handlers, and why they have NO catch (#104)
 *
 * `archiveDayCardHandler` and `archiveMonthCardHandler` serve the `/cartao`
 * family. Each card's existence proof is its PAGE's, through one bounded
 * `listArchivedDays(…, { limit: 1 })` — the smallest read that answers the
 * question the page itself asks (`days.length === 0`), so the card's truth
 * value is its page's by construction and no game SET is ever in scope.
 * Existence is the DAY, not a game's row: a day holding one game renders a
 * card, exactly as the page renders one game (ADR-0053 decision 3's ragged
 * floor).
 *
 * **The rule above produces no catch here, and the omission is the argument
 * rather than a gap.** `listArchivedDays` selects two columns, runs no
 * projection and parses nothing (`packages/db/src/published.ts:372-396`), so
 * no member of `PROJECTION_ERROR_NAMES` can arise from it. Every callee on
 * the path was traced: `parseArchiveDate` and `parseArchiveMonth` use
 * `safeParse`, never `parse`, so neither can throw a `ZodError`; `getDb()`
 * throws a plain `Error("WEB_DATABASE_URL is not set")`. A narrowed catch
 * here would be unreachable code that re-throws everything. Every throw these
 * handlers can see — a Neon timeout, a pool error, a missing credential — is
 * exactly the class the name set was always designed to send to a 500.
 * `T-WEB-S334` pins both directions so the absence can go red.
 *
 * The `ImageResponse` construction stays outside any read for the same reason
 * it is outside the `try` above: a satori throw must be a 500.
 *
 * `parseArchiveMonth` carries the year-zero floor that fixed a real
 * unauthenticated 500 (`archive/parse-params.ts`), and the card inherits it
 * by calling the same parser rather than a second regex.
 */

/**
 * **A BAD ROW 404s. A DATABASE OUTAGE MUST NOT.**
 *
 * `getPublishedDaily` and `getTodayDaily` deliberately throw on an
 * unparseable row where `getArchivedDaily` catches — "on those a bad row is a
 * live incident" — so an image route calling them would 500 where the sibling
 * page 404s, on a surface even more crawler-facing than the page. Hence the
 * catch. But `getArchivedDaily`'s own catch wraps only the projection, not the
 * query, and its 404-over-500 argument is about A BAD ROW, not an outage. For
 * a transient outage that argument INVERTS: a 500 is retried and pages
 * somebody, while a 404 on this surface is negative-cached by social scrapers
 * for days, names no bad row in the log, and leaves the card dead long after
 * the database is back.
 *
 * So the catch is narrowed to the projection class and everything else
 * re-throws. **NEITHER CLASS CAN BE IMPORTED HERE, and that is why this
 * matches on `name`**: `DailyProjectionUnsupportedError` is on the app-wide
 * wall's banned-name list, and a cross-package `instanceof ZodError` is an
 * identity assumption about two `node_modules` trees rather than a fact. Both
 * names are set explicitly at the source. The name check fails CLOSED — to a
 * 500, the live-incident behaviour — if a future version skew ever broke it.
 */
const PROJECTION_ERROR_NAMES = new Set([
  "ZodError",
  "DailyProjectionUnsupportedError",
]);

function isBadRow(error: unknown): boolean {
  return error instanceof Error && PROJECTION_ERROR_NAMES.has(error.name);
}

const SIZE = { width: CARD_WIDTH, height: CARD_HEIGHT };

/**
 * Next's `ImageResponse` defaults to `public, max-age=0, must-revalidate` in
 * production, and `public` is precisely the token that lets a shared
 * intermediary hold bytes that the `killed_at` kill switch must be able to
 * reach. `force-dynamic` governs Next's ROUTE cache, not the emitted header,
 * so the override rides in the response options — which is also why no
 * `next.config.ts` header rule is added (`next-config.test.ts` asserts
 * `headers()` returns exactly one).
 */
const CARD_HEADERS = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
} as const;

/**
 * There is no page to render a not-found boundary into, so: a bare 404 — and
 * it carries `CARD_HEADERS` for a stronger reason than the 200 does (step-6
 * finding K2).
 *
 * The doc block above argues that "a 404 on this surface is negative-cached
 * by social scrapers for days". A refusal is exactly the response whose truth
 * flips at São Paulo midnight: `/termo/opengraph-image` 404s until the day is
 * published and renders the moment it is, and `/arquivo/<amanhã>/…` 404s
 * today and is a real card tomorrow. Shipping that with NO cache-control left
 * it to whatever the platform defaults to, on the one arm where a stale copy
 * outlives its truth by a day rather than by a revalidation. `killed_at` is
 * the other direction of the same argument and it is why the 200 path carries
 * the header; the 404 needs it at least as much.
 */
const refuse = (): Response =>
  new Response(null, { status: 404, headers: CARD_HEADERS });

export async function archiveCardHandler(
  game: ProjectedGame,
  segment: string,
): Promise<Response> {
  const date = parseArchiveDate(segment);
  if (date === undefined) {
    return refuse(); // Zod before any read: a hostile segment costs nothing.
  }

  let daily;
  try {
    daily = await getPublishedDaily(getDb(), game, date);
  } catch (error) {
    if (!isBadRow(error)) {
      throw error;
    }
    console.error(`og archive card: unreadable row for ${game} ${date}`, error);
    return refuse();
  }
  if (daily === undefined) {
    return refuse(); // future, unpublished, killed, or no such day
  }

  // OUTSIDE the try, and `T-WEB-S203` row (6) pins that: a satori or
  // `ImageResponse` throw must surface as a 500, never be converted into a
  // silent 404 by a `try` some later edit widened to the whole handler.
  return new ImageResponse(gameCard({ game, longDate: formatLongDate(date) }), {
    ...SIZE,
    fonts: FONTS,
    headers: CARD_HEADERS,
  });
}

/**
 * `/cartao/<YYYY-MM-DD>` — the card for `/arquivo/<data>` (#104, ADR-0071).
 *
 * The display line is the day and month and the caption carries the year,
 * which is a MEASUREMENT and not a preference: see `archiveCard`'s doc block
 * for the rung ladder and the 1111px that failed it. Both strings are
 * composed from the URL's own date, never from the row — the read decides
 * only *render or 404*.
 */
export async function archiveDayCardHandler(
  segment: string,
): Promise<Response> {
  const date = parseArchiveDate(segment);
  if (date === undefined) {
    return refuse(); // Zod before any read: a hostile segment costs nothing.
  }

  const days = await listArchivedDays(getDb(), {
    from: date,
    to: date,
    limit: 1,
  });
  if (days.length === 0) {
    // Future, unpublished, killed, no such day — and TODAY, which the
    // archive wall excludes by definition (`archivedWallPredicate`).
    return refuse();
  }

  return new ImageResponse(
    archiveCard({
      display: formatDayAndMonth(date),
      caption: ogCopy.archiveDayCaption(date.slice(0, 4)),
    }),
    { ...SIZE, fonts: FONTS, headers: CARD_HEADERS },
  );
}

/**
 * `/cartao/mes/<YYYY-MM>` — the card for `/arquivo/mes/<mês>`. The same shape
 * over the month's own day bounds, which is the same read its page makes.
 */
export async function archiveMonthCardHandler(
  segment: string,
): Promise<Response> {
  const month = parseArchiveMonth(segment);
  if (month === undefined) {
    return refuse();
  }

  const days = await listArchivedDays(getDb(), {
    ...monthDayBounds(month),
    limit: 1,
  });
  if (days.length === 0) {
    return refuse();
  }

  return new ImageResponse(
    archiveCard({
      display: formatMonth(`${month}-01`),
      caption: messages.archive.title,
    }),
    { ...SIZE, fonts: FONTS, headers: CARD_HEADERS },
  );
}

export async function dailyCardHandler(game: ProjectedGame): Promise<Response> {
  let daily;
  try {
    daily = await getTodayDaily(getDb(), game);
  } catch (error) {
    if (!isBadRow(error)) {
      throw error;
    }
    // GAME ONLY, AND THAT IS NOT AN OVERSIGHT. There is no date in scope
    // here: this handler never parses one, and the date it would log lives on
    // the row `getTodayDaily` threw instead of returning. Naming the reader is
    // what makes the line actionable — "today" is implicit in it.
    console.error(`og daily card: unreadable today row for ${game}`, error);
    return refuse();
  }
  if (daily === undefined) {
    return refuse(); // nothing published for today
  }

  return new ImageResponse(
    // From the DB clock's OWN row, never from `new Date()`.
    gameCard({ game, longDate: formatLongDate(daily.date) }),
    { ...SIZE, fonts: FONTS, headers: CARD_HEADERS },
  );
}
