import type { Metadata } from "next";

import { ArchiveCrosswordScreen } from "../../../../src/archive/crossword-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("crossword", props);
}

export default async function ArchiveCruzadinhaPage(props: ArchiveGameParams) {
  return archiveGamePage("crossword", props, (daily) => (
    <ArchiveCrosswordScreen daily={daily} />
  ));
}
