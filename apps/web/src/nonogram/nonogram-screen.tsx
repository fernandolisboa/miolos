"use client";

import type { DailyNonogramResponse } from "@miolos/core";

import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { submittedCells } from "./engine";
import { PlaySkeleton, PlayView } from "./play-view";
import { useNonogramPlay } from "./use-nonogram-play";

const NonogramConclusion = resilientConclusion<
  Parameters<typeof import("./nonogram-conclusion").NonogramConclusion>[0]
>(
  async () => (await import("./nonogram-conclusion")).NonogramConclusion,
  (props) => (
    <ConclusionChunkFallback
      copy={messages.games.nonogram.conclusion}
      stamp={props.result}
    />
  ),
);

function preloadNonogramConclusion(): void {
  void import("./nonogram-conclusion").catch(() => undefined);
}

export function NonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const claim = useServerDayClaim(daily.date, "nonogram");
  const play = useNonogramPlay(daily, claim !== undefined);
  const { state } = play;

  return (
    <DailyScreen
      game="nonogram"
      claim={claim}
      state={state}
      unavailable={state.solution === null}
      conclusion={{
        render: () => {
          const cells = submittedCells(state.entries, state.size ** 2);
          return (
            <NonogramConclusion
              date={daily.date}
              result={{
                elapsedMs: play.elapsed,
                hintsUsed: state.hint.used,
              }}
              picture={
                cells === null
                  ? undefined
                  : {
                      size: state.size,
                      cells: [...cells],
                      label: messages.games.nonogram.reveal.aria,
                    }
              }
            />
          );
        },
        preload: preloadNonogramConclusion,
      }}
      skeleton={
        <PlaySkeleton date={daily.date} size={daily.size} clues={daily.clues} />
      }
      view={<PlayView play={play} />}
    />
  );
}
