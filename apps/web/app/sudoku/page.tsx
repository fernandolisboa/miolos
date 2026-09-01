import type { Metadata } from "next";

import { dailyMetadata, dailyPage } from "../../src/play/daily-route";
import { SudokuScreen } from "../../src/sudoku/sudoku-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = dailyMetadata("sudoku");

export default async function SudokuPage() {
  return dailyPage("sudoku", (daily) => <SudokuScreen daily={daily} />);
}
