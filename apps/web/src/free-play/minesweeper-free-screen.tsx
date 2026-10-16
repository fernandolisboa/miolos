"use client";

import {
  MINESWEEPER_LEVELS,
  type MinesweeperLevel,
} from "@miolos/games/minesweeper";
import { useState } from "react";

import { messages } from "../i18n";
import { minesweeperMessages } from "../minesweeper/messages";
import { FinishedMinefield } from "../minesweeper/finished-minefield";
import { Minefield, type TapMode } from "../minesweeper/minefield";
import minefield from "../minesweeper/minefield.module.css";
import { TapModeToggle } from "../minesweeper/tap-mode";
import {
  useMinesweeper,
  type MinesweeperDeps,
} from "../minesweeper/use-minesweeper";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import { TimerReadout } from "../play/timer-readout";
import { choice, type Choice } from "./choice";
import { FreePlayChrome } from "./chrome";
import { FreePlaySolvedCard } from "./solved-card";

const copy = minesweeperMessages;

const LEVELS = Object.keys(MINESWEEPER_LEVELS) as readonly MinesweeperLevel[];

const LEVEL_CLASSES: Readonly<
  Record<
    MinesweeperLevel,
    { readonly page: string | undefined; readonly field: string | undefined }
  >
> = {
  beginner: { page: minefield.pageBeginner, field: minefield.beginner },
  intermediate: {
    page: minefield.pageIntermediate,
    field: minefield.intermediate,
  },
  expert: { page: minefield.pageExpert, field: minefield.expert },
};

function minesweeperLevelChoice(
  level: MinesweeperLevel,
  onSelect: (level: MinesweeperLevel) => void,
): Choice {
  return choice({
    label: copy.levels.label,
    options: LEVELS,
    selected: level,
    optionLabel: (option) => copy.levels[option],
    optionAria: (option) => {
      const { rows, columns, mines } = MINESWEEPER_LEVELS[option];
      return copy.levels.aria(copy.levels[option], rows, columns, mines);
    },
    onSelect,
  });
}

export function MinesweeperFreeScreen({
  deps,
}: {
  readonly deps?: MinesweeperDeps;
}) {
  const mines = useMinesweeper(deps);
  const [tapMode, setTapMode] = useState<TapMode>("open");
  const { game, level, seed } = mines.play;
  const classes = LEVEL_CLASSES[level];
  const choices = [minesweeperLevelChoice(level, mines.chooseLevel)];

  return (
    <EndingStage
      over={game.status === "won" || game.status === "lost"}
      won={game.status === "won"}
      ending={() => (
        <FreePlaySolvedCard
          game="minesweeper"
          choices={choices}
          lost={game.status === "lost"}
          onAgain={mines.newGame}
          picture={
            <div className={minefield.finishedField}>
              <FinishedMinefield game={game} sizeClass={classes.field} />
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
        choices={choices}
        clock={{ elapsedMs: mines.elapsedMs }}
        pageModifier={`${minefield.pageMinefield ?? ""} ${classes.page ?? ""}`}
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
            key={`${level}:${String(seed)}`}
            game={game}
            sizeClass={classes.field}
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
