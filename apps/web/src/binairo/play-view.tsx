import { messages } from "../i18n";
import { DailyPlayChrome } from "../play/daily-chrome";
import { hasDecidedCell } from "../play/reset-board";
import screen from "../play/screen.module.css";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./binairo-screen.module.css";
import { Controls, ControlsSkeleton } from "./controls";
import { Grid } from "./grid";
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
            explain:
              play.hintKind === null ? null : copy.hint.explain[play.hintKind],
            onReveal: play.revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? play.reset : null,
        },
      }}
    >
      <div className={screen.gridCard}>
        <Grid
          givens={state.givens}
          entries={state.entries}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          painting={state.paint.kind !== "cycle"}
          onTap={play.tapCell}
          onStrokeStart={play.strokeStart}
          onPaintOver={play.paintOver}
        />
      </div>
      <Controls paint={state.paint} onToggleMode={play.toggleMode} />
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
      <div aria-hidden className={screen.gridCard}>
        <div className={styles.grid}>
          {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
            <div
              key={index}
              className={`${styles.cell} ${styles.cellSkeleton}`}
            />
          ))}
        </div>
      </div>

      <ControlsSkeleton />
    </DailyPlayChrome>
  );
}
