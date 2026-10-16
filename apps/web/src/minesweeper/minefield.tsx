import type { MinesweeperState } from "@miolos/games/minesweeper";
import {
  memo,
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { minesweeperMessages } from "./messages";
import { isShortcut, keyMove, movedSelection } from "../play/grid-selection";
import { cellIndexOf } from "../play/cell-index-at";
import { useCellPress } from "../play/use-cell-press";
import { classOf, glyphOf } from "./finished-minefield";
import styles from "./minefield.module.css";
import { cellView, type CellView } from "./view";

const copy = minesweeperMessages;

export type TapMode = "open" | "flag";

function labelOf(view: CellView): string {
  if (typeof view === "number") {
    return view === 0 ? copy.cell.empty : copy.cell.count(view);
  }
  return copy.cell[view];
}

function positionLabel(index: number, columns: number, view: CellView): string {
  return copy.cellAria(
    Math.floor(index / columns) + 1,
    (index % columns) + 1,
    labelOf(view),
  );
}

const Cell = memo(function Cell({
  index,
  columns,
  view,
  tabbable,
  onFocus,
  onClick,
}: {
  readonly index: number;
  readonly columns: number;
  readonly view: CellView;
  readonly tabbable: boolean;
  readonly onFocus: (index: number) => void;
  readonly onClick: (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  return (
    <button
      type="button"
      className={classOf(view)}
      data-cell-index={index}
      tabIndex={tabbable ? 0 : -1}
      aria-label={positionLabel(index, columns, view)}
      onFocus={() => {
        onFocus(index);
      }}
      onClick={(event) => {
        onClick(index, event);
      }}
    >
      {glyphOf(view)}
    </button>
  );
});

// Turned, the grid draws board columns as rows, so a key moves on the screen
// while the index stays the board's.
function transpose(index: number, rows: number, columns: number): number {
  return (index % columns) * rows + Math.floor(index / columns);
}

function movedIndex(
  key: string,
  index: number,
  rows: number,
  columns: number,
  turned: boolean,
): number | null {
  const [viewRows, viewColumns] = turned ? [columns, rows] : [rows, columns];
  const move = keyMove(key, viewRows, viewColumns);
  if (move === null) {
    return null;
  }
  const at = turned ? transpose(index, rows, columns) : index;
  const next = movedSelection(at, move, viewRows, viewColumns);
  return turned ? transpose(next, columns, rows) : next;
}

export const Minefield = memo(function Minefield({
  game,
  sizeClass,
  tapMode,
  onActivate,
  onMark,
  onChord,
}: {
  readonly game: MinesweeperState;
  readonly sizeClass: string | undefined;
  readonly tapMode: TapMode;
  readonly onActivate: (index: number) => void;
  readonly onMark: (index: number) => void;
  readonly onChord: (index: number) => void;
}) {
  const { rows, columns } = game.size;
  const fieldRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const press = useCellPress({
    onActivate: (index) => {
      if (tapMode === "flag" && !game.open[index]) {
        onMark(index);
      } else {
        onActivate(index);
      }
    },
    onMark,
    onChord,
  });

  const onCellClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) {
        onActivate(index);
      }
    },
    [onActivate],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const field = fieldRef.current;
    const index = cellIndexOf(
      event.target instanceof Element ? event.target : null,
    );
    if (field === null || isShortcut(event) || index === null) {
      return;
    }
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      onMark(index);
      return;
    }
    const turned = getComputedStyle(field).gridAutoFlow === "column";
    const next = movedIndex(event.key, index, rows, columns, turned);
    if (next !== null) {
      event.preventDefault();
      field
        .querySelector<HTMLElement>(`[data-cell-index="${String(next)}"]`)
        ?.focus();
    }
  };

  return (
    <div
      ref={fieldRef}
      role="group"
      aria-label={copy.boardAria(rows, columns)}
      className={`${styles.field} ${sizeClass ?? ""}`}
      onKeyDown={onKeyDown}
      {...press}
    >
      {game.open.map((_open, index) => (
        <Cell
          key={index}
          index={index}
          columns={columns}
          view={cellView(game, index)}
          tabbable={index === selected}
          onFocus={setSelected}
          onClick={onCellClick}
        />
      ))}
    </div>
  );
});

export function MinefieldSkeleton({
  cells,
  sizeClass,
}: {
  readonly cells: number;
  readonly sizeClass: string | undefined;
}) {
  return (
    <div className={`${styles.field} ${sizeClass ?? ""}`}>
      {Array.from({ length: cells }, (_unused, index) => (
        <span key={index} className={styles.cell} />
      ))}
    </div>
  );
}
