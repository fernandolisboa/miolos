"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { PlaySkeleton, PlayView } from "../sudoku/play-view";
import { useSudokuPlay } from "../sudoku/use-sudoku-play";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveSudokuScreen({
  daily,
}: {
  readonly daily: DailySudokuResponse;
}) {
  const play = useSudokuPlay(daily);
  const alreadyConcluded = usePriorConclusion("sudoku", daily.date);
  const archive = archiveChrome(daily.date);

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton date={daily.date} tier={daily.tier} archive={archive} />
    );
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="sudoku"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
