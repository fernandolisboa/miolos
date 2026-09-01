import { NonogramConclusion } from "../../../src/nonogram/nonogram-conclusion";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function NonogramConclusionPage() {
  return dailyPage("nonogram", (daily) => (
    <NonogramConclusion date={daily.date} />
  ));
}
