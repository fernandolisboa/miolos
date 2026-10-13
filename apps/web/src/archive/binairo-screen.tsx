"use client";

import type { DailyBinairoResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../binairo/play-view";
import { useBinairoPlay } from "../binairo/use-binairo-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveBinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  const play = useBinairoPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="binairo"
      state={play.state}
      skeleton={<PlaySkeleton date={daily.date} archive={archive} />}
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
