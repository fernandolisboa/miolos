import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function CrosswordConclusionPage() {
  return dailyPage("crossword", (daily) => (
    <ConclusionView
      game="crossword"
      date={daily.date}
      copy={messages.games.crossword.conclusion}
    />
  ));
}
