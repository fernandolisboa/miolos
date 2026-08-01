"use client";

import type { DailyPuzzleResponse } from "@miolos/core";

import { ConclusionView } from "./conclusion-view";
import { PlaySkeleton, PlayView } from "./play-view";
import { useBinairoPlay } from "./use-binairo-play";

/**
 * The play screen's client root (plan 017 §12.2). It swaps its body from
 * `<PlayView/>` to `<ConclusionView/>` once the grid closes — no
 * navigation, no RSC fetch, so finishing offline works with no service
 * worker (D26). `/binairo/concluido` renders the same `<ConclusionView/>`
 * under its own server segment for a bookmark, a reload and
 * `impeccable detect`.
 *
 * The page shell passes the wall's solution-free projection and nothing
 * else (D4): the RSC payload physically cannot carry what this component
 * never received.
 */
export function BinairoScreen({
  daily,
}: {
  readonly daily: DailyPuzzleResponse;
}) {
  const play = useBinairoPlay(daily);

  // The record has not been read yet, so NOTHING derived from it may paint
  // (D28). Without this gate, reloading /binairo on a day the player already
  // finished renders the full play screen — their solved board wiped back to
  // its givens, 00:00 on the clock, the hint button live — until hydration
  // swaps in the conclusion (finding
  // `binairo-reload-flashes-a-blank-board-over-a-finished-day`).
  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  // Both conditions, not just `solved`: the clock is frozen one commit
  // after the grid closes, and swapping early would stamp a time the pause
  // is about to correct. A restored `concluded` record is already frozen,
  // so it lands here on its first paint (§12.3 re-entry).
  if (
    play.state.status === "solved" &&
    play.state.timer.runningSince === null
  ) {
    return (
      <ConclusionView
        date={daily.date}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}
      />
    );
  }

  return <PlayView play={play} />;
}
