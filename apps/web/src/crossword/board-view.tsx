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
    <CrosswordLayout
      board={
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
      }
      clueRow={
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
      }
      lists={
        <ClueLists
          id={listsId}
          clues={state.clues}
          selected={state.selected}
          direction={state.direction}
          onSelect={selectFromClue}
        />
      }
      listsOpen={cluesOpen}
      keyboard={
        <Keyboard
          onLetter={typeFromKey}
          onErase={eraseFromKey}
          activeKeyRef={activeKeyRef}
        />
      }
    />
  );
}

export function CrosswordSkeletonBody({
  overlay,
}: {
  readonly overlay?: ReactNode;
}) {
  return (
    <CrosswordLayout
      board={
        <BoardCard placeholder overlay={overlay}>
          <BoardSkeleton />
        </BoardCard>
      }
      clueRow={<ClueRowSkeleton />}
      keyboard={<KeyboardSkeleton />}
    />
  );
}

function CrosswordLayout({
  board,
  clueRow,
  lists,
  listsOpen = false,
  keyboard,
}: {
  readonly board: ReactNode;
  readonly clueRow: ReactNode;
  readonly lists?: ReactNode;
  readonly listsOpen?: boolean;
  readonly keyboard: ReactNode;
}) {
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.wellSlot}>{board}</div>
        <div className={styles.rowSlot}>{clueRow}</div>
        {lists === undefined ? null : (
          <div
            className={
              listsOpen
                ? styles.listsSlot
                : `${styles.listsSlot} ${styles.listsFolded}`
            }
          >
            {lists}
          </div>
        )}
        <div className={styles.keysSlot}>{keyboard}</div>
      </div>
    </div>
  );
}
