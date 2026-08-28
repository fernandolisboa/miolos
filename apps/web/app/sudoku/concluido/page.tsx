import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";

export const dynamic = "force-dynamic";

export default async function SudokuConclusionPage() {
  const daily = await getTodayDaily(getDb(), "sudoku");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />;
  }
  return (
    <ConclusionView
      game="sudoku"
      date={daily.date}
      copy={messages.games.sudoku.conclusion}
    />
  );
}
