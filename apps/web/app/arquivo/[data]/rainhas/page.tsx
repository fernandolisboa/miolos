import type { Metadata } from "next";

import { FetchedFreeHints } from "../../../../src/api/free-hints-provider";
import { ArchiveQueensScreen } from "../../../../src/archive/queens-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("queens", props);
}

export default async function ArchiveRainhasPage(props: ArchiveGameParams) {
  return archiveGamePage("queens", props, (daily) => (
    <FetchedFreeHints>
      <ArchiveQueensScreen daily={daily} />
    </FetchedFreeHints>
  ));
}
