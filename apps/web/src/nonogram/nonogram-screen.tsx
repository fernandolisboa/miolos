"use client";

import type { DailyNonogramResponse } from "@miolos/core";
import { useEffect } from "react";

import { DailyUnavailable } from "../components/daily-unavailable";
import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  preloadNonogramConclusion,
  RemoteConclusionView,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { useServerDayClaim } from "../play/day-state";
import { isClosedAndFrozen } from "../play/use-play-lifecycle";
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

export function NonogramScreen({
  daily,
}: {
  readonly daily: DailyNonogramResponse;
}) {
  const claim = useServerDayClaim(daily.date, "nonogram");
  const play = useNonogramPlay(daily, claim !== undefined);

  useEffect(() => {
    preloadNonogramConclusion();
  }, []);

  if (play.state.solution === null) {
    return <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />;
  }

  if (!play.state.hydrated) {
    return (
      <PlaySkeleton date={daily.date} size={daily.size} clues={daily.clues} />
    );
  }

  if (isClosedAndFrozen(play.state) && play.state.status === "solved") {
    const cells = submittedCells(play.state.entries, play.state.size ** 2);
    return (
      <NonogramConclusion
        date={daily.date}
        result={{
          elapsedMs: play.elapsed,
          hintsUsed: play.state.hint.used,
        }}

        picture={
          cells === null
            ? undefined
            : {
                size: play.state.size,
                cells: [...cells],
                label: messages.games.nonogram.reveal.aria,
              }
        }
      />
    );
  }

  if (claim !== undefined) {
    return (
      <RemoteConclusionView
        game="nonogram"
        date={daily.date}
        copy={messages.games.nonogram.conclusion}
        claim={claim}
      />
    );
  }

  return <PlayView play={play} />;
}
