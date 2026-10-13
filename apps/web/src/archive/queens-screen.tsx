"use client";

import type { DailyQueensResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../queens/play-view";
import { useQueensPlay } from "../queens/use-queens-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveQueensScreen({
  daily,
}: {
  readonly daily: DailyQueensResponse;
}) {
  const play = useQueensPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="queens"
      state={play.state}
      skeleton={
        <PlaySkeleton
          date={daily.date}
          size={daily.size}
          regions={daily.regions}
          archive={archive}
        />
      }
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
