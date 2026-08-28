import { getTodayDaily } from "@miolos/db";
import type { Metadata } from "next";

import { BinairoScreen } from "../../src/binairo/binairo-screen";
import { DailyUnavailable } from "../../src/components/daily-unavailable";
import { getDb } from "../../src/db";
import { messages } from "../../src/i18n";
import { ogCopy } from "../../src/og/copy";
import { OG_DEFAULTS } from "../../src/og/defaults";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  openGraph: {
    ...OG_DEFAULTS,
    title: ogCopy.dailyTitle(messages.games.binairo.name),
    description: ogCopy.dailyDescription(messages.games.binairo.name),
  },
};

export default async function BinairoPage() {
  const daily = await getTodayDaily(getDb(), "binairo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.binairo.play.unavailable} />;
  }
  return <BinairoScreen daily={daily} />;
}
