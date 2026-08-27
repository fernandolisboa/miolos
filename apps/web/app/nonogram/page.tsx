import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { NonogramScreen } from "../../src/nonogram/nonogram-screen";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.nonogram.name),
    description: ogCopy.dailyDescription(messages.games.nonogram.name),
  },
};

export default async function NonogramPage() {
  const daily = await getTodayDaily(getDb(), "nonogram");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }
  return <NonogramScreen daily={daily} />;
}
