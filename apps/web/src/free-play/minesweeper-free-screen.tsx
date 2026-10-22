"use client";

import {
  MINESWEEPER_LEVELS,
  type MinesweeperSize,
} from "@miolos/games/minesweeper";
import { useState, type ReactNode } from "react";

import { formatElapsed, messages } from "../i18n";
import { minesweeperFreeMessages } from "../minesweeper/free-messages";
import { minesweeperMessages } from "../minesweeper/messages";
import { FinishedMinefield } from "../minesweeper/finished-minefield";
import { Minefield, type TapMode } from "../minesweeper/minefield";
import minefield from "../minesweeper/minefield.module.css";
import type { MinesweeperFreeLevel } from "../minesweeper/state";
import { TapModeToggle } from "../minesweeper/tap-mode";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import { TimerReadout } from "../play/timer-readout";
import { choice, type Choice } from "./choice";
import { FreePlayChrome } from "./chrome";
import { MinesweeperSizeForm } from "./minesweeper-size-form";
import type { BestTime } from "./minesweeper-store";
import styles from "./minesweeper-free.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeMinesweeper,
  type MinesweeperDeps,
} from "./use-free-minesweeper";

const copy = minesweeperFreeMessages;

const LEVELS: readonly MinesweeperFreeLevel[] = [
  "beginner",
  "intermediate",
  "expert",
  "custom",
];

const LEVEL_CLASSES: Readonly<
  Record<
    MinesweeperFreeLevel,
    { readonly page: string | undefined; readonly field: string | undefined }
  >
> = {
  beginner: { page: minefield.pageBeginner, field: minefield.beginner },
  intermediate: {
    page: minefield.pageIntermediate,
    field: minefield.intermediate,
  },
  expert: { page: minefield.pageExpert, field: minefield.expert },
  custom: { page: undefined, field: undefined },
};

function minesweeperLevelChoice(
  level: MinesweeperFreeLevel,
  onSelect: (level: MinesweeperFreeLevel) => void,
): Choice {
  return choice({
    label: copy.levels.label,
    options: LEVELS,
    selected: level,
    optionLabel: (option) => copy.levels[option],
    optionAria: (option) => {
      if (option === "custom") {
        return copy.levels.customAria;
      }
      const { rows, columns, mines } = MINESWEEPER_LEVELS[option];
      return copy.levels.aria(copy.levels[option], rows, columns, mines);
    },
    onSelect,
  });
}

function SizeVars({
  level,
  size,
  children,
}: {
  readonly level: MinesweeperFreeLevel;
  readonly size: MinesweeperSize;
  readonly children: ReactNode;
}) {
  if (level !== "custom") {
    return children;
  }
  return (
    <div
      className={minefield.customSize}
      style={{ "--rows": size.rows, "--columns": size.columns }}
    >
      {children}
    </div>
  );
}

function BestTimeLine({ bestTime }: { readonly bestTime: BestTime | null }) {
  if (bestTime?.isNew === true) {
    return <p className={styles.bestTimeNew}>{copy.best.isNew}</p>;
  }
  if (bestTime?.best == null) {
    return null;
  }
  return (
    <p className={styles.bestTime}>
      {copy.best.line(formatElapsed(bestTime.best * 1000))}
    </p>
  );
}

export function MinesweeperFreeScreen({
  deps,
}: {
  readonly deps?: MinesweeperDeps;
}) {
  const mines = useFreeMinesweeper(deps);
  const [tapMode, setTapMode] = useState<TapMode>("open");
  const { game, level, seed } = mines.play;
  const { rows, columns } = game.size;
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
              <SizeVars level={level} size={game.size}>
                <FinishedMinefield game={game} sizeClass={classes.field} />
              </SizeVars>
              <TimerReadout
                className={minefield.finishedTime}
                elapsedMs={mines.elapsedMs}
              />
              <BestTimeLine bestTime={mines.bestTime} />
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
            progressShort: minesweeperMessages.progressShort(mines.minesLeft),
            progressLong: minesweeperMessages.progressLong(mines.minesLeft),
            hint: null,
            onReset: game.status === "ready" ? null : mines.newGame,
            resetCopy: messages.games.minesweeper.play.reset,
          },
        }}
      >
        {level === "custom" && (
          <MinesweeperSizeForm size={game.size} onPlay={mines.playCustom} />
        )}
        <SizeVars level={level} size={game.size}>
          <BoardCard>
            <Minefield
              key={`${String(rows)}×${String(columns)}×${String(game.size.mines)}:${String(seed)}`}
              game={game}
              sizeClass={classes.field}
              tapMode={tapMode}
              onActivate={mines.activate}
              onMark={mines.mark}
              onChord={mines.chord}
            />
          </BoardCard>
        </SizeVars>
        <TapModeToggle mode={tapMode} onChange={setTapMode} />
      </FreePlayChrome>
    </EndingStage>
  );
}
