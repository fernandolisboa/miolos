"use client";

import type { DailyTermoResponse } from "@miolos/core";
import { useEffect } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  preloadTermoConclusion,
  RemoteConclusionView,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { elapsedMs } from "../play/timer";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
import { PlaySkeleton, PlayView } from "./play-view";
import { useTermoPlay } from "./use-termo-play";

const TermoConclusion = resilientConclusion<
  Parameters<typeof import("./termo-conclusion").TermoConclusion>[0]
>(
  async () => (await import("./termo-conclusion")).TermoConclusion,
  () => <ConclusionChunkFallback copy={messages.games.termo.conclusion} />,
);

export function TermoScreen({ daily }: { readonly daily: DailyTermoResponse }) {
  const claim = useServerDayClaim(daily.date, "termo");
  const play = useTermoPlay(daily, claim !== undefined);

  const claimOwnsScreen =
    claim !== undefined && play.state.timer.runningSince !== null;
  const pause = play.pause;
  useEffect(() => {
    if (claimOwnsScreen) {
      pause();
    }
  }, [claimOwnsScreen, pause]);

  useEffect(() => {
    preloadTermoConclusion();
  }, []);

  if (play.unavailable) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return <PlaySkeleton date={daily.date} />;
  }

  if (isClosedAndFrozen(play.state)) {
    return (
      <TermoConclusion
        date={daily.date}

        result={{
          elapsedMs: elapsedMs(play.state.timer, play.state.now),
          hintsUsed: 0,
        }}

        live={
          play.state.answer === undefined
            ? undefined
            : {
                won: play.state.status === "solved",
                used: play.state.guesses.length,
                canonical: play.state.answer,
              }
        }
      />
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="termo"
        date={daily.date}
        copy={messages.games.termo.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
