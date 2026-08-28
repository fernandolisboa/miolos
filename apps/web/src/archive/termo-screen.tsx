"use client";

import type { DailyTermoResponse } from "@miolos/core";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import { PlaySkeleton, PlayView } from "../termo/play-view";
import { useTermoPlay } from "../termo/use-termo-play";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

export function ArchiveTermoScreen({
  daily,
}: {
  readonly daily: DailyTermoResponse;
}) {
  const play = useTermoPlay(daily);
  const alreadyConcluded = usePriorConclusion("termo", daily.date);
  const archive = archiveChrome(daily.date);

  if (play.unavailable) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} archive={archive} />;
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="termo"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
