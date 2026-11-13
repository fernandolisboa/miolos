import type { Metadata } from "next";

import { SudokuFreeScreen } from "../../../src/free-play/sudoku-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlaySudoku },
};

export default function FreePlaySudokuPage() {
  return <SudokuFreeScreen />;
}
