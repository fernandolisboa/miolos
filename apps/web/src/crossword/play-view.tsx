import { DailyPlayChrome } from "../play/daily-chrome";
import type { ArchivePlayChrome } from "../play/types";
import {
  CrosswordBoardView,
  CrosswordSkeletonBody,
  crosswordReadouts,
} from "./board-view";
import boardStyles from "./crossword-board.module.css";
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
      pageModifier={boardStyles.pageCrossword ?? ""}
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
  archive,
}: {
  readonly date: string;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <DailyPlayChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={null}
      state={{ kind: "skeleton" }}
    >
      <CrosswordSkeletonBody />
    </DailyPlayChrome>
  );
}
