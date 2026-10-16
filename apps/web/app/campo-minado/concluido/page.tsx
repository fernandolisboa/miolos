import { MinesweeperConclusion } from "../../../src/minesweeper/minesweeper-conclusion";
import { dailyPage } from "../../../src/play/daily-route";

export const dynamic = "force-dynamic";

export default async function MinesweeperConclusionPage() {
  return dailyPage("minesweeper", (daily) => (
    <MinesweeperConclusion daily={daily} />
  ));
}
