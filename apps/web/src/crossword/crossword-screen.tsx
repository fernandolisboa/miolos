"use client";

import type { DailyCrosswordResponse } from "@miolos/core";
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
import { useCrosswordPlay } from "./use-crossword-play";

export function CrosswordScreen({
  daily,
}: {
  readonly daily: DailyCrosswordResponse;
}) {
  const claim = useServerDayClaim(daily.date, "crossword");
  const play = useCrosswordPlay(daily, claim !== undefined);

  useEffect(() => {
    preloadConclusionView();
  }, []);

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    return (
      <ConclusionView
        game="crossword"
        date={daily.date}
        copy={messages.games.crossword.conclusion}
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
        game="crossword"
        date={daily.date}
        copy={messages.games.crossword.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
