import type { KeyboardState, TileState } from "@miolos/games/termo";
import {
  memo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

import { messages } from "../i18n";
import styles from "./termo-board.module.css";

const copy = messages.games.termo.play.keyboard;

/**
 * ONE table drives DOM order, reading order, tab order, the arrow model and
 * the grid placement (ADR-0042 decisions 2 and 8).
 *
 * Rows include the COMMANDS, so the DOM is row-major and `enviar` is emitted
 * where it is drawn — first in row 3. "26 letters, then the two commands"
 * would put `enviar` visually first and second-to-last in reading and tab
 * order: a WCAG 1.3.2 / 2.4.3 mismatch, and a flat array the per-row arrow
 * table cannot be written over.
 *
 * The second member of each pair is the grid column the key starts in. Row 1
 * is 10 keys of span 2 from column 1 — exactly 20 columns; row 2 is inset one
 * column each side, which draws the QWERTY half-key stagger with tracks
 * rather than spacers; row 3 is 3 + 14 + 3.
 */
const KEY_ROWS = [
  [
    ["q", 1],
    ["w", 3],
    ["e", 5],
    ["r", 7],
    ["t", 9],
    ["y", 11],
    ["u", 13],
    ["i", 15],
    ["o", 17],
    ["p", 19],
  ],
  [
    ["a", 2],
    ["s", 4],
    ["d", 6],
    ["f", 8],
    ["g", 10],
    ["h", 12],
    ["j", 14],
    ["k", 16],
    ["l", 18],
  ],
  [
    ["enter", 1],
    ["z", 4],
    ["x", 6],
    ["c", 8],
    ["v", 10],
    ["b", 12],
    ["n", 14],
    ["m", 16],
    ["erase", 18],
  ],
] as const;

/**
 * The 28 identifiers, DERIVED from the table rather than restated beside it.
 * A hand-written 26-letter union was the first draft's defect: it made
 * `enviar` and `apagar` incapable of ever holding `tabindex="0"` and left
 * `Home`/`End` on row 3 with no representable target.
 */
export type KeyId = (typeof KEY_ROWS)[number][number][0];

/** Where each id sits, so the arrow model is a lookup and not a search. */
const POSITION: ReadonlyMap<KeyId, readonly [number, number]> = new Map(
  KEY_ROWS.flatMap((row, rowIndex) =>
    row.map(([id], column) => [id, [rowIndex, column]] as const),
  ),
);

/**
 * The first key in DOM order, and the `useState` seed — so the very first
 * `Tab` into the group lands on Q and there is never a render in which zero
 * keys carry `tabindex="0"`.
 */
const SEED: KeyId = "q";

/** Any index past a row's end; `keyAt` clamps, so this means "the last key". */
const ROW_END = Number.MAX_SAFE_INTEGER;

const COMMAND_SPAN = 3;
const LETTER_SPAN = 2;

/** Spelled out rather than indexed by a computed key — see `board.tsx`. */
const KEY_STATE_CLASS = {
  correct: styles.keyCorrect,
  present: styles.keyPresent,
  absent: styles.keyAbsent,
} satisfies Record<TileState, string | undefined>;

export interface KeyboardProps {
  /** Best-known state per letter across every judged guess. */
  readonly state: KeyboardState;
  readonly onLetter: (letter: string) => void;
  readonly onEnter: () => void;
  readonly onErase: () => void;
  /**
   * Written HERE (the key whose id is `focused` assigns itself) and read only
   * by the retry button, which hands the caret back synchronously because it
   * is about to unmount. A ref rather than a callback prop because the value
   * is a DOM node and nothing renders from it.
   */
  readonly activeKeyRef: RefObject<HTMLButtonElement | null>;
}

/**
 * The keyboard (ADR-0042 decisions 2, 3 and 8): a composite widget, ONE tab
 * stop, roving tabindex over 28 ids.
 *
 * IT IS THE REPO'S FIRST ROVING TABINDEX — `sudoku/keypad.tsx` is nine plain
 * buttons and nine plain tab stops, with no `tabIndex` prop anywhere in the
 * file — so nothing here is inherited. The three parts that make it real
 * rather than an attribute shuffle: a ref REGISTRY, so a key id can reach a
 * DOM node; a SYNCHRONOUS `.focus()` in the key handler, never an effect; and
 * `onFocus` as the SINGLE writer of `focused`, which closes the loop for a
 * `Tab` into the group and for a pointer click too, neither of which goes
 * through `onKeyDown`. A `tabIndex` prop plus an `onFocus` handler alone move
 * an attribute, not the caret.
 *
 * A judged re-render does not touch `focused` BY CONSTRUCTION: it is this
 * component's own `useState` and is not derived from `TermoPlayState`, and
 * the buttons are keyed by `KeyId` off a module-level table, so React
 * reconciles them in place and no DOM node is remounted.
 *
 * MEMOIZED for the reason `board.tsx` spells out in full: the 1 Hz
 * lifecycle tick repaints a screen with no clock on it, and without this
 * every tick re-rendered all 28 keys — 28 `ariaFor` compositions, 28
 * `keyClassName` calls, 28 fresh `style` objects, 84 fresh inline closures
 * and 28 ref detach/reattach cycles (the inline `ref` arrow changes identity
 * every render, so React nulls and re-sets all 28 → 56 Map mutations), for
 * zero DOM writes. The same waste landed on every keystroke.
 *
 * All five props are referentially stable BY CONSTRUCTION, which is what
 * makes the default shallow compare exact rather than lucky: `state` is a
 * `useMemo([state.guesses])`, `onLetter`/`onErase` are `useCallback([])`,
 * `onEnter` is `useCallback([arm])`, and `activeKeyRef` is a `useRef`. The
 * roving `focused` is this component's own `useState`, so `memo` cannot
 * stale it. Measured with `T-WEB-S104`.
 */
export const Keyboard = memo(function Keyboard({
  state,
  onLetter,
  onEnter,
  onErase,
  activeKeyRef,
}: KeyboardProps) {
  const [focused, setFocused] = useState<KeyId>(SEED);
  const keys = useRef(new Map<KeyId, HTMLButtonElement>());

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // The ORIGIN is the key the event actually came from, reverse-looked-up
    // in the registry, and `focused` is only the fallback for an event that
    // reached the container from somewhere else. Reading the origin off React
    // state alone is a real fragility rather than a style choice: `focused`
    // is written by `onFocus`, so between a caret that MOVED (a `Tab` into
    // the group, a pointer click, a programmatic `.focus()`) and the commit
    // that records it there is a window in which an arrow key would move from
    // the wrong key. Reverse lookup over 28 entries costs nothing and cannot
    // be stale.
    const next = nextKey(
      idOfNode(keys.current, event.target) ?? focused,
      event.key,
    );
    if (next === null) {
      // `Enter` and `Space` fall through to native <button> activation, which
      // is what makes this a composite widget rather than a re-implementation
      // of one.
      return;
    }
    // Arrows and Home/End would scroll the page under the caret.
    event.preventDefault();
    // SYNCHRONOUS, in the handler. An effect would be a second writer of the
    // caret, would put a render between the keypress and the move, and over
    // 28 buttons would re-run on every judged re-render for nothing.
    // Focusing an element that currently carries `tabindex="-1"` is legal and
    // is exactly what the ARIA APG's roving pattern does.
    keys.current.get(next)?.focus();
  };

  const onClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    id: KeyId,
  ): void => {
    // `detail !== 0` is a POINTER activation — `nonogram/board.tsx`'s
    // `onCellClick` ships the same test. Blurring returns a mouse player to
    // the UNFOCUSED page the window listener serves; a keyboard activation
    // is `detail === 0` and keeps its caret. `focused` survives either way,
    // because only `onFocus` writes it and a blur fires no `onFocus`.
    if (event.detail !== 0) {
      event.currentTarget.blur();
    }
    if (id === "enter") {
      onEnter();
      return;
    }
    if (id === "erase") {
      onErase();
      return;
    }
    onLetter(id);
  };

  return (
    <div
      className={styles.keyboard}
      role="group"
      aria-label={copy.label}
      onKeyDown={onKeyDown}
    >
      {KEY_ROWS.flat().map(([id, column]) => (
        <button
          key={id}
          type="button"
          className={keyClassName(id, state)}
          style={{
            gridColumn: `${String(column)} / span ${String(spanOf(id))}`,
          }}
          // Exactly one 0 across all 28, and NOTHING derives it from game
          // state.
          tabIndex={id === focused ? 0 : -1}
          ref={(node) => {
            if (node === null) {
              keys.current.delete(id);
              return;
            }
            keys.current.set(id, node);
            if (id === focused) {
              activeKeyRef.current = node;
            }
          }}
          aria-label={ariaFor(id, state)}
          onFocus={() => {
            setFocused(id);
          }}
          onClick={(event) => {
            onClick(event, id);
          }}
        >
          {labelFor(id)}
        </button>
      ))}
    </div>
  );
});

