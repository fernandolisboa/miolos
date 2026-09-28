import { useCallback, useRef } from "react";

import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import { DAILY_PLAY_BACK, PlayScreenChrome } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { ActiveClueBar, ClueLists } from "./clues";
import { Board, BoardSkeleton, focusBoard } from "./board";
import boardStyles from "./crossword-board.module.css";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import type { CrosswordDirection } from "./grid";
import type { CrosswordPlay } from "./use-crossword-play";

const copy = messages.games.crossword.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: CrosswordPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state, typeLetter, backspace, selectEntry } = play;
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
    <PlayScreenChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(state.date)}
      kicker={messages.games.crossword.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(play.filled, play.total),
          progressLong: copy.progressLong(play.filled, play.total),
          hint: {
            ready: play.hintReady,
            label: play.hintReady ? copy.hint.available : copy.hint.used,
            explain:
              play.hintKind === null ? null : copy.hint.explain[play.hintKind],
            onReveal: play.revealHint,
          },
        },
      }}
    >
      <div className={screen.gridCard}>
        <Board
          boardRef={boardRef}
          solution={state.solution}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          direction={state.direction}
          hintIndex={state.hint.lastIndex}
          onSelect={play.selectCell}
          onToggleDirection={play.toggleDirection}
          onMove={play.moveSelection}
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
    </PlayScreenChrome>
  );
}

export function PlaySkeleton({
  date,
  archive,
}: {
  readonly date: string;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <PlayScreenChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      kicker={messages.games.crossword.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock="blank"
      extraStat={null}
      state={{ kind: "skeleton" }}
    >
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeyboardSkeleton />
    </PlayScreenChrome>
  );
}
