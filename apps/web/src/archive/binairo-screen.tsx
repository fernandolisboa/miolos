"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { PlaySkeleton, PlayView } from "../binairo/play-view";
import { useBinairoPlay } from "../binairo/use-binairo-play";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

/**
 * The archived Binairo at its own URL (#31, ADR-0053 decisions 1 and 9).
 *
 * It composes the shipped `useBinairoPlay` hook with the shipped
 * `PlayView`/`PlaySkeleton` and **never imports `BinairoScreen`**. That is not
 * a style preference: all four screen roots hard-render a conclusion
 * component, and `conclusion-view.tsx` calls `useDayState(date)` — so
 * composing the root would fire the streak card's `GET /streak` and chain
 * `nextPendingDaily` to TODAY's routes on an archived date. T-WEB-S183 makes
 * the exclusion a module-graph assertion rather than prose.
 *
 * What it copies from the root is the GATE, not the comment:
 *
 * - the hydration gate, because everything the board, the clock and the hint
 *   button show is derived from the record and the record cannot be read
 *   before the mount effect — painting first renders a day the player
 *   already finished as an empty board with a live hint button;
 * - close detection on **both** conditions, because the clock is frozen one
 *   commit after the board closes and swapping early would stamp a time the
 *   pause is about to correct. `status !== "playing"` rather than
 *   `=== "solved"`, exactly as `use-play-lifecycle.ts` computes it, so a lost
 *   board closes here too.
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

  if (
    play.state.status !== "playing" &&
    play.state.timer.runningSince === null
  ) {
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
