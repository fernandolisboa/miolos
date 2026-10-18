import type { AutoCrosses } from "../play/auto-cross";
import {
  binaryCellValue,
  settled,
  withBinaryEntry,
  type BinaryGridRules,
  type BinaryGridState,
} from "../play/binary-grid";
import {
  painted,
  startStroke,
  toggled,
  type Press,
  type StrokeEffect,
} from "../play/brush";
import { isPictureComplete } from "./engine";

export type PaintAction =
  | {
      readonly type: "mark-cell";
      readonly index: number;
      readonly press: Press;
    }
  | {
      readonly type: "stroke-start";
      readonly index: number;
      readonly press: Press;
    }
  | { readonly type: "paint-over"; readonly index: number };

interface Paintable<R, M extends number> extends BinaryGridState<R, M> {
  readonly stroke: StrokeEffect<M> | null;
}

export function painting<S extends Paintable<R, M>, R, M extends number>(
  state: S,
  action: PaintAction,
  pressed: (press: Press) => M,
  rules: BinaryGridRules<S, R, M>,
): S {
  const current = binaryCellValue(state, action.index);
  switch (action.type) {
    case "mark-cell":
      return current === undefined
        ? state
        : withBinaryEntry(
            state,
            action.index,
            toggled(current, pressed(action.press)),
            rules,
          );

    case "stroke-start": {
      if (current === undefined) {
        return { ...state, stroke: null };
      }
      const { stroke, first } = startStroke(current, pressed(action.press));
      return withBinaryEntry({ ...state, stroke }, action.index, first, rules);
    }

    case "paint-over":
      return current === undefined || state.stroke === null
        ? state
        : withBinaryEntry(
            state,
            action.index,
            painted(state.stroke, current),
            rules,
          );
  }
}

export function pictureSettled<S extends BinaryGridState<unknown, number>>(
  state: S,
  entries: S["entries"],
): S {
  return settled(
    state,
    entries,
    state.solution !== null && isPictureComplete(state.solution, entries),
  );
}

interface Crossable extends BinaryGridState<unknown, number> {
  readonly autoCrossed: AutoCrosses;
}

export type PictureSnapshot<S extends Crossable> = Pick<
  S,
  "entries" | "selected" | "hint" | "autoCrossed"
>;

export function pictureSnapshot<S extends Crossable>({
  entries,
  selected,
  hint,
  autoCrossed,
}: S): PictureSnapshot<S> {
  return { entries, selected, hint, autoCrossed };
}
