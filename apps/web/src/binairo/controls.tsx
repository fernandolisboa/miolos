import { messages } from "../i18n";
import styles from "./binairo-screen.module.css";
import type { PaintMode } from "./state";

/**
 * The sticky-mode controls (plan 017 §12.2, D8). `0`, `1` and `apagar` set
 * a paint mode; pressing the active one returns to cycle mode, which is why
 * they are toggle buttons carrying `aria-pressed` rather than commands.
 *
 * The affordance line is desktop-only — F4 draws no such line, and at 390px
 * the three 60px buttons already fill the row.
 */
export function Controls({
  paint,
  onToggleMode,
}: {
  readonly paint: PaintMode;
  readonly onToggleMode: (mode: PaintMode) => void;
}) {
  const paintingZero = paint.kind === "paint" && paint.value === 0;
  const paintingOne = paint.kind === "paint" && paint.value === 1;
  const erasing = paint.kind === "erase";

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={`${styles.control} ${styles.controlDigit}${paintingZero ? ` ${styles.controlDigitActive}` : ""}`}
        aria-label={messages.games.binairo.play.controls.zeroAria}
        aria-pressed={paintingZero}
        onClick={() => onToggleMode({ kind: "paint", value: 0 })}
      >
        {messages.games.binairo.play.controls.zero}
      </button>
      <button
        type="button"
        className={`${styles.control} ${styles.controlDigit}${paintingOne ? ` ${styles.controlDigitActive}` : ""}`}
        aria-label={messages.games.binairo.play.controls.oneAria}
        aria-pressed={paintingOne}
        onClick={() => onToggleMode({ kind: "paint", value: 1 })}
      >
        {messages.games.binairo.play.controls.one}
      </button>
      <button
        type="button"
        className={`${styles.control} ${styles.controlErase}${erasing ? ` ${styles.controlEraseActive}` : ""}`}
        aria-label={messages.games.binairo.play.controls.eraseAria}
        aria-pressed={erasing}
        onClick={() => onToggleMode({ kind: "erase" })}
      >
        {messages.games.binairo.play.controls.erase}
      </button>
      <span className={styles.affordance}>
        {messages.games.binairo.play.controls.affordance}
      </span>
    </div>
  );
}
