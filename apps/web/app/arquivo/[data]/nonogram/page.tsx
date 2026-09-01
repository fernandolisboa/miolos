import type { Metadata } from "next";

import { ArchiveNonogramScreen } from "../../../../src/archive/nonogram-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("nonogram", props);
}

export default async function ArchiveNonogramPage(props: ArchiveGameParams) {
  return archiveGamePage("nonogram", props, (daily) => (
    <ArchiveNonogramScreen daily={daily} />
  ));
}
