import { getTodayDaily } from "@miolos/db";

import { DailyUnavailable } from "../../../src/components/daily-unavailable";
import { getDb } from "../../../src/db";
import { messages } from "../../../src/i18n";
import { NonogramConclusion } from "../../../src/nonogram/nonogram-conclusion";

export const dynamic = "force-dynamic";

export default async function NonogramConclusionPage() {
  const daily = await getTodayDaily(getDb(), "nonogram");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }
  return <NonogramConclusion date={daily.date} />;
}
