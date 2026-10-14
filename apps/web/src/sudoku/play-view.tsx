import type { SudokuTier } from "@miolos/games/sudoku";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hasDecidedCell } from "../play/reset-board";
import type { PlayChromeStat } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
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
            ready: play.hintReady,
            used: state.hint.used,
            explain: sudokuHintExplanation(state.hint.reason),
            onReveal: play.revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? play.reset : null,
        },
      }}
    >
      <BoardCard below={<Keypad lock={play.lock} />}>
        <Board
          givens={state.givens}
          solution={play.solution}
          entries={state.entries}
          selected={state.selected}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          spotlight={state.hint.spotlight}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onDigit={play.enterDigit}
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
