import { messages } from "../i18n";
import styles from "./binairo-screen.module.css";
import type { PaintMode } from "./state";

const copy = messages.games.binairo.play.controls;

const DIGITS = [
  { value: 0, label: copy.zero, aria: copy.zeroAria },
  { value: 1, label: copy.one, aria: copy.oneAria },
] as const;

export function Controls({
  paint,
  onToggleMode,
}: {
  readonly paint: PaintMode;
  readonly onToggleMode: (value: 0 | 1) => void;
}) {
  return (
    <div className={styles.controls}>
      {DIGITS.map(({ value, label, aria }) => {
        const active = paint.kind === "paint" && paint.value === value;
        return (
          <button
            key={value}
            type="button"
            className={`${styles.control} ${styles.controlDigit}${active ? ` ${styles.controlDigitActive}` : ""}`}
            aria-label={aria}
            aria-pressed={active}
            onClick={() => onToggleMode(value)}
          >
            {label}
          </button>
        );
      })}
      <span className={styles.affordance}>{copy.affordance}</span>
    </div>
  );
}

export function ControlsSkeleton() {
  return (
    <div aria-hidden className={styles.controls}>
      {DIGITS.map(({ value, label }) => (
        <div
          key={value}
          className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
        >
          {label}
        </div>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
    </div>
  );
}