/**
 * The pre-hydration keyboard. Divs rather than buttons, so nothing here is
 * focusable or announced before it works — but every box the hydrated
 * keyboard occupies is reserved, all three rows and all 28 of them, in the
 * same row-major order.
 *
 * Labelled, unlike the play screen's readouts: a key cap is a constant, so
 * this row owes the record nothing and can paint complete
 * (`sudoku/keypad.tsx`'s `KeypadSkeleton`). NO `tabIndex` and no refs —
 * there is no roving anything to seed before it works.
 */
export function KeyboardSkeleton() {
  return (
    <div aria-hidden className={styles.keyboard}>
      {KEY_ROWS.flat().map(([id, column]) => (
        <div
          key={id}
          className={`${keyClassName(id, {})} ${styles.placeholder}`}
          style={{
            gridColumn: `${String(column)} / span ${String(spanOf(id))}`,
          }}
        >
          {labelFor(id)}
        </div>
      ))}
    </div>
  );
}

function isCommand(id: KeyId): boolean {
  return id === "enter" || id === "erase";
}

function spanOf(id: KeyId): number {
  return isCommand(id) ? COMMAND_SPAN : LETTER_SPAN;
}

function keyClassName(id: KeyId, state: KeyboardState): string | undefined {
  if (isCommand(id)) {
    return `${styles.key} ${styles.keyCommand}`;
  }
  const tile = state[id];
  return tile === undefined
    ? styles.key
    : `${styles.key} ${KEY_STATE_CLASS[tile]}`;
}

