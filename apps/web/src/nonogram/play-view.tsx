import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import { messages } from "../i18n";
import { DailyPlayChrome } from "../play/daily-chrome";
import screen from "../play/screen.module.css";
import type { PlayChromeStat } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { Controls, ControlsSkeleton } from "./controls";
import styles from "./nonogram-board.module.css";
import { nonogramPageModifier } from "./page-class";
import type { NonogramPlay } from "./use-nonogram-play";

const copy = messages.games.nonogram.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: NonogramPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;

  return (
    <DailyPlayChrome
      game="nonogram"
      pageModifier={nonogramPageModifier(state.size)}
      date={state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={sizeStat(state.size)}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(
            state.size,
            play.filled,
            play.target,
          ),
          progressLong: copy.progressLong(play.filled, play.target),
          hint: {
            ready: play.hintReady,
            used: state.hint.used,
            explain:
              play.hintKind === null ? null : copy.hint.explain[play.hintKind],
            onReveal: play.revealHint,
          },
        },
      }}
    >
      <div className={screen.gridCard}>
        <Board
          size={state.size}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onMarkCell={play.markCell}
          onStrokeStart={play.strokeStart}
          onEnterValue={play.enterValue}
          onClear={play.clearCell}
          onPaintOver={play.paintOver}
        />
      </div>
      <Controls brush={state.brush} onSetBrush={play.setBrush} />
    </DailyPlayChrome>
  );
}

export function PlaySkeleton({
  date,
  size,
  clues,
  archive,
}: {
  readonly date: string;
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="nonogram"
      pageModifier={nonogramPageModifier(size)}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={sizeStat(size)}
      state={{ kind: "skeleton" }}
    >
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton size={size} clues={clues} />
      </div>
      <ControlsSkeleton />
    </DailyPlayChrome>
  );
}

function sizeStat(size: NonogramSize): PlayChromeStat {
  return {
    label: copy.sizeLabel,
    value: copy.size(size),
    className: styles.sizeCard ?? "",
  };
}
