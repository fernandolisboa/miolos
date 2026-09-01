import type { DailyPuzzleResponse, ProjectedGame } from "@miolos/core";
import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { getDb } from "../db";
import { messages } from "../i18n";
import { ogCopy } from "../og/copy";
import { OG_DEFAULTS } from "../og/defaults";

export function dailyMetadata(game: ProjectedGame): Metadata {
  return {
    openGraph: {
      ...OG_DEFAULTS,
      title: ogCopy.dailyTitle(messages.games[game].name),
      description: ogCopy.dailyDescription(messages.games[game].name),
    },
  };
}

export async function dailyPage<G extends ProjectedGame>(
  game: G,
  render: (daily: Extract<DailyPuzzleResponse, { game: G }>) => ReactNode,
): Promise<ReactNode> {
  const daily = await getTodayDaily(getDb(), game);
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games[game].play.unavailable} />;
  }
  return render(daily);
}
