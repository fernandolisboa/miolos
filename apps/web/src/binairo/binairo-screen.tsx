"use client";

import type { DailyBinairoResponse } from "@miolos/core";
import { useEffect } from "react";

import { messages } from "../i18n";
import {
  ConclusionView,
  preloadConclusionView,
  RemoteConclusionView,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { useBinairoPlay } from "./use-binairo-play";

/**
 * The play screen's client root.
 *
 * The page shell passes the wall's solution-free projection and nothing else:
 * the RSC payload physically cannot carry what this component never received.
 */
export function BinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  // The server's claim about this game (#142, ADR-0065), hoisted here — the
  // top of the root, beside the play hook — by the rules of hooks: every
  // early return below would make a later call conditional.
  const claim = useServerDayClaim(daily.date, "binairo");
  const play = useBinairoPlay(daily, claim !== undefined);

  // The claim's swap below is render-time only, so the play hook keeps running
  // behind the remote view (#142): left alone, its 1 Hz tick re-renders a
  // static conclusion once a second and the next hide-persist rewrites the
  // preserved in-progress record with an inflated `elapsedMs`. Freeze the
  // clock instead. The timer term re-arms the effect when a visibility resume
  // restarts the clock behind the view; `pause` is idempotent, and a
  // locally-closed board is unaffected (its clock is already frozen when its
  // conclusion swaps in).
  const claimOwnsScreen =
    claim !== undefined && play.state.timer.runningSince !== null;
  const pause = play.pause;
  useEffect(() => {
    if (claimOwnsScreen) {
      pause();
    }
  }, [claimOwnsScreen, pause]);

  useEffect(() => {
    preloadConclusionView();
  }, []);

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  // Closed AND frozen, through the shared predicate (#31): the clock is frozen
  // one commit after the grid closes, and swapping early would stamp a time
  // the pause is about to correct.
  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    return (
      <ConclusionView
        game="binairo"
        date={daily.date}
        copy={messages.games.binairo.conclusion}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}
      />
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="binairo"
        date={daily.date}
        copy={messages.games.binairo.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
