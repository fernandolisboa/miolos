import { DAILY_MINESWEEPER_SIZE } from "@miolos/core";
import { useState } from "react";

import { BoardCard } from "../play/board-card";
import { DailyPlayChrome } from "../play/daily-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { minesweeperMessages } from "./messages";
import { Minefield, MinefieldSkeleton, type TapMode } from "./minefield";
import minefield from "./minefield.module.css";
import { TapModeToggle } from "./tap-mode";
import type { MinesweeperDailyPlay } from "./use-minesweeper-play";

const copy = minesweeperMessages;

const PAGE = `${minefield.pageMinefield ?? ""} ${minefield.pageDaily ?? ""}`;

export function PlayView({
  play,
  archive,
}: {
  readonly play: MinesweeperDailyPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const [tapMode, setTapMode] = useState<TapMode>("open");
  const { state } = play;

  return (
    <DailyPlayChrome
      game="minesweeper"
      pageModifier={PAGE}
      date={state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(play.minesLeft),
          progressLong: copy.progressLong(play.minesLeft),
          hint: null,
        },
      }}
    >
      <BoardCard>
        <Minefield
          game={state.game}
          sizeClass={minefield.daily}
          tapMode={tapMode}
          onActivate={play.activate}
          onMark={play.mark}
          onChord={play.chord}
        />
      </BoardCard>
      <TapModeToggle mode={tapMode} onChange={setTapMode} />
    </DailyPlayChrome>
  );
}

export function PlaySkeleton({
  date,
  archive,
}: {
  readonly date: string;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="minesweeper"
      pageModifier={PAGE}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={null}
      state={{ kind: "skeleton" }}
    >
      <BoardCard placeholder>
        <MinefieldSkeleton
          cells={DAILY_MINESWEEPER_SIZE.rows * DAILY_MINESWEEPER_SIZE.columns}
          sizeClass={minefield.daily}
        />
      </BoardCard>
    </DailyPlayChrome>
  );
}
