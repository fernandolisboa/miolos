import type { Metadata } from "next";

import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";
import { ArchiveMinesweeperScreen } from "../../../../src/archive/minesweeper-screen";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("minesweeper", props);
}

export default async function ArchiveCampoMinadoPage(props: ArchiveGameParams) {
  return archiveGamePage("minesweeper", props, (daily) => (
    <ArchiveMinesweeperScreen daily={daily} />
  ));
}
