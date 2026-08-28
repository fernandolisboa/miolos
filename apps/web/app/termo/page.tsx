import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";
import { TermoScreen } from "../../src/termo/termo-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.termo.name),
    description: ogCopy.dailyDescription(messages.games.termo.name),
  },
};

export default async function TermoPage() {
  const daily = await getTodayDaily(getDb(), "termo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }
  return <TermoScreen daily={daily} />;
}
