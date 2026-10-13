"use client";

import type { DailyNonogramResponse } from "@miolos/core";

import { PlaySkeleton, PlayView } from "../nonogram/play-view";
import { useNonogramPlay } from "../nonogram/use-nonogram-play";
import { ArchiveScreen } from "./archive-screen";
import { archiveChrome } from "./chrome";

export function ArchiveNonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const play = useNonogramPlay(daily);
  const archive = archiveChrome(daily.date);

  return (
    <ArchiveScreen
      game="nonogram"
      state={play.state}
      unavailable={play.state.solution === null}
      skeleton={
        <PlaySkeleton
          date={daily.date}
          size={daily.size}
          clues={daily.clues}
          archive={archive}
        />
      }
      view={<PlayView play={play} archive={archive} />}
    />
  );
}
