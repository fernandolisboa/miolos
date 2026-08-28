import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { TermoConclusion } from "../../../src/termo/termo-conclusion";

export const dynamic = "force-dynamic";

export default async function TermoConclusionPage() {
  const daily = await getTodayDaily(getDb(), "termo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }
  return <TermoConclusion date={daily.date} />;
}
