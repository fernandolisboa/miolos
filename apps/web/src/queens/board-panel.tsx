import type { QueensSize } from "@miolos/core";
import type { ReactNode } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { hintReadout } from "../play/hint-readout";
import { InfoTip, InfoTipSkeleton } from "../play/info-tip";
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
      ...hintReadout(
        state.hint,
        queensHintExplanation(state.size, state.hint.reason),
      ),
      ready: board.hintReady,
      onReveal: board.revealHint,
    },
    ...board.edits,
  };
}

export function BoardPanel({ board }: { readonly board: QueensBoardState }) {
  const { state } = board;
  return (
    <BoardCard
      below={
        <div className={styles.affordance}>
          <InfoTip text={copy.affordance} align="center" />
        </div>
      }
    >
      <Board
        size={state.size}
        regions={state.regions}
        solution={state.solution}
        entries={state.entries}
        mistakes={state.mistakes}
        conflicts={state.conflicts}
        selected={state.selected}
        hintIndex={state.hint.lastIndex}
        spotlight={state.hint.spotlight}
        onSelect={board.selectCell}
        onMove={board.moveSelection}
        onTap={board.tapCell}
        onStrokeStart={board.strokeStart}
        onPaintOver={board.paintOver}
        onEnterValue={board.enterValue}
        onClear={board.clearCell}
      />
    </BoardCard>
  );
}

export function BoardPanelSkeleton({
  size,
  regions,
  overlay,
}: {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly overlay?: ReactNode;
}) {
  return (
    <BoardCard
      placeholder
      overlay={overlay}
      below={
        <div className={styles.affordance}>
          <InfoTipSkeleton />
        </div>
      }
    >
      <BoardSkeleton size={size} regions={regions} />
    </BoardCard>
  );
}
