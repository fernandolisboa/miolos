import { useRef } from "react";

import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import { DAILY_PLAY_BACK, PlayScreenChrome } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { ActiveClueBar, ClueLists } from "./clues";
import { Board, BoardSkeleton } from "./board";
import boardStyles from "./crossword-board.module.css";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import type { CrosswordPlay } from "./use-crossword-play";

const copy = messages.games.crossword.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: CrosswordPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);

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
          solution={state.solution}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          direction={state.direction}
          hintIndex={state.hint.lastIndex}
          onSelect={play.selectCell}
          onToggleDirection={play.toggleDirection}
          onMove={play.moveSelection}
          onLetter={play.typeLetter}
          onBackspace={play.backspace}
        />
      </div>

      <ActiveClueBar
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
      />

      <Keyboard
        onLetter={play.typeLetter}
        onErase={play.backspace}
        activeKeyRef={activeKeyRef}
      />

      <ClueLists
        clues={state.clues}
        selected={state.selected}
        direction={state.direction}
        onSelect={play.selectEntry}
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
