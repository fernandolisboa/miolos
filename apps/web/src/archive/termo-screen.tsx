"use client";

import type { DailyTermoResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../termo/play-view";
import { useTermoPlay } from "../termo/use-termo-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveTermoScreen({
  daily,
}: {
  readonly daily: DailyTermoResponse;
}) {
  const play = useTermoPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="termo"
      state={play.state}
      unavailable={play.unavailable}
      skeleton={<PlaySkeleton date={daily.date} archive={archive} />}
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
