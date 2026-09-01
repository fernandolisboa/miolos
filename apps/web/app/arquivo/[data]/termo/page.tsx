import type { Metadata } from "next";

import { ArchiveTermoScreen } from "../../../../src/archive/termo-screen";
import {
  archiveGameMetadata,
  archiveGamePage,
  type ArchiveGameParams,
} from "../../../../src/archive/game-route";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: ArchiveGameParams,
): Promise<Metadata> {
  return archiveGameMetadata("termo", props);
}

export default async function ArchiveTermoPage(props: ArchiveGameParams) {
  return archiveGamePage("termo", props, (daily) => (
    <ArchiveTermoScreen daily={daily} />
  ));
}
