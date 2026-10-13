"use client";

import type { DailyBinairoResponse } from "@miolos/core";

import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { PlaySkeleton, PlayView } from "./play-view";
import { useBinairoPlay } from "./use-binairo-play";

export function BinairoScreen({
  daily,
}: {
  readonly daily: DailyBinairoResponse;
}) {
  const claim = useServerDayClaim(daily.date, "binairo");
  const play = useBinairoPlay(daily, claim !== undefined);

  return (
    <DailyScreen
      game="binairo"
      claim={claim}
      state={play.state}
      result={{ elapsedMs: play.elapsed, hintsUsed: play.state.hint.used }}
      skeleton={<PlaySkeleton date={daily.date} />}
      view={<PlayView play={play} />}
    />
  );
}
