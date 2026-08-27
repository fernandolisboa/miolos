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
 *
 * What it copies from the root is the GATE, not the comment:
 *
 * - the hydration gate, because everything the board, the clock and the hint
 *   button show is derived from the record and the record cannot be read
 *   before the mount effect — painting first renders a day the player
 *   already finished as an empty board with a live hint button;
 * - close detection through `isClosedAndFrozen`, the shared predicate
 *   `use-play-lifecycle.ts` exports (#31). Both conjuncts are required — the
 *   clock is frozen one commit after the board closes, and swapping early would
 *   stamp a time the pause is about to correct — and `status !== "playing"`
 *   rather than `=== "solved"` is what makes a lost board close here too. It is
 *   IMPORTED rather than re-typed.
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
