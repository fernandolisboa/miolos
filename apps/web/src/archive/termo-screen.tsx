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
 * `PlayView`/`PlaySkeleton` and **never imports `TermoScreen`**. That is not
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
