import { messages } from "../i18n";
import { hasDecidedCell } from "../play/reset-board";
import screen from "../play/screen.module.css";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import { Board } from "./board";
import styles from "./queens-board.module.css";
import type { QueensBoardState } from "./use-queens-board";

const copy = messages.games.queens.play;

export function queensReadouts(board: QueensBoardState): PlayChromeReadouts {
  const { state } = board;
  return {
    progressShort: copy.progressShort(state.size, board.placed, state.size),
    progressLong: copy.progressLong(board.placed, state.size),
    hint: {
      ready: board.hintReady,
      label: board.hintReady ? copy.hint.available : copy.hint.used,
      explain:
        board.hintKind === null ? null : copy.hint.explain[board.hintKind],
      onReveal: board.revealHint,
    },
    onReset: hasDecidedCell(state.entries) ? board.reset : null,
  };
}

export function BoardPanel({ board }: { readonly board: QueensBoardState }) {
  const { state } = board;
  return (
    <>
      <div className={screen.gridCard}>
        <Board
          size={state.size}
          regions={state.regions}
          entries={state.entries}
          conflicts={state.conflicts}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          onSelect={board.selectCell}
          onMove={board.moveSelection}
          onTap={board.tapCell}
          onCrossOver={board.crossOver}
          onEnterValue={board.enterValue}
          onClear={board.clearCell}
        />
      </div>
      <p className={styles.affordance}>{copy.affordance}</p>
    </>
  );
}
