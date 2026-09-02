import { formatLongDate, messages } from "../i18n";
import screen from "../play/screen.module.css";
import { DAILY_PLAY_BACK, PlayScreenChrome } from "../play/screen-chrome";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./binairo-screen.module.css";
import { Controls } from "./controls";
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
    <PlayScreenChrome
      game="binairo"
      pageModifier={styles.pageBinairo ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(state.date)}
      kicker={messages.games.binairo.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
      clock={{ elapsedMs: play.elapsed }}
      extraStat={null}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(play.filled, TOTAL_CELLS),
          progressLong: copy.progressLong(play.filled, TOTAL_CELLS),
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
        <Grid
          givens={state.givens}
          entries={state.entries}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          painting={state.paint.kind !== "cycle"}
          onTap={play.tapCell}
          onPaintOver={play.paintOver}
        />
      </div>
      <Controls paint={state.paint} onToggleMode={play.toggleMode} />
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
      game="binairo"
      pageModifier={styles.pageBinairo ?? ""}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      kicker={messages.games.binairo.kicker}
      title={copy.title}
      rules={copy.rules}
      note={archive?.note ?? null}
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

      <div aria-hidden className={styles.controls}>
        <div
          className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
        >
          {copy.controls.zero}
        </div>
        <div
          className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
        >
          {copy.controls.one}
        </div>
        <div
          className={`${styles.control} ${styles.controlErase} ${styles.placeholder}`}
        >
          {copy.controls.erase}
        </div>
        <span className={styles.affordance}>{copy.controls.affordance}</span>
      </div>
    </PlayScreenChrome>
  );
}
