import type { Metadata } from "next";

import { MinesweeperFreeScreen } from "../../../src/free-play/minesweeper-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayMinesweeper },
};

export default function FreePlayMinesweeperPage() {
  return <MinesweeperFreeScreen />;
}
