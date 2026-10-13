import { messages } from "../i18n";
import styles from "./nonogram-board.module.css";
import type { NonogramBrush } from "./state";

const SEGMENTS = [
  { brush: "cross", label: "crossAria", Icon: CrossIcon },
  { brush: "fill", label: "fillAria", Icon: FillIcon },
] as const;

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
      <div className={styles.brushToggle}>
        {SEGMENTS.map(({ brush: mode, label, Icon }) => (
          <button
            key={mode}
            type="button"
            className={`${styles.control}${brush === mode ? ` ${styles.controlActive}` : ""}`}
            aria-label={copy[label]}
            aria-pressed={brush === mode}
            onClick={() => onSetBrush(mode)}
          >
            <Icon />
          </button>
        ))}
      </div>
      <span className={styles.affordance}>{copy.affordance}</span>
    </div>
  );
}

export function ControlsSkeleton() {
  return (
    <div aria-hidden className={styles.controls}>
      <div className={styles.brushToggle}>
        {SEGMENTS.map(({ brush, Icon }) => (
          <div
            key={brush}
            className={`${styles.control} ${styles.placeholder}`}
          >
            <Icon />
          </div>
        ))}
      </div>
      <span className={styles.affordance}>
        {messages.games.nonogram.play.controls.affordance}
      </span>
    </div>
  );
}

function CrossIcon() {
  return (
    <svg aria-hidden className={styles.brushIcon} viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

function FillIcon() {
  return (
    <svg aria-hidden className={styles.brushIcon} viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" fill="currentColor" />
    </svg>
  );
}
