"use client";

import type { DailyTermoResponse } from "@miolos/core";

import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { elapsedMs } from "../play/timer";
import { PlaySkeleton, PlayView } from "./play-view";
import { useTermoPlay } from "./use-termo-play";

const TermoConclusion = resilientConclusion<
  Parameters<typeof import("./termo-conclusion").TermoConclusion>[0]
>(
  async () => (await import("./termo-conclusion")).TermoConclusion,
  () => <ConclusionChunkFallback copy={messages.games.termo.conclusion} />,
);

function preloadTermoConclusion(): void {
  void import("./termo-conclusion").catch(() => undefined);
}

export function TermoScreen({ daily }: { readonly daily: DailyTermoResponse }) {
  const claim = useServerDayClaim(daily.date, "termo");
  const play = useTermoPlay(daily, claim !== undefined);
  const { state } = play;

  return (
    <DailyScreen
      game="termo"
      claim={claim}
      state={state}
      unavailable={play.unavailable}
      conclusion={{
        render: () => (
          <TermoConclusion
            date={daily.date}
            result={{
              elapsedMs: elapsedMs(state.timer, state.now),
              hintsUsed: 0,
            }}
            live={
              state.answer === undefined
                ? undefined
                : {
                    won: state.status === "solved",
                    used: state.guesses.length,
                    canonical: state.answer,
                  }
            }
          />
        ),
        preload: preloadTermoConclusion,
      }}
      skeleton={<PlaySkeleton date={daily.date} />}
      view={<PlayView play={play} />}
    />
  );
}
