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

/**
 * The archived Nonogram at its own URL (#31, ADR-0053 decisions 1 and 9).
 *
 * It composes the shipped `useNonogramPlay` hook with the shipped
 * `PlayView`/`PlaySkeleton` and **never imports `NonogramScreen`**.
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
export function ArchiveNonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const play = useNonogramPlay(daily);
  const alreadyConcluded = usePriorConclusion("nonogram", daily.date);
  const archive = archiveChrome(daily.date);

  // The clues did not solve to an exact bitmap, so the board could never
  // close. Unreachable for a published daily (ADR-0021 decision 3 makes
  // line-solvability a mechanical gate), and an unreachable branch still has
  // to be defined. It sits BELOW the hook by the rules of hooks, which is
  // also what keeps the record restore and the queue flush running here.
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
