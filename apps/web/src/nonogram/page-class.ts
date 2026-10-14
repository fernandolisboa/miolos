import type { NonogramSize } from "@miolos/core";

import styles from "./nonogram-board.module.css";

const SIZE_CLASS: Readonly<Record<NonogramSize, string>> = {
  5: styles.pageSize5 ?? "",
  8: styles.pageSize8 ?? "",
  10: styles.pageSize10 ?? "",
  15: styles.pageSize15 ?? "",
};

export function nonogramPageModifier(size: NonogramSize): string {
  return `${styles.pageNonogram ?? ""} ${SIZE_CLASS[size]}`;
}
