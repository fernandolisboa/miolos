import type { SudokuTier } from "@miolos/games/sudoku";

import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import {
  DAILY_PLAY_BACK,
  PlayScreenChrome,
  type PlayChromeStat,
} from "../play/screen-chrome";
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
    <PlayScreenChrome
      game="sudoku"
      pageClassName={styles.pageSudoku ?? ""}
      playState="playing"
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(state.date)}
      kicker={messages.games.sudoku.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={levelStat(state.tier)}
      live={{
        progressShort: copy.progressShort(
          copy.level(state.tier),
          play.filled,
          TOTAL_CELLS,
        ),
        progressLong: copy.progressLong(play.filled, TOTAL_CELLS),
        hint: {
          ready: play.hintReady,
          label: play.hintReady ? copy.hint.available : copy.hint.used,
          explain:
            play.hintKind === null ? null : copy.hint.explain[play.hintKind],
          onReveal: play.revealHint,
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
    </PlayScreenChrome>
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
    <PlayScreenChrome
      game="sudoku"
      pageClassName={styles.pageSudoku ?? ""}
      playState="skeleton"
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      kicker={messages.games.sudoku.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock="blank"
      extraStat={levelStat(tier)}
      live={null}
    >
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeypadSkeleton />
    </PlayScreenChrome>
  );
}

function levelStat(tier: SudokuTier): PlayChromeStat {
  return {
    label: copy.levelLabel,
    value: copy.level(tier),
    className: styles.levelCard ?? "",
  };
}
