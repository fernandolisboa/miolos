"use client";

import type { DailyCrosswordResponse } from "@miolos/core";

import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "../crossword/play-view";
import { useCrosswordPlay } from "../crossword/use-crossword-play";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveCrosswordScreen({
  daily,
}: {
  readonly daily: DailyCrosswordResponse;
}) {
  const play = useCrosswordPlay(daily);
  const alreadyConcluded = usePriorConclusion("crossword", daily.date);
  const archive = archiveChrome(daily.date);

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} archive={archive} />;
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="crossword"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
