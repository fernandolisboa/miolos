import type { QueensSize } from "@miolos/core";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { hasDecidedCell } from "../play/reset-board";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import { Board, BoardSkeleton } from "./board";
import { queensHintExplanation } from "./hint";
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
      used: state.hint.used,
      explain: queensHintExplanation(state.size, state.hint.reason),
      onReveal: board.revealHint,
    },
    onReset: hasDecidedCell(state.entries) ? board.reset : null,
  };
}

export function BoardPanel({ board }: { readonly board: QueensBoardState }) {
  const { state } = board;
  return (
    <BoardCard below={<p className={styles.affordance}>{copy.affordance}</p>}>
      <Board
        size={state.size}
        regions={state.regions}
        entries={state.entries}
        conflicts={state.conflicts}
        selected={state.selected}
        hintIndex={state.hint.lastIndex}
        spotlight={state.hint.spotlight}
        onSelect={board.selectCell}
        onMove={board.moveSelection}
        onTap={board.tapCell}
        onCrossOver={board.crossOver}
        onEnterValue={board.enterValue}
        onClear={board.clearCell}
      />
    </BoardCard>
  );
}

export function BoardPanelSkeleton({
  size,
  regions,
}: {
  readonly size: QueensSize;
  readonly regions: readonly number[];
}) {
  return (
    <BoardCard
      placeholder
      below={
        <p aria-hidden className={styles.affordance}>
          {copy.affordance}
        </p>
      }
    >
      <BoardSkeleton size={size} regions={regions} />
    </BoardCard>
  );
}
