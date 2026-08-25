import { messages } from "../i18n";
import styles from "./nonogram-board.module.css";
import type { NonogramBrush } from "./state";

/**
 * The three brushes, in the order they paint. `preencher` is first and is
 * pressed at first paint: it is the gesture the game is made of.
 */
const BRUSHES: readonly NonogramBrush[] = ["fill", "cross", "erase"];

/**
 * The sticky brush controls (ADR-0037 decision 1). Three toggle buttons
 * carrying `aria-pressed`, exactly one pressed, and NO cycle mode.
 *
 * These are MODES, not commands, and the difference is mechanical rather than
 * stylistic. Sudoku's keypad is commands *because* Sudoku does not drag — the
 * command carries its own value, so there is nothing sticky to expose. A
 * Nonogram stroke carries no value of its own: `paint-over` must be a plain
 * SET, and the value it sets can only come from sticky state. `aria-pressed`
 * is therefore not decoration — the brush is state a non-sighted player must
 * be able to query before every stroke.
 *
 * And there is no cycle default: `binairo/state.ts`'s `paint-over` case
 * ignores that action entirely in cycle mode, so a cycle default here would
 * ship this board's primary gesture dead on first paint.
 *
 * REJECTED: `role="radiogroup"` + three `role="radio"`. Semantically closer to
 * "exactly one of three", and rejected because radio semantics bring their own
 * keyboard contract (arrows move between radios, the group is one tab stop) —
 * a third keyboard model on a screen that already has the board's composite
 * widget and the ordinary chrome. Binairo's shipped `aria-pressed` toggle row
 * is the precedent, and consistency across two paint boards beats a marginally
 * better role.
 *
 * Word labels, no glyphs and no emoji (DESIGN.md's anti-references).
 */
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

/**
 * The placeholder controls, mirroring `KeypadSkeleton`: `aria-hidden` divs
 * rather than buttons, so nothing here is focusable or announced before it
 * works — but every box the hydrated row occupies is reserved, because
 * `.board` is a centred flex column and a missing row hands its height to the
 * board as an OFFSET.
 *
 * Labelled, unlike the play screen's readouts: a brush label is a constant, so
 * this row owes the record nothing and can paint complete.
 */
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

/** The accessible name's key for a brush — `fill` → `fillAria`. */
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
