import { dailyPage } from "../../../src/play/daily-route";
import { TermoConclusion } from "../../../src/termo/termo-conclusion";

export const dynamic = "force-dynamic";

export default async function TermoConclusionPage() {
  return dailyPage("termo", (daily) => <TermoConclusion date={daily.date} />);
}
