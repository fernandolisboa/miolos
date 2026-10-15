import type { CSSProperties } from "react";

import styles from "./crossword-board.module.css";

function withSeven(
  base: string | undefined,
  seven: string | undefined,
  size: number,
): string {
  return size === 7 ? `${base ?? ""} ${seven ?? ""}` : (base ?? "");
}

export function gridClassName(size: number): string {
  return withSeven(styles.grid, styles.size7, size);
}

export function gridStyle(size: number): CSSProperties {
  return { "--crossword-size": size };
}

export function pageClassName(size: number): string {
  return withSeven(styles.pageCrossword, styles.pageSize7, size);
}
