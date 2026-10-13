"use client";

import type { DailyCrosswordResponse } from "@miolos/core";

import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { PlaySkeleton, PlayView } from "./play-view";
import { useCrosswordPlay } from "./use-crossword-play";

export function CrosswordScreen({
  daily,
}: {
  readonly daily: DailyCrosswordResponse;
}) {
  const claim = useServerDayClaim(daily.date, "crossword");
  const play = useCrosswordPlay(daily, claim !== undefined);

  return (
    <DailyScreen
      game="crossword"
      claim={claim}
      state={play.state}
      result={{ elapsedMs: play.elapsed, hintsUsed: play.state.hint.used }}
      skeleton={<PlaySkeleton date={daily.date} />}
      view={<PlayView play={play} />}
    />
  );
}
