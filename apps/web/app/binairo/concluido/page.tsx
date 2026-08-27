import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { ConclusionView } from "../../../src/play/conclusion-view";

export const dynamic = "force-dynamic";

export default async function BinairoConclusionPage() {
  const daily = await getTodayDaily(getDb(), "binairo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.binairo.play.unavailable} />;
  }
  return (
    <ConclusionView
      game="binairo"
      date={daily.date}
      copy={messages.games.binairo.conclusion}
    />
  );
}
