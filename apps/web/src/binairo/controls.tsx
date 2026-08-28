import { messages } from "../i18n";
import styles from "./binairo-screen.module.css";
import type { PaintMode } from "./state";

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
