"use client";

import type { DailyCrosswordResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../crossword/play-view";
import { useCrosswordPlay } from "../crossword/use-crossword-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveCrosswordScreen({
  daily,
}: {
  readonly daily: DailyCrosswordResponse;
}) {
  const play = useCrosswordPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="crossword"
      state={play.state}
      skeleton={<PlaySkeleton date={daily.date} archive={archive} />}
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
