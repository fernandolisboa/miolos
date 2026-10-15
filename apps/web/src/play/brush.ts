import type { BinaryCellValue, BinaryMark } from "./binary-grid";

export type Press = "tap" | "left" | "right";

export interface StrokeEffect<M extends number = BinaryMark> {
  readonly value: M;
  readonly clears: boolean;
}

export function pressedMark(brush: BinaryMark, press: Press): BinaryMark {
  return press === "right" ? otherMark(brush) : brush;
}

function otherMark(mark: BinaryMark): BinaryMark {
  return mark === 1 ? 0 : 1;
}

export function toggled<M extends number>(
  current: M | null,
  value: M,
): M | null {
  return current === value ? null : value;
}

export function cycled(
  current: BinaryCellValue,
  first: BinaryMark,
): BinaryCellValue {
  if (current === null) {
    return first;
  }
  return current === first ? otherMark(first) : null;
}

export function strokeEffect<M extends number>(
  start: M | null,
  value: M,
): StrokeEffect<M> {
  return { value, clears: start === value };
}

export function painted<M extends number>(
  effect: StrokeEffect<M>,
  current: M | null,
): M | null {
  if (!effect.clears) {
    return effect.value;
  }
  return current === effect.value ? null : current;
}

export function startStroke<M extends number>(
  start: M | null,
  value: M,
): { readonly stroke: StrokeEffect<M>; readonly first: M | null } {
  const stroke = strokeEffect(start, value);
  return { stroke, first: painted(stroke, start) };
}
