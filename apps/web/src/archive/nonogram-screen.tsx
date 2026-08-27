"use client";

import type { DailyNonogramResponse } from "@miolos/core";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { PlaySkeleton, PlayView } from "../nonogram/play-view";
import { useNonogramPlay } from "../nonogram/use-nonogram-play";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveNonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const play = useNonogramPlay(daily);
  const alreadyConcluded = usePriorConclusion("nonogram", daily.date);
  const archive = archiveChrome(daily.date);

  if (play.state.solution === null) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton
        date={daily.date}
        size={daily.size}
        clues={daily.clues}
        archive={archive}
      />
    );
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="nonogram"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
