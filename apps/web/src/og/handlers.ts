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

const PROJECTION_ERROR_NAMES = new Set([
  "ZodError",
  "DailyProjectionUnsupportedError",
]);

function isBadRow(error: unknown): boolean {
  return error instanceof Error && PROJECTION_ERROR_NAMES.has(error.name);
}

const SIZE = { width: CARD_WIDTH, height: CARD_HEIGHT };

const CARD_HEADERS = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
} as const;

const refuse = (): Response =>
  new Response(null, { status: 404, headers: CARD_HEADERS });

export async function archiveGameCardHandler(
  game: ProjectedGame,
  segment: string,
): Promise<Response> {
  const date = parseArchiveDate(segment);
  if (date === undefined) {
    return refuse();
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
    return refuse();
  }

  return new ImageResponse(gameCard({ game, longDate: formatLongDate(date) }), {
    ...SIZE,
    fonts: FONTS,
    headers: CARD_HEADERS,
  });
}

export async function archiveDayCardHandler(
  segment: string,
): Promise<Response> {
  const date = parseArchiveDate(segment);
  if (date === undefined) {
    return refuse();
  }

  const days = await listArchivedDays(getDb(), {
    from: date,
    to: date,
    limit: 1,
  });
  if (days.length === 0) {
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
    console.error(`og daily card: unreadable today row for ${game}`, error);
    return refuse();
  }
  if (daily === undefined) {
    return refuse();
  }

  return new ImageResponse(
    gameCard({ game, longDate: formatLongDate(daily.date) }),
    { ...SIZE, fonts: FONTS, headers: CARD_HEADERS },
  );
}
