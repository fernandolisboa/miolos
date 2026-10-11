import type { Metadata } from "next";

import { dailyMetadata, dailyPage } from "../../src/play/daily-route";
import { QueensScreen } from "../../src/queens/queens-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("queens");

export default async function RainhasPage() {
  return dailyPage("queens", (daily) => <QueensScreen daily={daily} />);
}
