import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hasDecidedCell } from "../play/reset-board";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./binairo-screen.module.css";
import { Controls, ControlsSkeleton } from "./controls";
import { Grid } from "./grid";
import { binairoHintExplanation } from "./hint";
import type { BinairoPlay } from "./use-binairo-play";

const TOTAL_CELLS = 64;

const copy = messages.games.binairo.play;

export function PlayView({
  play,
  archive,
}: {
  readonly play: BinairoPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;

  return (
    <DailyPlayChrome
      game="binairo"
      pageModifier={styles.pageBinairo ?? ""}
      date={state.date}
      archive={archive}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(play.filled, TOTAL_CELLS),
          progressLong: copy.progressLong(play.filled, TOTAL_CELLS),
          hint: {
            ready: play.hintReady,
            used: state.hint.used,
            cell: state.hint.lastIndex,
            explain: binairoHintExplanation(state.hint.reason),
            onReveal: play.revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? play.reset : null,
        },
      }}
    >
      <BoardCard
        below={<Controls paint={state.paint} onToggleMode={play.toggleMode} />}
      >
        <Grid
          givens={state.givens}
          solution={play.solution}
          entries={state.entries}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          spotlight={state.hint.spotlight}
          painting={state.paint.kind !== "cycle"}
          onTap={play.tapCell}
          onStrokeStart={play.strokeStart}
          onPaintOver={play.paintOver}
        />
      </BoardCard>
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
      game="binairo"
      pageModifier={styles.pageBinairo ?? ""}
      date={date}
      archive={archive}
      clock="blank"
      extraStat={null}
      state={{ kind: "skeleton" }}
    >
      <BoardCard placeholder below={<ControlsSkeleton />}>
        <div className={styles.grid}>
          {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
            <div
              key={index}
              className={`${styles.cell} ${styles.cellSkeleton}`}
            />
          ))}
        </div>
      </BoardCard>
    </DailyPlayChrome>
  );
}
