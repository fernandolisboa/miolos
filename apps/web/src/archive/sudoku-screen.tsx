"use client";

import type { DailySudokuResponse } from "@miolos/core";
import { PlaySkeleton, PlayView } from "../sudoku/play-view";
import { useSudokuPlay } from "../sudoku/use-sudoku-play";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { archiveChrome } from "./chrome";
import { LateResult } from "./late-result";
import { usePriorConclusion } from "./use-prior-conclusion";

/**
 * The archived Sudoku at its own URL (#31, ADR-0053 decisions 1 and 9).
 *
 * It composes the shipped `useSudokuPlay` hook with the shipped
 * `PlayView`/`PlaySkeleton` and **never imports `SudokuScreen`**. That is not
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
 * - close detection through `isClosedAndFrozen`, the shared predicate
 *   `use-play-lifecycle.ts` exports (#31 step-6 F15). Both conjuncts are
 *   required — the clock is frozen one commit after the board closes, and
 *   swapping early would stamp a time the pause is about to correct — and
 *   `status !== "playing"` rather than `=== "solved"` is what makes a lost
 *   board close here too. It is IMPORTED rather than re-typed: nine hand
 *   copies of one predicate were the finding.
 */
export function ArchiveSudokuScreen({
  daily,
}: {
  readonly daily: DailySudokuResponse;
}) {
  const play = useSudokuPlay(daily);
  const alreadyConcluded = usePriorConclusion("sudoku", daily.date);
  const archive = archiveChrome(daily.date);

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton date={daily.date} tier={daily.tier} archive={archive} />
    );
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <LateResult
        game="sudoku"
        date={daily.date}
        outcome={play.state.status === "solved" ? "won" : "lost"}
        alreadyConcluded={alreadyConcluded}
      />
    );
  }

  return <PlayView play={play} archive={archive} />;
}
