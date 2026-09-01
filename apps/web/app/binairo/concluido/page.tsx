import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function BinairoConclusionPage() {
  return dailyPage("binairo", (daily) => (
    <ConclusionView
      game="binairo"
      date={daily.date}
      copy={messages.games.binairo.conclusion}
    />
  ));
}
