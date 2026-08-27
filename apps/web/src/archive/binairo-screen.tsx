"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { PlaySkeleton, PlayView } from "../binairo/play-view";
import { useBinairoPlay } from "../binairo/use-binairo-play";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

/**
 * The archived Binairo at its own URL (#31, ADR-0053 decisions 1 and 9).
 *
 * It composes the shipped `useBinairoPlay` hook with the shipped
 * `PlayView`/`PlaySkeleton` and **never imports `BinairoScreen`**.
 */
export function ArchiveBinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  const play = useBinairoPlay(daily);
  const alreadyConcluded = usePriorConclusion("binairo", daily.date);
  const archive = archiveChrome(daily.date);

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} archive={archive} />;
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="binairo"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
