import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function QueensConclusionPage() {
  return dailyPage("queens", (daily) => (
    <ConclusionView
      game="queens"
      date={daily.date}
      copy={messages.games.queens.conclusion}
    />
  ));
}
