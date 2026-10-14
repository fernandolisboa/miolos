import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { hasDecidedCell } from "../play/reset-board";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import { ClueRow, ClueRowSkeleton, ClueLists } from "./clues";
import { Board, BoardSkeleton, focusBoard } from "./board";
import styles from "./crossword-board.module.css";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import type { CrosswordDirection } from "./grid";
import { crosswordHintExplanation } from "./hint";
import type { CrosswordBoard } from "./use-crossword-board";

const copy = messages.games.crossword.play;

export function crosswordReadouts(board: CrosswordBoard): PlayChromeReadouts {
  return {
    progressShort: copy.progressShort(board.filled, board.total),
    progressLong: copy.progressLong(board.filled, board.total),
    hint: {
      ready: board.hintReady,
      used: board.state.hint.used,
      explain: crosswordHintExplanation(board.state.hint.reason),
      onReveal: board.revealHint,
    },
    onReset: hasDecidedCell(board.state.entries) ? board.reset : null,
  };
}

export function CrosswordBoardView({
  board,
}: {
  readonly board: CrosswordBoard;
}) {
  const { state, typeLetter, backspace, selectEntry } = board;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // A pointer-tapped on-screen key blurs itself; a keyboard-activated one keeps
  // focus for its arrow navigation, so only the former hands focus back.
  const reclaimFocus = useCallback(() => {
    if (
      document.activeElement === null ||
      document.activeElement === document.body
    ) {
      focusBoard(boardRef.current);
    }
  }, []);
  const typeFromKey = useCallback(
    (letter: string) => {
      reclaimFocus();
      typeLetter(letter);
    },
    [reclaimFocus, typeLetter],
  );
  const eraseFromKey = useCallback(() => {
    reclaimFocus();
    backspace();
  }, [reclaimFocus, backspace]);
  const listsId = useId();
  const [cluesOpen, setCluesOpen] = useState(false);
  const selectFromClue = (index: number, direction: CrosswordDirection) => {
    setCluesOpen(false);
    focusBoard(boardRef.current);
    selectEntry(index, direction);
  };

  return (
    <CrosswordLayout>
      <BoardCard>
        <Board
          boardRef={boardRef}
          solution={state.solution}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          direction={state.direction}
          hintIndex={state.hint.lastIndex}
          onSelect={board.selectCell}
          onToggleDirection={board.toggleDirection}
          onMove={board.moveSelection}
          onLetter={typeLetter}
          onBackspace={backspace}
        />
      </BoardCard>

      <ClueRow
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
        listsId={listsId}
        open={cluesOpen}
        onToggle={() => {
          setCluesOpen((open) => !open);
        }}
      />

      <ClueLists
        id={listsId}
        collapsed={!cluesOpen}
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
        onSelect={selectFromClue}
      />

      <Keyboard
        onLetter={typeFromKey}
        onErase={eraseFromKey}
        activeKeyRef={activeKeyRef}
      />
    </CrosswordLayout>
  );
}

export function CrosswordSkeletonBody({
  overlay,
}: {
  readonly overlay?: ReactNode;
}) {
  return (
    <CrosswordLayout>
      <BoardCard placeholder overlay={overlay}>
        <BoardSkeleton />
      </BoardCard>
      <ClueRowSkeleton />
      <KeyboardSkeleton />
    </CrosswordLayout>
  );
}

function CrosswordLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>{children}</div>
    </div>
  );
}
