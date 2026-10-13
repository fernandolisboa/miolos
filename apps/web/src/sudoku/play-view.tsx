import type { SudokuTier } from "@miolos/games/sudoku";

import { messages } from "../i18n";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hasDecidedCell } from "../play/reset-board";
import screen from "../play/screen.module.css";
import type { PlayChromeStat } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
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
            explain:
              play.hintKind === null ? null : copy.hint.explain[play.hintKind],
            onReveal: play.revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? play.reset : null,
        },
      }}
    >
      <div className={screen.gridCard}>
        <Board
          givens={state.givens}
          entries={state.entries}
          selected={state.selected}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onDigit={play.enterDigit}
          onClear={play.clearCell}
        />
      </div>
      <Keypad onDigit={play.enterDigit} onClear={play.clearCell} />
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
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeypadSkeleton />
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
