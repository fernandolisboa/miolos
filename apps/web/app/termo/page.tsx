import type { Metadata } from "next";

import { dailyMetadata, dailyPage } from "../../src/play/daily-route";
import { TermoScreen } from "../../src/termo/termo-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("termo");

export default async function TermoPage() {
  return dailyPage("termo", (daily) => <TermoScreen daily={daily} />);
}
