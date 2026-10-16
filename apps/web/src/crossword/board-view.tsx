import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { hintReadout } from "../play/hint-readout";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import { ClueBar, ClueBarSkeleton, ClueLists } from "./clues";
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
      ...hintReadout(
        board.state.hint,
        crosswordHintExplanation(board.state.hint.reason, board.state.size),
      ),
      ready: board.hintReady,
      onReveal: board.revealHint,
    },
    ...board.edits,
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
            size={state.size}
            solution={state.solution}
            clues={state.clues}
            entries={state.entries}
            mistakes={state.mistakes}
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
      clueBar={
        <ClueBar
          clues={state.clues}
          selected={state.selected}
          direction={state.direction}
          size={state.size}
        />
      }
      clues={{
        list: (
          <ClueLists
            clues={state.clues}
            selected={state.selected}
            direction={state.direction}
            size={state.size}
            onSelect={selectFromClue}
          />
        ),
        open: cluesOpen,
        onToggle: () => {
          setCluesOpen((open) => !open);
        },
      }}
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
  size,
  overlay,
}: {
  readonly size: number;
  readonly overlay?: ReactNode;
}) {
  return (
    <CrosswordLayout
      board={
        <BoardCard placeholder overlay={overlay}>
          <BoardSkeleton size={size} />
        </BoardCard>
      }
      clueBar={<ClueBarSkeleton />}
      clues={null}
      keyboard={<KeyboardSkeleton />}
    />
  );
}

function CrosswordLayout({
  board,
  clueBar,
  clues,
  keyboard,
}: {
  readonly board: ReactNode;
  readonly clueBar: ReactNode;
  readonly clues: {
    readonly list: ReactNode;
    readonly open: boolean;
    readonly onToggle: () => void;
  } | null;
  readonly keyboard: ReactNode;
}) {
  const listsId = useId();
  return (
    <div className={styles.layout}>
      <div className={styles.columns}>
        <div className={styles.wellSlot}>{board}</div>
        <div className={styles.rowSlot}>
          {clueBar}
          {clues === null ? (
            <span aria-hidden className={styles.toggle}>
              {copy.cluesHeading}
            </span>
          ) : (
            <button
              type="button"
              className={styles.toggle}
              aria-expanded={clues.open}
              aria-controls={listsId}
              onClick={clues.onToggle}
            >
              {copy.cluesHeading}
            </button>
          )}
        </div>
        {clues === null ? null : (
          <div
            id={listsId}
            className={
              clues.open
                ? styles.listsSlot
                : `${styles.listsSlot} ${styles.listsFolded}`
            }
          >
            {clues.list}
          </div>
        )}
        <div className={styles.keysSlot}>{keyboard}</div>
      </div>
    </div>
  );
}
