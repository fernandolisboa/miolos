import { formatLongDate, messages } from "../i18n";
import { DAILY_PLAY_BACK, PlayScreenChrome } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import {
  CrosswordBoardView,
  CrosswordSkeletonBody,
  crosswordReadouts,
} from "./board-view";
import boardStyles from "./crossword-board.module.css";
import type { CrosswordPlay } from "./use-crossword-play";

const copy = messages.games.crossword.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: CrosswordPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <PlayScreenChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(play.state.date)}
      kicker={messages.games.crossword.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{ kind: "playing", readouts: crosswordReadouts(play) }}
    >
      <CrosswordBoardView board={play} />
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
      <CrosswordSkeletonBody />
    </PlayScreenChrome>
  );
}
