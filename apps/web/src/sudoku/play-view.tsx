import type { SudokuTier } from "@miolos/games/sudoku";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hintReadout } from "../play/hint-readout";
import type { PlayChromeStat } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { mergedGrid } from "./engine";
import { sudokuHintExplanation } from "./hint";
import { Keypad, KeypadSkeleton } from "./keypad";
import styles from "./sudoku-board.module.css";
import type { SudokuPlay } from "./use-sudoku-play";

const TOTAL_CELLS = 81;

const copy = messages.games.sudoku.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: SudokuPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;

  return (
    <DailyPlayChrome
      game="sudoku"
      pageModifier={styles.pageSudoku ?? ""}
      date={state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={levelStat(state.tier)}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(
            copy.level(state.tier),
            play.filled,
            TOTAL_CELLS,
          ),
          progressLong: copy.progressLong(play.filled, TOTAL_CELLS),
          hint: {
            ...hintReadout(
              state.hint,
              sudokuHintExplanation(state.hint.reason),
            ),
            ready: play.hintReady,
            onReveal: play.revealHint,
          },
          ...play.edits,
        },
      }}
    >
      <BoardCard
        below={
          <Keypad
            lock={play.lock}
            grid={mergedGrid(state.givens, state.entries)}
            noting={state.noting}
            onToggleNoting={play.toggleNoting}
          />
        }
      >
        <Board
          givens={state.givens}
          solution={play.solution}
          entries={state.entries}
          notes={state.notes}
          selected={state.selected}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          spotlight={state.hint.spotlight}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onDigit={play.enterDigit}
          onNote={play.toggleNote}
          onToggleNoting={play.toggleNoting}
          onClear={play.clearCell}
          onTapCell={play.lock.tapCell}
        />
      </BoardCard>
    </DailyPlayChrome>
  );
}

export function PlaySkeleton({
  date,
  tier,
  archive,
}: {
  readonly date: string;
  readonly tier: SudokuTier;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="sudoku"
      pageModifier={styles.pageSudoku ?? ""}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={levelStat(tier)}
      state={{ kind: "skeleton" }}
    >
      <BoardCard placeholder below={<KeypadSkeleton />}>
        <BoardSkeleton />
      </BoardCard>
    </DailyPlayChrome>
  );
}

function levelStat(tier: SudokuTier): PlayChromeStat {
  return {
    label: copy.levelLabel,
    value: copy.level(tier),
    className: styles.levelCard ?? "",
  };
}
