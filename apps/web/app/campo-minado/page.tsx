import type { Metadata } from "next";

import { MinesweeperScreen } from "../../src/minesweeper/minesweeper-screen";
import { dailyMetadata, dailyPage } from "../../src/play/daily-route";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("minesweeper");

export default async function CampoMinadoPage() {
  return dailyPage("minesweeper", (daily) => (
    <MinesweeperScreen daily={daily} />
  ));
}
