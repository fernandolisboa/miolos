import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hintReadout } from "../play/hint-readout";
import type { PlayChromeStat } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { Controls, ControlsSkeleton } from "./controls";
import { nonogramHintExplanation } from "./hint";
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
            ...hintReadout(
              state.hint,
              nonogramHintExplanation(state.size, state.hint.reason),
            ),
            ready: play.hintReady,
            onReveal: play.revealHint,
          },
          ...play.edits,
        },
      }}
    >
      <BoardCard
        below={<Controls brush={state.brush} onSetBrush={play.setBrush} />}
      >
        <Board
          size={state.size}
          clues={state.clues}
          solution={state.solution}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          spotlight={state.hint.spotlight}
          onSelect={play.selectCell}
          onMove={play.moveSelection}
          onMarkCell={play.markCell}
          onStrokeStart={play.strokeStart}
          onEnterValue={play.enterValue}
          onClear={play.clearCell}
          onPaintOver={play.paintOver}
        />
      </BoardCard>
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
      <BoardCard placeholder below={<ControlsSkeleton />}>
        <BoardSkeleton size={size} clues={clues} />
      </BoardCard>
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
