import type { QueensSize } from "@miolos/core";

import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import {
  DAILY_PLAY_BACK,
  PlayScreenChrome,
  type PlayChromeStat,
} from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import { BoardSkeleton } from "./board";
import { BoardPanel, queensReadouts } from "./board-panel";
import styles from "./queens-board.module.css";
import type { QueensPlay } from "./use-queens-play";

const copy = messages.games.queens.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: QueensPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;

  return (
    <PlayScreenChrome
      game="queens"
      pageModifier={styles.pageQueens ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(state.date)}
      kicker={messages.games.queens.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={sizeStat(state.size)}
      state={{
        kind: "playing",
        readouts: queensReadouts(play),
      }}
    >
      <BoardPanel board={play} />
    </PlayScreenChrome>
  );
}

export function PlaySkeleton({
  date,
  size,
  regions,
  archive,
}: {
  readonly date: string;
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <PlayScreenChrome
      game="queens"
      pageModifier={styles.pageQueens ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      kicker={messages.games.queens.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock="blank"
      extraStat={sizeStat(size)}
      state={{ kind: "skeleton" }}
    >
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton size={size} regions={regions} />
      </div>
      <p aria-hidden className={styles.affordance}>
        {copy.affordance}
      </p>
    </PlayScreenChrome>
  );
}

function sizeStat(size: QueensSize): PlayChromeStat {
  return {
    label: copy.sizeLabel,
    value: copy.size(size),
    className: styles.sizeCard ?? "",
  };
}
