import { minesweeperMessages } from "./messages";
import { FlagGlyph } from "./glyphs";
import styles from "./minefield.module.css";
import type { TapMode } from "./minefield";

const copy = minesweeperMessages.tap;

const MODES = [
  { mode: "open", label: copy.open },
  { mode: "flag", label: copy.flag },
] as const;

export function TapModeToggle({
  mode,
  onChange,
}: {
  readonly mode: TapMode;
  readonly onChange: (mode: TapMode) => void;
}) {
  return (
    <div role="group" aria-label={copy.label} className={styles.tapMode}>
      {MODES.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={`${styles.tapButton}${mode === option.mode ? ` ${styles.tapButtonOn}` : ""}`}
          aria-label={option.label}
          aria-pressed={mode === option.mode}
          onClick={() => {
            onChange(option.mode);
          }}
        >
          {option.mode === "flag" ? (
            <span className={styles.tapIcon}>
              <FlagGlyph />
            </span>
          ) : (
            <svg aria-hidden viewBox="0 0 24 24" className={styles.tapIcon}>
              <rect
                x="4.5"
                y="4.5"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <rect x="9" y="9" width="6" height="6" fill="currentColor" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}
