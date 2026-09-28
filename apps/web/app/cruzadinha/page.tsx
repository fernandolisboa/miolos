import type { Metadata } from "next";

import { dailyMetadata, dailyPage } from "../../src/play/daily-route";
import { CrosswordScreen } from "../../src/crossword/crossword-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("crossword");

export default async function CruzadinhaPage() {
  return dailyPage("crossword", (daily) => <CrosswordScreen daily={daily} />);
}
