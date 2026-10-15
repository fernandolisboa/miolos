export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Placement {
  readonly left: number;
  readonly top: number;
  readonly tail: number;
  readonly below: boolean;
}

const GAP = 8;
const TAIL_INSET = 16;
const MIN_WIDTH = 180;

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

export function hintArea(
  frame: Box,
  fieldTop: number,
  cell: Box,
  viewportWidth: number,
): Box {
  return {
    left: Math.max(frame.left, 0),
    top: cell.top >= 0 ? Math.max(fieldTop, 0) : fieldTop,
    right: Math.min(frame.right, viewportWidth),
    bottom: frame.bottom,
  };
}

export function hintCardWidth(cell: Box, area: Box): number {
  return Math.min(
    Math.max(3 * (cell.right - cell.left), MIN_WIDTH),
    area.right - area.left,
  );
}

export function placeHintCard(
  cell: Box,
  card: { readonly width: number; readonly height: number },
  area: Box,
): Placement {
  const centre = (cell.left + cell.right) / 2;
  const runsRight = centre - TAIL_INSET;
  const runsLeft = centre + TAIL_INSET - card.width;
  const left =
    runsRight + card.width <= area.right
      ? runsRight
      : runsLeft >= area.left
        ? runsLeft
        : clamp(centre - card.width / 2, area.left, area.right - card.width);
  const above = cell.top - GAP - card.height;
  const below = above < area.top;
  return {
    left,
    top: below ? cell.bottom + GAP : above,
    tail: clamp(centre - left, TAIL_INSET, card.width - TAIL_INSET),
    below,
  };
}
