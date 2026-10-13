import type { Metadata } from "next";

import { FetchedFreeHints } from "../../src/api/free-hints-provider";
import { BinairoScreen } from "../../src/binairo/binairo-screen";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("binairo");

export default async function BinairoPage() {
  return dailyPage("binairo", (daily) => (
    <FetchedFreeHints>
      <BinairoScreen daily={daily} />
    </FetchedFreeHints>
  ));
}
