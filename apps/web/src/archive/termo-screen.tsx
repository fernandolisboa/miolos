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

/**
 * The archived Termo at its own URL (#31, ADR-0053 decisions 1 and 9).
 *
 * It composes the shipped `useTermoPlay` hook with the shipped
 * `PlayView`/`PlaySkeleton` and **never imports `TermoScreen`**.
 */
export function ArchiveTermoScreen({
  daily,
}: {
  readonly daily: DailyTermoResponse;
}) {
  const play = useTermoPlay(daily);
  const alreadyConcluded = usePriorConclusion("termo", daily.date);
  const archive = archiveChrome(daily.date);

  // The server told us this day is gone (a 404 from the guess route), so the
  // board can never be judged again. After #31 the reachable causes are a
  // killed row, an unpublished date and a never-published one — the write
  // window's lower bound is gone (ADR-0053 decision 5), so "too old" is no
  // longer among them.
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
