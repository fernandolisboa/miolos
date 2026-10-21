import type { NonogramSize } from "@miolos/core";

import styles from "./nonogram-board.module.css";

const GROUP = 5;

const EMPTY_LINE: readonly number[] = [0];

export const SIZE_CLASS = {
  5: styles.size5,
  8: styles.size8,
  10: styles.size10,
  15: styles.size15,
} satisfies Record<NonogramSize, string | undefined>;

export function rowRailId(row: number): string {
  return `nonogram-clue-row-${row}`;
}

export function columnRailId(column: number): string {
  return `nonogram-clue-col-${column}`;
}

export function numbersOf(runs: readonly number[]): readonly number[] {
  return runs.length === 0 ? EMPTY_LINE : runs;
}

export function sameStrikes(
  before: readonly boolean[],
  after: readonly boolean[],
): boolean {
  return (
    before.length === after.length &&
    before.every((struck, at) => struck === after[at])
  );
}

export function ruleClasses(row: number, column: number, size: number): string {
  return [
    row % GROUP === 0 ? styles.cellRuleTop : "",
    column % GROUP === 0 ? styles.cellRuleLeft : "",
    column === size - 1 ? styles.cellEdgeRight : "",
    row === size - 1 ? styles.cellEdgeBottom : "",
  ]
    .filter((rule) => rule !== "")
    .join(" ");
}
