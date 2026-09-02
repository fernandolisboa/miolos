import type { NonogramSize } from "@miolos/core";

import styles from "./nonogram-board.module.css";

export function nonogramPageModifier(size: NonogramSize): string {
  const cap = size === 5 ? ` ${styles.mobileCap5}` : "";
  return `${styles.pageNonogram}${cap}`;
}
