"use client";

import type { DailyQueensResponse } from "@miolos/core";

import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "../queens/play-view";
import { useQueensPlay } from "../queens/use-queens-play";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveQueensScreen({
  daily,
}: {
  readonly daily: DailyQueensResponse;
}) {
  const play = useQueensPlay(daily);
  const alreadyConcluded = usePriorConclusion("queens", daily.date);
  const archive = archiveChrome(daily.date);

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton
        date={daily.date}
        size={daily.size}
        regions={daily.regions}
        archive={archive}
      />
    );
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="queens"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
