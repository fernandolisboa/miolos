import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";
import { SudokuScreen } from "../../src/sudoku/sudoku-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.sudoku.name),
    description: ogCopy.dailyDescription(messages.games.sudoku.name),
  },
};

export default async function SudokuPage() {
  const daily = await getTodayDaily(getDb(), "sudoku");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />;
  }
  return <SudokuScreen daily={daily} />;
}
