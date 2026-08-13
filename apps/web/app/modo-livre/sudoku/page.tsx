import { SudokuFreeScreen } from "../../../src/free-play/sudoku-free-screen";

/**
 * Free-play Sudoku (#28, ADR-0046). STATIC by design — no `dynamic`
 * export, no db import, no fetch: the puzzle is generated in the browser
 * from a client-picked seed (ADR-0011). The pre-hydration HTML is the
 * generating skeleton with its `data-play-state` marker.
 */
export default function FreePlaySudokuPage() {
  return <SudokuFreeScreen />;
}
