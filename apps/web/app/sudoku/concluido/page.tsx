import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function SudokuConclusionPage() {
  return dailyPage("sudoku", (daily) => (
    <ConclusionView
      game="sudoku"
      date={daily.date}
      copy={messages.games.sudoku.conclusion}
    />
  ));
}
