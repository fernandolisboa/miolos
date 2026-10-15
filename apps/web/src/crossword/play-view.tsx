import { DailyPlayChrome } from "../play/daily-chrome";
import type { ArchivePlayChrome } from "../play/types";
import {
  CrosswordBoardView,
  CrosswordSkeletonBody,
  crosswordReadouts,
} from "./board-view";
import { pageClassName } from "./size-classes";
import type { CrosswordPlay } from "./use-crossword-play";

export function PlayView({
  play,
  archive,
}: {
  readonly play: CrosswordPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="crossword"
      pageModifier={pageClassName(play.state.size)}
      date={play.state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{ kind: "playing", readouts: crosswordReadouts(play) }}
    >
      <CrosswordBoardView board={play} />
    </DailyPlayChrome>
  );
}

export function PlaySkeleton({
  date,
  size,
  archive,
}: {
  readonly date: string;
  readonly size: number;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="crossword"
      pageModifier={pageClassName(size)}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={null}
      state={{ kind: "skeleton" }}
    >
      <CrosswordSkeletonBody size={size} />
    </DailyPlayChrome>
  );
}
