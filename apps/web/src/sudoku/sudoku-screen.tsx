"use client";

import type { DailySudokuResponse } from "@miolos/core";

import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { PlaySkeleton, PlayView } from "./play-view";
import { useSudokuPlay } from "./use-sudoku-play";

export function SudokuScreen({
  daily,
}: {
  readonly daily: DailySudokuResponse;
}) {
  const claim = useServerDayClaim(daily.date, "sudoku");
  const play = useSudokuPlay(daily, claim !== undefined);

  return (
    <DailyScreen
      game="sudoku"
      claim={claim}
      state={play.state}
      result={{ elapsedMs: play.elapsed, hintsUsed: play.state.hint.used }}
      skeleton={<PlaySkeleton date={daily.date} tier={daily.tier} />}
      view={<PlayView play={play} />}
    />
  );
}
