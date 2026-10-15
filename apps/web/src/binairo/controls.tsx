import { messages } from "../i18n";
import { InfoTip, InfoTipSkeleton } from "../play/info-tip";
import { useSettings } from "../settings/settings";
import styles from "./binairo-screen.module.css";
import type { PaintMode } from "./state";

const copy = messages.games.binairo.play.controls;

const DIGITS = [
  { value: 0, label: copy.zero, aria: copy.zeroAria },
  { value: 1, label: copy.one, aria: copy.oneAria },
] as const;

function Affordance({ paint }: { readonly paint: PaintMode }) {
  const first = useSettings().games.binairo.firstValue;
  const left = paint.kind === "paint" ? paint.value : first;
  return (
    <span className={styles.affordance}>
      <InfoTip text={copy.affordance(left)} align="center" />
    </span>
  );
}

export function Controls({
  paint,
  onToggleMode,
}: {
  readonly paint: PaintMode;
  readonly onToggleMode: (value: 0 | 1) => void;
}) {
  return (
    <div className={styles.controls}>
      <div className={styles.digits}>
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
      </div>
      <Affordance paint={paint} />
    </div>
  );
}

export function ControlsSkeleton() {
  return (
    <div aria-hidden className={styles.controls}>
      <div className={styles.digits}>
        {DIGITS.map(({ value, label }) => (
          <div
            key={value}
            className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
          >
            {label}
          </div>
        ))}
      </div>
      <span className={styles.affordance}>
        <InfoTipSkeleton />
      </span>
    </div>
  );
}
