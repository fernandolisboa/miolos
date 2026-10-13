import type { BinaryCellValue, BinaryMark } from "./binary-grid";

export type Press = "tap" | "left" | "right";

export interface StrokeEffect {
  readonly value: BinaryMark;
  readonly clears: boolean;
}

export function pressedMark(brush: BinaryMark, press: Press): BinaryMark {
  return press === "right" ? otherMark(brush) : brush;
}

function otherMark(mark: BinaryMark): BinaryMark {
  return mark === 1 ? 0 : 1;
}

export function toggled(
  current: BinaryCellValue,
  value: BinaryMark,
): BinaryCellValue {
  return current === value ? null : value;
}

export function cycled(current: BinaryCellValue): BinaryCellValue {
  return current === null ? 0 : current === 0 ? 1 : null;
}

export function strokeEffect(
  start: BinaryCellValue,
  value: BinaryMark,
): StrokeEffect {
  return { value, clears: start === value };
}

export function painted(
  effect: StrokeEffect,
  current: BinaryCellValue,
): BinaryCellValue {
  if (!effect.clears) {
    return effect.value;
  }
  return current === effect.value ? null : current;
}
