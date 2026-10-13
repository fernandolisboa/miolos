import type { QueensSize } from "@miolos/core";

import { messages } from "../i18n";
import { DailyPlayChrome } from "../play/daily-chrome";
import screen from "../play/screen.module.css";
import type { PlayChromeStat } from "../play/screen-chrome";
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
    <DailyPlayChrome
      game="queens"
      pageModifier={styles.pageQueens ?? ""}
      date={state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={sizeStat(state.size)}
      state={{
        kind: "playing",
        readouts: queensReadouts(play),
      }}
    >
      <BoardPanel board={play} />
    </DailyPlayChrome>
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
    <DailyPlayChrome
      game="queens"
      pageModifier={styles.pageQueens ?? ""}
      date={date}
      archive={archive}
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
    </DailyPlayChrome>
  );
}

function sizeStat(size: QueensSize): PlayChromeStat {
  return {
    label: copy.sizeLabel,
    value: copy.size(size),
    className: styles.sizeCard ?? "",
  };
}
