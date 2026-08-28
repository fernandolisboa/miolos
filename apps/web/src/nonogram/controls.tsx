import { messages } from "../i18n";
import styles from "./nonogram-board.module.css";
import type { NonogramBrush } from "./state";

const BRUSHES: readonly NonogramBrush[] = ["fill", "cross", "erase"];

export function Controls({
  brush,
  onSetBrush,
}: {
  readonly brush: NonogramBrush;
  readonly onSetBrush: (brush: NonogramBrush) => void;
}) {
  const copy = messages.games.nonogram.play.controls;

  return (
    <div className={styles.controls}>
      {BRUSHES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`${styles.control}${brush === mode ? ` ${styles.controlActive}` : ""}`}
          aria-label={copy[ariaKey(mode)]}
          aria-pressed={brush === mode}
          onClick={() => onSetBrush(mode)}
        >
          {copy[mode]}
        </button>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
    </div>
  );
}

export function ControlsSkeleton() {
  const copy = messages.games.nonogram.play.controls;

  return (
    <div aria-hidden className={styles.controls}>
      {BRUSHES.map((mode) => (
        <div key={mode} className={`${styles.control} ${styles.placeholder}`}>
          {copy[mode]}
        </div>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
    </div>
  );
}

function ariaKey(brush: NonogramBrush): "fillAria" | "crossAria" | "eraseAria" {
  switch (brush) {
    case "fill":
      return "fillAria";
    case "cross":
      return "crossAria";
    case "erase":
      return "eraseAria";
  }
}
