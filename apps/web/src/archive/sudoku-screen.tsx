"use client";

import type { DailySudokuResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../sudoku/play-view";
import { useSudokuPlay } from "../sudoku/use-sudoku-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveSudokuScreen({
  daily,
}: {
  readonly daily: DailySudokuResponse;
}) {
  const play = useSudokuPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="sudoku"
      state={play.state}
      skeleton={
        <PlaySkeleton date={daily.date} tier={daily.tier} archive={archive} />
      }
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
