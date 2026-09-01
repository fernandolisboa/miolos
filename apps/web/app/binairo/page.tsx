import type { Metadata } from "next";

import { BinairoScreen } from "../../src/binairo/binairo-screen";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("binairo");

export default async function BinairoPage() {
  return dailyPage("binairo", (daily) => <BinairoScreen daily={daily} />);
}
