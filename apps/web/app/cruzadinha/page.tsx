import type { Metadata } from "next";

import { FetchedFreeHints } from "../../src/api/free-hints-provider";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";
import { CrosswordScreen } from "../../src/crossword/crossword-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("crossword");

export default async function CruzadinhaPage() {
  return dailyPage("crossword", (daily) => (
    <FetchedFreeHints>
      <CrosswordScreen daily={daily} />
    </FetchedFreeHints>
  ));
}
