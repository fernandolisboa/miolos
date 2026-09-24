"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { useEffect } from "react";

import { messages } from "../i18n";
import {
  ConclusionView,
  preloadConclusionView,
  RemoteConclusionView,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { useSudokuPlay } from "./use-sudoku-play";

export function SudokuScreen({
  daily,
}: {
  readonly daily: DailySudokuResponse;
}) {
  const claim = useServerDayClaim(daily.date, "sudoku");
  const play = useSudokuPlay(daily, claim !== undefined);

  useEffect(() => {
    preloadConclusionView();
  }, []);

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} tier={daily.tier} />;
  }

  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    return (
      <ConclusionView
        game="sudoku"
        date={daily.date}
        copy={messages.games.sudoku.conclusion}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}
      />
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="sudoku"
        date={daily.date}
        copy={messages.games.sudoku.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
