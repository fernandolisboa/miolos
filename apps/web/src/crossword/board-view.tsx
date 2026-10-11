import { useCallback, useRef } from "react";

import { messages } from "../i18n";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import { ActiveClueBar, ClueLists } from "./clues";
import { Board, BoardSkeleton, focusBoard } from "./board";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import type { CrosswordDirection } from "./grid";
import type { CrosswordBoard } from "./use-crossword-board";

const copy = messages.games.crossword.play;

export function crosswordReadouts(board: CrosswordBoard): PlayChromeReadouts {
  return {
    progressShort: copy.progressShort(board.filled, board.total),
    progressLong: copy.progressLong(board.filled, board.total),
    hint: {
      ready: board.hintReady,
      label: board.hintReady ? copy.hint.available : copy.hint.used,
      explain:
        board.hintKind === null ? null : copy.hint.explain[board.hintKind],
      onReveal: board.revealHint,
    },
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
  const selectFromClue = (index: number, direction: CrosswordDirection) => {
    focusBoard(boardRef.current);
    selectEntry(index, direction);
  };

  return (
    <>
      <div className={screen.gridCard}>
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
      </div>

      <ActiveClueBar
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
      />

      <Keyboard
        onLetter={typeFromKey}
        onErase={eraseFromKey}
        activeKeyRef={activeKeyRef}
      />

      <ClueLists
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
        onSelect={selectFromClue}
      />
    </>
  );
}

export function CrosswordSkeletonBody() {
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeyboardSkeleton />
    </>
  );
}
