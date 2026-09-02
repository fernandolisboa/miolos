import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import {
  DAILY_PLAY_BACK,
  PlayScreenChrome,
  type PlayChromeStat,
} from "../play/screen-chrome";
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
    <PlayScreenChrome
      game="nonogram"
      pageModifier={nonogramPageModifier(state.size)}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(state.date)}
      kicker={messages.games.nonogram.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
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
          size={state.size}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onMarkCell={play.markCell}
          onEnterValue={play.enterValue}
          onClear={play.clearCell}
          onPaintOver={play.paintOver}
        />
      </div>
      <Controls brush={state.brush} onSetBrush={play.setBrush} />
    </PlayScreenChrome>
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
    <PlayScreenChrome
      game="nonogram"
      pageModifier={nonogramPageModifier(size)}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      kicker={messages.games.nonogram.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock="blank"
      extraStat={sizeStat(size)}
      state={{ kind: "skeleton" }}
    >
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton size={size} clues={clues} />
      </div>
      <ControlsSkeleton />
    </PlayScreenChrome>
  );
}

function sizeStat(size: NonogramSize): PlayChromeStat {
  return {
    label: copy.sizeLabel,
    value: copy.size(size),
    className: styles.sizeCard ?? "",
  };
}
