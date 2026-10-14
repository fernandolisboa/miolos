import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

const ROW_END = Number.MAX_SAFE_INTEGER;

const KEYBOARD_COLUMNS = 22;
const LETTER_SPAN = 2;
const QWERTY = [
  { letters: "qwertyuiop", start: 1 },
  { letters: "asdfghjkl", start: 2 },
  { letters: "zxcvbnm", start: 5 },
] as const;

export interface KeySlot {
  readonly id: string;
  readonly column: number;
  readonly span: number;
}

export function qwertySlots(
  rowEnds: readonly [string, string?],
): readonly (readonly KeySlot[])[] {
  return QWERTY.map(({ letters, start }, row) => {
    const slots: KeySlot[] = [...letters].map((id, index) => ({
      id,
      column: start + LETTER_SPAN * index,
      span: LETTER_SPAN,
    }));
    const command = rowEnds[row];
    if (command === undefined) {
      return slots;
    }
    const column = start + LETTER_SPAN * letters.length;
    return [
      ...slots,
      { id: command, column, span: KEYBOARD_COLUMNS + 1 - column },
    ];
  });
}

export interface LetterKeyboardKey {
  readonly id: string;
  readonly column: number;
  readonly span: number;
  readonly label: ReactNode;
  readonly ariaLabel: string;
  readonly className: string | undefined;
  readonly onActivate: () => void;
}

export interface LetterKeyboardRow {
  readonly keys: readonly LetterKeyboardKey[];
}

export interface LetterKeyboardProps {
  readonly rows: readonly LetterKeyboardRow[];
  readonly groupClassName: string;
  readonly groupLabel: string;
  readonly activeKeyRef?: RefObject<HTMLButtonElement | null>;
}

type Position = readonly [row: number, column: number];

function positions(
  rows: readonly LetterKeyboardRow[],
): ReadonlyMap<string, Position> {
  const map = new Map<string, Position>();
  rows.forEach((row, rowIndex) => {
    row.keys.forEach((key, column) => {
      map.set(key.id, [rowIndex, column]);
    });
  });
  return map;
}

function keyAt(
  rows: readonly LetterKeyboardRow[],
  row: number,
  column: number,
): LetterKeyboardKey | undefined {
  const keys = rows[clamp(row, rows.length)]?.keys;
  if (keys === undefined) {
    return undefined;
  }
  return keys[clamp(column, keys.length)];
}

function nearestKey(
  rows: readonly LetterKeyboardRow[],
  row: number,
  column: number,
  down: boolean,
): LetterKeyboardKey | undefined {
  const from = rows[row]?.keys[column];
  const keys = rows[clamp(down ? row + 1 : row - 1, rows.length)]?.keys ?? [];
  if (from === undefined) {
    return undefined;
  }
  const centre = (key: LetterKeyboardKey) => key.column + key.span / 2;
  const distance = (key: LetterKeyboardKey) =>
    Math.abs(centre(key) - centre(from));
  // The rows are staggered half a key, so two keys often tie: going down
  // takes the right one and going up the left one, as on a real keyboard.
  return keys.reduce<LetterKeyboardKey | undefined>((best, key) => {
    if (best === undefined) {
      return key;
    }
    const gap = distance(key) - distance(best);
    return gap < 0 || (down && gap === 0) ? key : best;
  }, undefined);
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}

export function LetterKeyboard({
  rows,
  groupClassName,
  groupLabel,
  activeKeyRef,
}: LetterKeyboardProps) {
  const seed = rows[0]?.keys[0]?.id;
  const [focused, setFocused] = useState<string | undefined>(seed);
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const map = positions(rows);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = idOfNode(nodes.current, event.target) ?? focused ?? seed;
    const position = current === undefined ? undefined : map.get(current);
    if (position === undefined) {
      return;
    }
    const [row, column] = position;
    const next = nextPosition(event.key, row, column);
    if (next === null) {
      return;
    }
    event.preventDefault();
    const target =
      event.key === "ArrowUp" || event.key === "ArrowDown"
        ? nearestKey(rows, row, column, event.key === "ArrowDown")
        : keyAt(rows, next[0], next[1]);
    if (target !== undefined) {
      nodes.current.get(target.id)?.focus();
    }
  };

  const onClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    key: LetterKeyboardKey,
  ): void => {
    if (event.detail !== 0) {
      event.currentTarget.blur();
    }
    key.onActivate();
  };

  return (
    <div
      className={groupClassName}
      role="group"
      aria-label={groupLabel}
      onKeyDown={onKeyDown}
    >
      {rows.flatMap((row) =>
        row.keys.map((key) => (
          <button
            key={key.id}
            type="button"
            className={key.className}
            style={{
              gridColumn: `${String(key.column)} / span ${String(key.span)}`,
            }}
            tabIndex={key.id === focused ? 0 : -1}
            ref={(node) => {
              if (node === null) {
                nodes.current.delete(key.id);
                return;
              }
              nodes.current.set(key.id, node);
              if (key.id === focused && activeKeyRef !== undefined) {
                activeKeyRef.current = node;
              }
            }}
            aria-label={key.ariaLabel}
            onFocus={() => {
              setFocused(key.id);
            }}
            onClick={(event) => {
              onClick(event, key);
            }}
          >
            {key.label}
          </button>
        )),
      )}
    </div>
  );
}

function idOfNode(
  registry: ReadonlyMap<string, HTMLButtonElement>,
  target: EventTarget,
): string | undefined {
  for (const [id, node] of registry) {
    if (node === target) {
      return id;
    }
  }
  return undefined;
}

function nextPosition(
  key: string,
  row: number,
  column: number,
): Position | null {
  switch (key) {
    case "ArrowLeft":
      return [row, column - 1];
    case "ArrowRight":
      return [row, column + 1];
    case "ArrowUp":
      return [row - 1, column];
    case "ArrowDown":
      return [row + 1, column];
    case "Home":
      return [row, 0];
    case "End":
      return [row, ROW_END];
    default:
      return null;
  }
}
