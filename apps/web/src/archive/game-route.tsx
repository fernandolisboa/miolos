import type { DailyPuzzleResponse, ProjectedGame } from "@miolos/core";
import { archiveDateClass, getArchivedDaily } from "@miolos/db";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getDb } from "../db";
import {
  archiveGameRoute,
  formatLongDate,
  messages,
  playRoutes,
} from "../i18n";
import { OG_DEFAULTS } from "../og/defaults";
import { parseArchiveDate } from "./parse-params";

export interface ArchiveGameParams {
  readonly params: Promise<{ readonly data: string }>;
}

export async function archiveGameMetadata(
  game: ProjectedGame,
  { params }: ArchiveGameParams,
): Promise<Metadata> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    return { robots: { index: false } };
  }
  const longDate = formatLongDate(date);
  const title = messages.archive.meta.gameTitle(
    messages.games[game].name,
    longDate,
  );
  const description = messages.archive.meta.gameDescription(
    messages.games[game].name,
    longDate,
  );
  return {
    title,
    description,
    alternates: { canonical: archiveGameRoute(date, game) },
    openGraph: { ...OG_DEFAULTS, title, description },
  };
}

export async function archiveGamePage<G extends ProjectedGame>(
  game: G,
  { params }: ArchiveGameParams,
  render: (daily: Extract<DailyPuzzleResponse, { game: G }>) => ReactNode,
): Promise<ReactNode> {
  const date = parseArchiveDate((await params).data);
  if (date === undefined) {
    notFound();
  }

  const db = getDb();
  const daily = await getArchivedDaily(db, game, date);
  if (daily === undefined) {
    const dateClass = await archiveDateClass(db, date);
    if (dateClass === "today") {
      redirect(playRoutes[game]);
    }
    notFound();
  }

  return render(daily);
}
