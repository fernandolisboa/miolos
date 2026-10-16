"use client";

import type { DailyMinesweeperResponse } from "@miolos/core";
import type { MinesweeperState } from "@miolos/games/minesweeper";

import { messages } from "../i18n";
import { ConclusionView, type ConclusionResult } from "../play/conclusion-view";
import { useRecordSnapshot } from "../play/use-record-snapshot";
import { initMinesweeperDaily, minesweeperDailyReducer } from "./daily-state";
import { FinishedMinefield } from "./minefield";
import minefield from "./minefield.module.css";

const copy = messages.games.minesweeper.conclusion;

export function MinesweeperConclusion({
  daily,
  result,
  live,
}: {
  readonly daily: DailyMinesweeperResponse;
  readonly result?: ConclusionResult;
  readonly live?: MinesweeperState;
}) {
  const snapshot = useRecordSnapshot("minesweeper", daily.date);
  const stored = snapshot.hydrated ? snapshot.record : undefined;
  const fromRecord =
    stored?.game === "minesweeper" && stored.concluded
      ? minesweeperDailyReducer(initMinesweeperDaily(daily), {
          type: "restore",
          record: stored,
          now: 0,
        }).game
      : undefined;
  const game = fromRecord ?? live;

  return (
    <ConclusionView
      game="minesweeper"
      date={daily.date}
      copy={copy}
      result={result}
      outcome={game?.status === "lost" ? copy.played : undefined}
      figure={
        game === undefined ? undefined : (
          <div className={minefield.conclusionField}>
            <FinishedMinefield game={game} sizeClass={minefield.daily} />
          </div>
        )
      }
    />
  );
}
