"use client";

import {
  MINESWEEPER_LEVELS,
  type MinesweeperLevel,
} from "@miolos/games/minesweeper";
import { useState } from "react";

import { messages } from "../i18n";
import { minesweeperMessages } from "../minesweeper/messages";
import {
  FinishedMinefield,
  Minefield,
  type TapMode,
} from "../minesweeper/minefield";
import minefield from "../minesweeper/minefield.module.css";
import { TapModeToggle } from "../minesweeper/tap-mode";
import {
  useMinesweeper,
  type MinesweeperDeps,
} from "../minesweeper/use-minesweeper";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import { TimerReadout } from "../play/timer-readout";
import { type FreePlayChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlaySolvedCard } from "./solved-card";

const copy = minesweeperMessages;

const LEVELS = Object.keys(MINESWEEPER_LEVELS) as readonly MinesweeperLevel[];

const PAGE_CLASS: Readonly<Record<MinesweeperLevel, string | undefined>> = {
  beginner: minefield.pageBeginner,
  intermediate: minefield.pageIntermediate,
  expert: minefield.pageExpert,
};

function minesweeperLevelChoice(
  level: MinesweeperLevel,
  onChange: (level: MinesweeperLevel) => void,
): FreePlayChoice<MinesweeperLevel> {
  return {
    label: copy.levels.label,
    options: LEVELS,
    value: level,
    optionLabel: (option) => copy.levels[option],
    optionAria: (option) => {
      const { rows, columns, mines } = MINESWEEPER_LEVELS[option];
      return copy.levels.aria(copy.levels[option], rows, columns, mines);
    },
    onChange,
  };
}

export function MinesweeperFreeScreen({
  deps,
}: {
  readonly deps?: MinesweeperDeps;
}) {
  const mines = useMinesweeper(deps);
  const [tapMode, setTapMode] = useState<TapMode>("open");
  const { game } = mines.play;
  const choice = minesweeperLevelChoice(game.level, mines.chooseLevel);

  return (
    <EndingStage
      over={game.status === "won" || game.status === "lost"}
      won={game.status === "won"}
      ending={() => (
        <FreePlaySolvedCard
          game="minesweeper"
          choice={choice}
          lost={game.status === "lost"}
          onAgain={mines.newGame}
          picture={
            <div className={minefield.finishedField}>
              <FinishedMinefield game={game} />
              <TimerReadout
                className={minefield.finishedTime}
                elapsedMs={mines.elapsedMs}
              />
            </div>
          }
        />
      )}
    >
      <FreePlayChrome
        game="minesweeper"
        choice={choice}
        clock={{ elapsedMs: mines.elapsedMs }}
        pageModifier={`${minefield.pageMinefield ?? ""} ${PAGE_CLASS[game.level] ?? ""}`}
        state={{
          kind: "playing",
          readouts: {
            progressShort: copy.progressShort(mines.minesLeft),
            progressLong: copy.progressLong(mines.minesLeft),
            hint: null,
            onReset: game.status === "ready" ? null : mines.newGame,
            resetCopy: messages.games.minesweeper.play.reset,
          },
        }}
      >
        <BoardCard>
          <Minefield
            key={`${game.level}:${String(game.seed)}`}
            game={game}
            tapMode={tapMode}
            onActivate={mines.activate}
            onMark={mines.mark}
            onChord={mines.chord}
          />
        </BoardCard>
        <TapModeToggle mode={tapMode} onChange={setTapMode} />
      </FreePlayChrome>
    </EndingStage>
  );
}
