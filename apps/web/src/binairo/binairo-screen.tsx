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

export function BinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  const claim = useServerDayClaim(daily.date, "binairo");
  const play = useBinairoPlay(daily, claim !== undefined);

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
