"use client";

import type { DailyQueensResponse } from "@miolos/core";

import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { PlaySkeleton, PlayView } from "./play-view";
import { useQueensPlay } from "./use-queens-play";

export function QueensScreen({
  daily,
}: {
  readonly daily: DailyQueensResponse;
}) {
  const claim = useServerDayClaim(daily.date, "queens");
  const play = useQueensPlay(daily, claim !== undefined);

  return (
    <DailyScreen
      game="queens"
      claim={claim}
      state={play.state}
      result={{ elapsedMs: play.elapsed, hintsUsed: play.state.hint.used }}
      skeleton={
        <PlaySkeleton
          date={daily.date}
          size={daily.size}
          regions={daily.regions}
        />
      }
      view={<PlayView play={play} />}
    />
  );
}
