"use client";

import type { DailyMinesweeperResponse } from "@miolos/core";
import type { MinesweeperState } from "@miolos/games/minesweeper";
import { useMemo } from "react";

import { messages } from "../i18n";
import { ConclusionView } from "../play/conclusion-view";
import type { ConclusionResult } from "../play/types";
import { useRecordSnapshot } from "../play/use-record-snapshot";
import { gameOfRecord, startedGame } from "./daily-record";
import { FinishedMinefield } from "./finished-minefield";
import minefield from "./minefield.module.css";

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
  const fromRecord = useMemo(
    () =>
      stored?.game === "minesweeper" && stored.concluded
        ? gameOfRecord(startedGame(daily), stored)
        : undefined,
    [daily, stored],
  );
  const game = fromRecord ?? live;

  return (
    <ConclusionView
      game="minesweeper"
      date={daily.date}
      copy={messages.games.minesweeper.conclusion}
      result={result}
      lost={game?.status === "lost"}
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