/** No key label is a literal in this component (ADR-0018). */
function labelFor(id: KeyId): string {
  if (id === "enter") {
    return copy.enter;
  }
  return id === "erase" ? copy.erase : id;
}

/**
 * One composer over 28 ids. The judged state rides in the NAME because
 * ADR-0030 decision 7 puts it there rather than on an ARIA state property —
 * and `aria-invalid` is used nowhere on this screen, because ARIA does not
 * support it on `role=button` and `jsx-a11y/role-supports-aria-props` reds
 * the lint gate.
 */
function ariaFor(id: KeyId, state: KeyboardState): string {
  if (id === "enter") {
    return copy.enterAria;
  }
  if (id === "erase") {
    return copy.eraseAria;
  }
  const tile = state[id];
  return tile === undefined
    ? copy.letterAria(id)
    : copy.letterStateAria(id, tile);
}

/**
 * The arrow model, over the 28 ids. `←`/`→` clamp at the row's ends; `↑`/`↓`
 * clamp at rows 1 and 3 AND clamp the column into the shorter row, so row 1's
 * `p` (column 9) goes down to `l` and row 2's `l` (column 8) goes down to
 * `erase`; `Home`/`End` take the row's first and last id, which on row 3 are
 * `enter` and `erase`. `Enter`/`Space` are not handled here at all.
 */
function nextKey(id: KeyId, key: string): KeyId | null {
  const position = POSITION.get(id);
  if (position === undefined) {
    // Unreachable: `KeyId` is derived FROM this table. Returning null rather
    // than asserting keeps the function total.
    return null;
  }
  const [row, column] = position;
  switch (key) {
    case "ArrowLeft":
      return keyAt(row, column - 1);
    case "ArrowRight":
      return keyAt(row, column + 1);
    case "ArrowUp":
      return keyAt(row - 1, column);
    case "ArrowDown":
      return keyAt(row + 1, column);
    case "Home":
      return keyAt(row, 0);
    case "End":
      return keyAt(row, ROW_END);
    default:
      return null;
  }
}

/**
 * The id whose button IS this event target, or null. A reverse lookup rather
 * than a `data-` attribute so there is nothing to parse and nothing to
 * validate: the registry is already the one map from id to node.
 */
function idOfNode(
  registry: ReadonlyMap<KeyId, HTMLButtonElement>,
  target: EventTarget,
): KeyId | null {
  for (const [id, node] of registry) {
    if (node === target) {
      return id;
    }
  }
  return null;
}

/** The id at (row, column), with BOTH indices clamped into range. */
function keyAt(row: number, column: number): KeyId | null {
  const keys = KEY_ROWS[clamp(row, KEY_ROWS.length)];
  if (keys === undefined) {
    return null;
  }
  return keys[clamp(column, keys.length)]?.[0] ?? null;
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}
