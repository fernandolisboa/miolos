"use client";

import type { DailyMinesweeperResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../minesweeper/play-view";
import { useMinesweeperPlay } from "../minesweeper/use-minesweeper-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveMinesweeperScreen({
  daily,
}: {
  readonly daily: DailyMinesweeperResponse;
}) {
  const play = useMinesweeperPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="minesweeper"
      state={play.state}
      skeleton={<PlaySkeleton date={daily.date} archive={archive} />}
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
