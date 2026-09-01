import type { Metadata } from "next";

import { NonogramScreen } from "../../src/nonogram/nonogram-screen";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("nonogram");

export default async function NonogramPage() {
  return dailyPage("nonogram", (daily) => <NonogramScreen daily={daily} />);
}
