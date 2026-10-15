import type { CSSProperties } from "react";

import styles from "./crossword-board.module.css";

interface SizeClasses {
  readonly grid: string;
  readonly page: string;
}

const NO_CLASSES: SizeClasses = { grid: "", page: "" };

const SIZE_CLASSES: ReadonlyMap<number, SizeClasses> = new Map([
  [7, { grid: styles.size7 ?? "", page: styles.pageSize7 ?? "" }],
]);

function classesOf(size: number): SizeClasses {
  return SIZE_CLASSES.get(size) ?? NO_CLASSES;
}

export function gridClassName(size: number): string {
  return `${styles.grid ?? ""} ${classesOf(size).grid}`.trim();
}

export function gridStyle(size: number): CSSProperties {
  return { "--crossword-size": size };
}

export function pageClassName(size: number): string {
  return `${styles.pageCrossword ?? ""} ${classesOf(size).page}`.trim();
}
