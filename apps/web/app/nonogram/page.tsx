import type { Metadata } from "next";

import { FetchedFreeHints } from "../../src/api/free-hints-provider";
import { NonogramScreen } from "../../src/nonogram/nonogram-screen";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("nonogram");

export default async function NonogramPage() {
  return dailyPage("nonogram", (daily) => (
    <FetchedFreeHints>
      <NonogramScreen daily={daily} />
    </FetchedFreeHints>
  ));
}
