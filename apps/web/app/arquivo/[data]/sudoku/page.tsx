import type { Metadata } from "next";

import { FetchedFreeHints } from "../../../../src/api/free-hints-provider";
import { ArchiveSudokuScreen } from "../../../../src/archive/sudoku-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("sudoku", props);
}

export default async function ArchiveSudokuPage(props: ArchiveGameParams) {
  return archiveGamePage("sudoku", props, (daily) => (
    <FetchedFreeHints>
      <ArchiveSudokuScreen daily={daily} />
    </FetchedFreeHints>
  ));
}
