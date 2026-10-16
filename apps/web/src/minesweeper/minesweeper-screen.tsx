"use client";

import type { DailyMinesweeperResponse } from "@miolos/core";

import { messages } from "../i18n";
import {
  ConclusionChunkFallback,
  resilientConclusion,
} from "../play/conclusion-lazy";
import { DailyScreen } from "../play/daily-screen";
import { useServerDayClaim } from "../play/day-state";
import { PlaySkeleton, PlayView } from "./play-view";
import { useMinesweeperPlay } from "./use-minesweeper-play";

const {
  Conclusion: MinesweeperConclusion,
  preload: preloadMinesweeperConclusion,
} = resilientConclusion(
  async () => (await import("./minesweeper-conclusion")).MinesweeperConclusion,
  (props) => (
    <ConclusionChunkFallback
      copy={messages.games.minesweeper.conclusion}
      stamp={props.live?.status === "lost" ? undefined : props.result}
    />
  ),
);

export function MinesweeperScreen({
  daily,
}: {
  readonly daily: DailyMinesweeperResponse;
}) {
  const claim = useServerDayClaim(daily.date, "minesweeper");
  const play = useMinesweeperPlay(daily, claim !== undefined);

  return (
    <DailyScreen
      game="minesweeper"
      claim={claim}
      state={play.state}
      conclusion={{
        render: () => (
          <MinesweeperConclusion
            daily={daily}
            result={{ elapsedMs: play.elapsed, hintsUsed: 0 }}
            live={play.state.game}
          />
        ),
        preload: preloadMinesweeperConclusion,
      }}
      skeleton={<PlaySkeleton date={daily.date} />}
      view={<PlayView play={play} />}
    />
  );
}
