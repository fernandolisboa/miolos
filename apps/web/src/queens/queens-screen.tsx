"use client";

import type { DailyQueensResponse } from "@miolos/core";
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
import { useQueensPlay } from "./use-queens-play";

export function QueensScreen({
  daily,
}: {
  readonly daily: DailyQueensResponse;
}) {
  const claim = useServerDayClaim(daily.date, "queens");
  const play = useQueensPlay(daily, claim !== undefined);

  useEffect(() => {
    preloadConclusionView();
  }, []);

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton
        date={daily.date}
        size={daily.size}
        regions={daily.regions}
      />
    );
  }

  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    return (
      <ConclusionView
        game="queens"
        date={daily.date}
        copy={messages.games.queens.conclusion}
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
        game="queens"
        date={daily.date}
        copy={messages.games.queens.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
