import type { Metadata } from "next";

import { ArchiveBinairoScreen } from "../../../../src/archive/binairo-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("binairo", props);
}

export default async function ArchiveBinairoPage(props: ArchiveGameParams) {
  return archiveGamePage("binairo", props, (daily) => (
    <ArchiveBinairoScreen daily={daily} />
  ));
}
